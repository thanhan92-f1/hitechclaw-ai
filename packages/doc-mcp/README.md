# @hitechclaw/doc-mcp

MCP Server cho kho tài liệu developer của HiTechClaw platform. Khi VS Code AI (Copilot, Claude, etc.) code, nó sẽ tự động gọi MCP server này để tìm tài liệu liên quan trong kho.

## Architecture

```
data/dev-docs/           ← Kho tài liệu (Markdown files)
├── conventions/         ← Coding conventions & patterns
├── architecture/        ← Architecture decisions
├── guides/              ← How-to guides
├── api/                 ← API documentation
├── troubleshooting/     ← Common issues & fixes
└── examples/            ← Code examples

packages/doc-mcp/        ← MCP Server  
├── src/
│   ├── server.ts        ← MCP server + tools
│   ├── doc-store.ts     ← Document indexing & search engine
│   ├── bin.ts           ← Standalone entry point
│   └── index.ts         ← Barrel export
```

## MCP Tools

| Tool | Mô tả |
|------|--------|
| `search_docs` | Full-text search tài liệu theo keyword/câu hỏi |
| `get_doc` | Lấy full nội dung document theo ID |
| `list_doc_categories` | Duyệt danh mục tài liệu |
| `list_docs` | Liệt kê documents trong 1 category |

## VS Code Integration

Đã cấu hình sẵn trong `.vscode/mcp.json`:

```json
{
    "servers": {
        "hitechclaw-dev-docs": {
            "type": "stdio",
            "command": "npx",
            "args": ["tsx", "packages/doc-mcp/src/bin.ts"],
            "env": {
                "DOCS_ROOT": "${workspaceFolder}/data/dev-docs"
            }
        }
    }
}
```

VS Code sẽ tự động khởi động MCP server khi mở workspace. AI agents có thể:

1. **search_docs** "gateway route pattern" → Tìm conventions về cách viết API routes
2. **get_doc** "conventions/typescript" → Đọc full conventions về TypeScript
3. **list_doc_categories** → Xem có những loại tài liệu nào

## CLI Commands

```bash
# Initialize dev-docs directory
npm run cli -- docs init

# List all docs
npm run cli -- docs list

# List docs in category
npm run cli -- docs list conventions

# Search docs
npm run cli -- docs search "drizzle schema"

# Add new doc
npm run cli -- docs add api/sessions "Sessions API" --tags api,sessions,rest
```

## Adding Documentation

1. Tạo file `.md` trong `data/dev-docs/<category>/`:

```markdown
---
tags: [tag1, tag2]
---

# Document Title

Content here...
```

1. MCP server tự động index khi nhận request (hot-reload).

## Running Standalone

```bash
# Via tsx (development)
DOCS_ROOT=./data/dev-docs npx tsx packages/doc-mcp/src/bin.ts

# Via compiled (production)
npm run build -w packages/doc-mcp
DOCS_ROOT=./data/dev-docs node packages/doc-mcp/dist/bin.js
```
