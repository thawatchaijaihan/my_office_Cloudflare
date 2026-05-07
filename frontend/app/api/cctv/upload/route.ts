import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const cameraId = formData.get("cameraId") as string;

    if (!file || !cameraId) {
      return NextResponse.json(
        { error: "Missing file or cameraId" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save path: public/uploads/cameras/[cameraId]/latest.jpg
    const uploadDir = join(process.cwd(), "public", "uploads", "cameras", cameraId);
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileName = "latest.jpg";
    const filePath = join(uploadDir, fileName);
    
    await writeFile(filePath, buffer);

    // Return the public URL
    // We use a relative URL or absolute based on environment
    const publicUrl = `/uploads/cameras/${cameraId}/${fileName}?t=${Date.now()}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("[Upload API] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
