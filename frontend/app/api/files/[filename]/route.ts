import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
  try {
    const filename = params.filename;
    const env = getRequestContext().env as any;
    if (!env.BUCKET) return new Response("No BUCKET", { status: 500 });

    const file = await env.BUCKET.get(filename);

    if (!file) return new Response('Not Found', { status: 404 });

    const headers = new Headers();
    file.writeHttpMetadata(headers as any);
    headers.set('etag', file.httpEtag);

    return new Response(file.body as any, {
      headers,
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
}
