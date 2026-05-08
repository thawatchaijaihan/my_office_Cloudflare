import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    const { results } = await env.DB.prepare('SELECT * FROM personnel ORDER BY id ASC').all();
    const rows = results.map((r: any) => ({
      rank: r.rank,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      bank: r.bank,
      accountNumber: r.account_number,
      citizenId: r.citizen_id,
      militaryId: r.military_id,
      duty: r.duty,
      position: r.position,
      unit: r.unit,
      birthplace: r.birthplace,
      birthDate: r.birth_date,
      registeredDate: r.registered_date,
      enlistmentDate: r.enlistment_date,
      rankDate: r.rank_date,
      salary: r.salary,
      age: r.age,
      retireYear: r.retire_year
    }));
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
