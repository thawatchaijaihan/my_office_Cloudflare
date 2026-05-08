import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    const { results } = await env.DB.prepare('SELECT * FROM cameras ORDER BY name').all();
    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    
    const body = await request.json();
    const { id, name, description, lat, lng, type, status, lastCheckedImage, lastCheckedAt } = body;

    if (id) {
      // Update
      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push('name=?'); values.push(name); }
      if (description !== undefined) { updates.push('description=?'); values.push(description); }
      if (lat !== undefined) { updates.push('lat=?'); values.push(lat); }
      if (lng !== undefined) { updates.push('lng=?'); values.push(lng); }
      if (type !== undefined) { updates.push('type=?'); values.push(type); }
      if (status !== undefined) { updates.push('status=?'); values.push(status); }
      if (lastCheckedImage !== undefined) { updates.push('lastCheckedImage=?'); values.push(lastCheckedImage); }
      if (lastCheckedAt !== undefined) { updates.push('lastCheckedAt=?'); values.push(lastCheckedAt); }
      
      updates.push('updated_at=CURRENT_TIMESTAMP');
      values.push(id);

      await env.DB.prepare(`UPDATE cameras SET ${updates.join(', ')} WHERE id=?`).bind(...values).run();
      return NextResponse.json({ status: 'updated', id });
    } else {
      // Insert
      const result = await env.DB.prepare(
        `INSERT INTO cameras (name, description, lat, lng, type, status) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(name, description, lat, lng, type, status)
        .run();
      return NextResponse.json({ status: 'created', id: result.meta.last_row_id });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await env.DB.prepare(`DELETE FROM cameras WHERE id=?`).bind(id).run();
    return NextResponse.json({ status: "deleted" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
