import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    const db = env.DB;
    if (!db) throw new Error("No DB");

    const summary = await db.prepare(`
      SELECT 
        SUM(CASE WHEN status_m = 'ชำระแล้ว' THEN paid_amount ELSE 0 END) as paidTotal,
        SUM(CASE WHEN status_m LIKE '%ค้างชำระ%' THEN 100 ELSE 0 END) as outstandingTotal
      FROM pass_requests
    `).first();

    const paid = Number(summary?.paidTotal || 0);
    const outstanding = Number(summary?.outstandingTotal || 0);

    return NextResponse.json({
      currentMonth: {
        total: paid + outstanding,
        services: [
          { name: "ชำระเงินแล้ว", cost: paid },
          { name: "ค้างชำระ", cost: outstanding },
        ],
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      currentMonth: { total: 0, services: [] },
    });
  }
}
