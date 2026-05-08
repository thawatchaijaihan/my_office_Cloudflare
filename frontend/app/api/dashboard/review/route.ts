import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });

    const { results } = await env.DB.prepare(`SELECT * FROM pass_requests ORDER BY id DESC`).all();

    const rows = results.map((r: any) => ({
      rowNumber: r.id,
      registeredAt: r.timestamp,
      rank: r.rank,
      firstName: r.first_name,
      lastName: r.last_name,
      name: `${r.rank || ''}${r.first_name || ''} ${r.last_name || ''}`.trim(),
      requestFor: r.relation,
      vehicleOwner: r.relation,
      vehicleType: r.vehicle_type,
      vehicleModel: r.vehicle_model,
      vehicleColor: r.vehicle_color,
      plate: r.plate,
      phone: r.phone,
      note: r.approved_pass_number || "",
      paymentStatus: r.status_m,
      approvalStatus: r.status_n,
      checkedAt: r.updated_at,
      columnP: r.approved_pass_number || "",
    }));

    return NextResponse.json({ rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
