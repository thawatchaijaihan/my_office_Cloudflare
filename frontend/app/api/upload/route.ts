import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.BUCKET) return NextResponse.json({ error: "No BUCKET" }, { status: 500 });

    const body = await request.formData();
    const file = body.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const filename = `${Date.now()}-${file.name}`;
    await env.BUCKET.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    
    return NextResponse.json({ url: `/api/files/${filename}`, filename });
  } catch (e: any) {
    console.error("[Upload API] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
