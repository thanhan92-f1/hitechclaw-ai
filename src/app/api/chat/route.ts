import { type NextRequest, NextResponse } from "next/server";
import { proxyChatRequest } from "./_proxy";

export async function POST(req: NextRequest) {
  return proxyChatRequest(req);
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}