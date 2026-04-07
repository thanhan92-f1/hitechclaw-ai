import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { DocStore } from "@hitechclaw/doc-mcp/doc-store";
import { parseInteger, unauthorized, validateAdmin } from "../../_utils";

function loadStore() {
  const store = new DocStore(join(process.cwd(), "docs"));
  store.loadAll();
  return store;
}

export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) return unauthorized();

  try {
    const store = loadStore();
    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const document = store.getDoc(id);
      if (!document) {
        return NextResponse.json({ error: "Repository doc not found" }, { status: 404 });
      }

      return NextResponse.json(document);
    }

    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const category = req.nextUrl.searchParams.get("category")?.trim() ?? "all";
    const limit = Math.min(parseInteger(req.nextUrl.searchParams.get("limit"), 12), 50);

    const items = search
      ? store.search(search, limit).map((result) => ({
          ...result.doc,
          snippet: result.snippet,
          score: result.score,
        }))
      : store
          .listDocs(category !== "all" ? category : undefined)
          .slice(0, limit)
          .map((doc) => ({
            ...doc,
            snippet: doc.content.slice(0, 220),
            score: null,
          }));

    return NextResponse.json({
      items,
      stats: store.getStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[tools/docs/library] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}