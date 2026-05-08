import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  // Empty billing data as in old backend
  return NextResponse.json({
    currentMonth: {
      total: 0,
      services: [],
    },
  });
}
