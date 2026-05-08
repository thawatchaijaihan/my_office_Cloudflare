import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = env.DB;

    // 1. Summary
    const summaryStmt = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status_m = 'ชำระแล้ว' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status_m LIKE '%ค้างชำระ%' THEN 1 ELSE 0 END) as outstanding,
        SUM(CASE WHEN status_n = 'ข้อมูลไม่ถูกต้อง' THEN 1 ELSE 0 END) as dataIncorrect,
        SUM(CASE WHEN status_n = 'รอตรวจสอบ' THEN 1 ELSE 0 END) as pendingReview,
        COALESCE(SUM(paid_amount), 0) as paidAmount
      FROM pass_requests
    `).first();

    // 2. Approval Breakdown
    const breakdownResult = await db.prepare(`
      SELECT status_n as label, COUNT(*) as count 
      FROM pass_requests 
      GROUP BY status_n
    `).all();

    // 3. Top Outstanding
    const topResult = await db.prepare(`
      SELECT first_name || ' ' || last_name as name, 'ค้างชำระ' as title, COUNT(*) as count
      FROM pass_requests
      WHERE status_m LIKE '%ค้างชำระ%'
      GROUP BY first_name, last_name
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // 4. Latest Entries
    const latestResult = await db.prepare(`
      SELECT id as rowNumber, timestamp as registeredAt, first_name || ' ' || last_name as name, 
             relation as requestFor, plate
      FROM pass_requests
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      summary: {
        total: summaryStmt.total || 0,
        paid: summaryStmt.paid || 0,
        outstanding: summaryStmt.outstanding || 0,
        dataIncorrect: summaryStmt.dataIncorrect || 0,
        pendingReview: summaryStmt.pendingReview || 0,
        pendingSend: 0,
        paidAmount: summaryStmt.paidAmount || 0,
        outstandingAmount: (summaryStmt.outstanding || 0) * 100, // example logic
      },
      approvalBreakdown: breakdownResult.results,
      topOutstanding: topResult.results,
      latestEntries: latestResult.results,
    });
  } catch (error: any) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
