import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const env = getRequestContext().env as any;
    if (!env.BUCKET) return NextResponse.json({ error: "No BUCKET" }, { status: 500 });

    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const filename = `report-${Date.now()}-${file.name}`;
    await env.BUCKET.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    
    return NextResponse.json({ url: `/api/files/${filename}` });
  } catch (error: any) {
    console.error("PDF upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Return empty initially for the usePdfReport check hook
  return NextResponse.json({ url: null }, { status: 200 });
}
