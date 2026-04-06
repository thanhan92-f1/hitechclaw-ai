# Contributing to HiTechClaw AI

Thanks for considering a contribution. HiTechClaw AI is the AI governance platform — built for small teams and agency owners who run real agents in production.

Before contributing, review [LICENSE](LICENSE), [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md), [SUPPORT.md](SUPPORT.md), and [SECURITY.md](SECURITY.md). This repository is source-available under a non-commercial license model, so contribution proposals and downstream usage should remain consistent with those terms.

## How to contribute

### Reporting bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Docker version, browser)

### Suggesting features

Open an issue with the `feature-request` label. Explain the problem you're solving, not just the feature you want. "I need a way to stop an agent mid-run from my phone" is better than "add a mobile kill switch."

### Asking questions or requesting help

Use [GitHub Discussions](https://github.com/thanhan92-f1/hitechclaw-ai/discussions) for usage questions, architecture discussion, setup help, and idea validation. Use [SUPPORT.md](SUPPORT.md) when you need the full routing guide.

### Submitting code

1. Fork the repo
2. Create a branch: `git checkout -b fix/your-fix-name`
3. Make your changes
4. Prepare local dev/test infrastructure:
	- `Copy-Item .env.development.example .env.local`
	- `Copy-Item .env.test.example .env.test.local`
	- `npm install`
	- `npm run dev:up`
	- `npm run test:setup`
5. Run local verification:
	- `npm run check:local`
	- `npm run check:local:api` / `check:local:ui` / `check:local:mobile` / `check:local:edge` when you only need one suite slice
	- `npm run check:pre-push` for a stronger gate before pushing
	- `npm run check:pre-push:api` / `check:pre-push:ui` / `check:pre-push:mobile` / `check:pre-push:edge` for focused pre-push verification
6. Optional: install the tracked Git hook template with `npm run hooks:install`
	- the hook defaults to `npm run check:pre-push`
	- for temporary local focus you can set `HITECHCLAW_PRE_PUSH_COMMAND=check:pre-push:api` (or `:ui`, `:mobile`, `:edge`) before pushing
7. Commit with a clear message: `fix: prevent duplicate threat alerts within cooldown window`
8. Open a PR against `main`

### Local workflow

For the full local development workflow, see [docs/development.md](docs/development.md).

Recommended commands:

- `npm run dev:up` — start local dev database and run migrations
- `npm run dev` — start the Next.js app locally
- `npm run test:setup` — start and migrate the isolated test database
- `npm run test:e2e:managed` — run Playwright with managed app startup
- `npm run test:e2e:api` / `test:e2e:ui` / `test:e2e:mobile` / `test:e2e:edge` — run one categorized Playwright slice
- `npm run test:e2e:ci-local` — reset and run a CI-like local test pass
- `npm run check:local:api` / `check:local:ui` / `check:local:mobile` / `check:local:edge` — lint + one focused Playwright slice
- `npm run check:pre-push` — full local gate before pushing
- `npm run clean:all` — remove local DBs and generated artifacts

### Git hooks

This repository includes a tracked `.githooks/pre-push` template.

To enable it for your local clone:

```powershell
npm run hooks:install
```

The hook runs `npm run check:pre-push` before every push.

If you need a temporary focused gate for one categorized suite slice, set `HITECHCLAW_PRE_PUSH_COMMAND` to one of:

- `check:pre-push`
- `check:pre-push:api`
- `check:pre-push:ui`
- `check:pre-push:mobile`
- `check:pre-push:edge`

### Commit messages

Use conventional commits:
- `fix:` — bug fixes
- `feat:` — new features
- `docs:` — documentation changes
- `refactor:` — code changes that don't fix bugs or add features
- `chore:` — maintenance, dependencies, tooling

### Code style

- TypeScript for all new code
- Follow existing patterns in the codebase
- Keep components focused — one responsibility per file
- API routes go in `src/app/api/`
- Shared logic goes in `src/lib/`

## What we're looking for

Check the [issues](../../issues) for things tagged `good-first-issue` or `help-wanted`. High-impact areas:

- **SDK development** — Node.js and Python client libraries
- **Threat detection patterns** — new ThreatGuard regex patterns for emerging attack types
- **Workflow templates** — pre-built automation templates for common scenarios
- **Documentation** — guides, examples, translations
- **NemoClaw/OpenClaw integration** — deeper framework-specific features

## Code of conduct

Be direct, be helpful, be respectful. We're building tools for people who run AI agents in production — the stakes are real. Treat every contributor's time as valuable.

## Security and licensing reminders

- Do not open public issues for exploitable vulnerabilities. Follow [SECURITY.md](SECURITY.md).
- Keep licensing or commercial-rights questions out of bug reports when possible. Route them through [SUPPORT.md](SUPPORT.md) and the licensing documents.
- Ensure proposed changes remain consistent with the repository's non-commercial license model.

