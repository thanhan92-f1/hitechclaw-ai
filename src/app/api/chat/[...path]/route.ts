import { type NextRequest } from "next/server";
import { proxyChatRequest } from "../_proxy";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyChatRequest(req, path);
}

export async function GET(req: NextRequest, context: RouteContext) {
  return handle(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handle(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return handle(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return handle(req, context);
}