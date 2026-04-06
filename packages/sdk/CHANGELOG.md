# Changelog

All notable changes to `@hitechclaw-ai/sdk` are documented in this file.

The format is based on Keep a Changelog and the package follows Semantic Versioning.

## [0.1.0] - 2026-04-07

### Added
- Initial public release of `@hitechclaw-ai/sdk`.
- `HiTechClawAI` client for authenticated event delivery to `/api/ingest`.
- `track()` helper for common event submission flows.
- `send()` method for direct payload delivery.
- Dual-package build output for ESM, CommonJS, and TypeScript declarations.
- Local validation coverage with package tests and smoke checks.
- GitHub Actions publishing flow with version guard, npm provenance, and release summary.

### Notes
- Publish tags must follow the `sdk-vX.Y.Z` format.
- The published package version must already match `packages/sdk/package.json` before release.
- Consumers should prefer pinned installs for controlled production rollouts.

[0.1.0]: https://github.com/thanhan92-f1/hitechclaw-ai/releases/tag/sdk-v0.1.0
