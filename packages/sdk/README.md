# @hitechclaw-ai/sdk

Official JavaScript SDK for sending agent events to HiTechClaw AI.

## Install

```bash
npm install @hitechclaw-ai/sdk
```

## Usage

```ts
import { HiTechClawAI } from "@hitechclaw-ai/sdk";

const client = new HiTechClawAI({
  baseUrl: "https://your-hitechclaw-ai-url",
  token: "YOUR_AGENT_TOKEN",
});

await client.track("message_sent", {
  agent_id: "my-agent",
  content: "Hello from my agent!",
  metadata: {
    model: "claude-sonnet-4-6",
    tokens: 150,
  },
});
```

## Local validation

```bash
npm run build:sdk
npm run test:sdk
```

## Troubleshooting

- **`TypeError: fetch is not defined`**
  - Use Node.js 18+ or provide a custom `fetch` implementation when creating `HiTechClawAI`.
- **`401` or `403` from `/api/ingest`**
  - Confirm the bearer token is valid for the target HiTechClaw AI environment.
  - Verify `baseUrl` points to the correct deployment and does not include a trailing `/api/ingest` path.
- **Events accepted locally but not in production**
  - Recheck production `baseUrl`, network egress rules, reverse-proxy settings, and agent token scope.
- **Need deterministic production installs**
  - Pin an exact package version instead of using a floating range.

## Publish

Maintainers can publish through the repository workflow `.github/workflows/npm-publish.yml` using an `sdk-v*.*.*` tag and an `NPM_TOKEN` secret.

Before tagging, make sure `packages/sdk/package.json` already contains the exact version you plan to publish.

```bash
npm run check:sdk-version -- 0.1.0
git tag sdk-v0.1.0
git push origin sdk-v0.1.0
```

The publish workflow uses npm provenance, so consumers can verify the package origin from GitHub Actions in the npm UI and registry metadata.

For stricter consumption, prefer pinned versions such as:

```bash
npm install @hitechclaw-ai/sdk@0.1.0
```

Package-specific release notes are tracked in [`CHANGELOG.md`](./CHANGELOG.md).

## License

Source-available under the repository license. Review `LICENSE`, `NOTICE`, and `COMMERCIAL-LICENSE.md` in the repository before use or redistribution.
