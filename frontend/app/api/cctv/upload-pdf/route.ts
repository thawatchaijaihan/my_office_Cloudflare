import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadDir = path.join(process.cwd(), "public/uploads/reports");

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `report-${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);

        // Also update a "latest" pointer
        const latestPath = path.join(uploadDir, "latest.json");
        fs.writeFileSync(latestPath, JSON.stringify({
            url: `/uploads/reports/${fileName}`,
            generatedAt: new Date().toISOString()
        }));

        return NextResponse.json({ 
            url: `/uploads/reports/${fileName}`,
            message: "PDF uploaded successfully" 
        });
    } catch (error) {
        console.error("PDF upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const latestPath = path.join(process.cwd(), "public/uploads/reports/latest.json");
        if (fs.existsSync(latestPath)) {
            const data = fs.readFileSync(latestPath, "utf-8");
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json({ error: "No report found" }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
