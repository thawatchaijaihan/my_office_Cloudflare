import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    
    const body = await request.json() as any;
    await env.DB.prepare("UPDATE pass_requests SET status_n = 'รับบัตรเรียบร้อย', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.rowNumber).run();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
