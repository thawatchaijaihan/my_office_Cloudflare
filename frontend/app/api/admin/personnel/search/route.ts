import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");
    if (!query) return NextResponse.json({ error: "Missing query q" }, { status: 400 });

    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });

    const likeQuery = `%${query}%`;
    const { results } = await env.DB.prepare(
      `SELECT * FROM personnel 
       WHERE first_name LIKE ? 
          OR last_name LIKE ? 
          OR military_id LIKE ? 
          OR phone LIKE ?
       LIMIT 100`
    )
      .bind(likeQuery, likeQuery, likeQuery, likeQuery)
      .all();
      
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
