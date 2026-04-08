# GitHub Governance and Repository Automation

This document explains how the repository's GitHub automation is structured, why each workflow exists, and how maintainers should operate it.

---

## Goals

The `.github` automation in HiTechClaw AI is designed to enforce five outcomes:

1. **Protect code quality** with repeatable CI, smoke coverage, regression checks, and image validation.
2. **Improve security posture** with CodeQL and better issue/report intake around sensitive changes.
3. **Standardize repository operations** through labels, triage rules, stale handling, and dependency maintenance.
4. **Raise contribution quality** with stronger issue and PR templates plus automated governance checks.
5. **Improve contributor experience** by providing a clearer support path for questions, Discussions, and first-time contributions.

---

## Workflow Inventory

### Delivery and quality

| Workflow | File | Purpose |
| --- | --- | --- |
| Continuous Integration | `.github/workflows/ci.yml` | Lint, build, smoke test, categorized regression, and optional manual cross-browser validation. |
| CodeQL Security Analysis | `.github/workflows/codeql.yml` | Perform CodeQL scanning for JavaScript and TypeScript code on demand. |
| Docker Package Publish | `.github/workflows/docker-publish.yml` | Publish signed multi-arch GHCR images only when maintainers manually dispatch the workflow. |
| Release and Delivery | `.github/workflows/release.yml` | Verify release candidates, create GitHub Releases, and optionally publish signed containers when explicitly requested. |
| Publish npm SDK | `.github/workflows/npm-publish.yml` | Build and publish `@hitechclaw-ai/sdk` to npmjs on `sdk-v*.*.*` tags or manual dispatch. |
| Self-Hosted Runner Setup Guide | `.github/workflows/runner-setup.yml` | Publish the expected Windows runner labels, prerequisites, and validation checklist into the workflow summary. |

The SDK publish workflow is intentionally strict: the Git tag version and `packages/sdk/package.json` version must already match before publication begins.

### Maintenance and governance

| Workflow | File | Purpose |
| --- | --- | --- |
| Dependency and Repository Maintenance | `.github/workflows/maintenance.yml` | Triage Dependabot PRs and run dependency health reports on demand. |
| Dependabot Auto-Merge | `.github/workflows/dependabot-automerge.yml` | Enable auto-merge for approved low-risk Dependabot PRs after required checks pass. |
| Workflow Lint | `.github/workflows/workflow-lint.yml` | Validate GitHub workflow syntax and semantics with `actionlint` whenever automation files change. |
| Repository Label Synchronization | `.github/workflows/labels.yml` | Keep repository labels synchronized from source-controlled YAML. |
| Issue and Pull Request Triage | `.github/workflows/triage.yml` | Apply labels based on content and changed paths. |
| Stale Issue and Pull Request Management | `.github/workflows/stale.yml` | Run stale cleanup manually when maintainers explicitly choose to do so. |
| Pull Request Quality Gate | `.github/workflows/pr-quality.yml` | Enforce PR description completeness and governance checklist coverage. |
| Issue Governance and Intake Quality | `.github/workflows/issue-governance.yml` | Guide reporters toward actionable, reproducible, well-scoped issues. |
| Community Health and First Interaction | `.github/workflows/community-health.yml` | Welcome first-time contributors and steer support traffic toward Discussions. |

---

## Metadata and Template Files

| File | Purpose |
| --- | --- |
| `.github/labels.yml` | Source of truth for repository labels. |
| `.github/labeler.yml` | Path-based label mapping for pull requests. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Structured PR template with validation, risk, and rollback expectations. |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | Bug intake form with severity, area, environment, and impact fields. |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | Feature request form with priority, user value, and acceptance criteria. |
| `.github/ISSUE_TEMPLATE/config.yml` | Routes support, security, install, and API questions to the correct channels. |
| `.github/CODEOWNERS` | Maintainer ownership rules. |

---

## Maintainer Operating Model

### 1. Triage flow

- New issues should arrive with `needs-triage` plus one or more topic labels.
- New pull requests should receive path-based labels and semantic labels from the PR body.
- Maintainers should remove or replace `needs-triage` once the item has an owner and next action.

### 2. Security handling

- Public security issues should be redirected to GitHub Security Advisories.
- Labels such as `security` and workflows such as `issue-governance.yml` help highlight sensitive reports early.
- Stale automation excludes `security`, `blocked`, and `pinned` items.

### 3. Dependency handling

- Patch and minor Dependabot PRs are candidates for auto-approval and auto-merge.
- Major updates should be reviewed manually and typically retain the `major-update` label.
- Auto-merge is enabled only for Dependabot-authored patch and minor updates, and completion still depends on branch protection plus required checks.
- Dependency reports should be run on demand and reviewed for recurring audit findings and outdated packages.
- Stale cleanup is manual-only in the cost-controlled setup so unattended repository churn is avoided.

### 4. Pull request quality expectations

Every pull request should explain:

- what changed,
- why it changed,
- scope and impact,
- how it was validated,
- what risk it introduces,
- how it can be rolled back if needed.

If the PR quality check fails, the author should update the PR body instead of bypassing the workflow.

### 5. Community handling

- Questions and general support should be moved to Discussions whenever possible.
- Confirmed bugs and scoped feature requests should stay in Issues.
- First-time contributors should receive a welcome response automatically.

---

## Required Repository Settings

To make the automation fully effective, maintainers should verify these repository settings:

1. **Actions permissions** allow workflows to write pull request comments, labels, and issue comments.
2. **GitHub Container Registry publishing** is allowed for `GITHUB_TOKEN` if `release.yml` or `docker-publish.yml` publishes images, and maintainers should confirm the resulting container package visibility matches the repository's intended public or inherited access.
3. **OIDC token access** is available to workflows that sign containers keylessly with Sigstore/Cosign.
4. **npm automation secret** stores a valid `NPM_TOKEN` with publish rights for `@hitechclaw-ai/sdk`.
5. **Branch protection** requires at least the key checks from `ci.yml`, `codeql.yml`, and `pr-quality.yml` before merge.
6. **Auto-merge** is enabled if maintainers want the Dependabot automation to merge low-risk PRs.
7. **Discussions** is enabled, because issue intake and community routing now depend on it.
8. **Security Advisories** is enabled so private vulnerability reports can be filed correctly.

Consumers who deploy the published GHCR images should verify signatures and attestations before promotion. The concrete `cosign verify` and `cosign verify-attestation` examples are documented in `INSTALL.md`. Maintainers should also verify that newly published images are visible from the GitHub `Packages` UI after the first successful publish on `main`.

In the cost-controlled setup, GHCR publication is no longer automatic on `main`. Maintainers should manually dispatch `docker-publish.yml` or enable `publish_container` in `release.yml` only when a new image is actually required.

---

## Trigger and Permission Hardening

The repository intentionally splits workflow triggers by trust boundary:

- `pull_request` should remain the default for jobs that execute contributor code, build the application, or run tests.
- `pull_request_target` is reserved for metadata-only automation that needs elevated repository permissions, such as triage, Dependabot approval, or enabling auto-merge.
- manual workflows are used for maintenance, reporting, release, runner onboarding, and optional deep validation when cost control is the priority.

For every workflow that uses `pull_request_target`:

- do not check out or execute the pull request head revision,
- keep permissions minimal and explicit,
- gate privileged behavior by trusted actors such as `dependabot[bot]`,
- prefer label/comment/API mutations over shell execution.

The current `triage.yml`, `maintenance.yml`, and `dependabot-automerge.yml` workflows follow this model. Any future privileged automation should preserve the same restrictions.

---

## Suggested Required Status Checks

At minimum, branch protection on `main` should require:

- `Lint and build application`
- `Smoke test critical APIs and UI flows`
- `Validate pull request body quality`
- `Analyze JavaScript / TypeScript attack surface`
- `Apply pull request labels`

For stricter governance, also require:

- `Full Playwright regression suite` on protected release branches or manual validation gates
- `Cross-browser UI regression` for branches that gate release readiness

For repository rules that specifically protect automation changes, also require:

- `Validate GitHub workflow definitions`

---

## Self-Hosted Runner Model

The repository now targets a fully self-hosted runner model for GitHub Actions execution so routine automation does not consume GitHub-hosted runner minutes, and scheduled automation plus artifact transfer is intentionally minimized to reduce unnecessary cost.

All workflows currently expect these labels on the Windows runner:

- `self-hosted`
- `windows`
- `x64`
- `hitechclaw`

The self-hosted host must also provide Docker Buildx, Linux container support, Cosign, Node.js 25, and Playwright browser dependencies because governance, release, and runtime workflows now share the same runner pool.

See `docs/self-hosted-runners.md` for the bootstrap checklist, host baseline, and post-registration validation flow.

---

## How to Extend This System

When adding new automation:

1. Prefer source-controlled configuration over repository-only manual settings.
2. Keep workflow names clear enough to become required status checks.
3. Keep contributor messaging direct, actionable, and professional.
4. Update this document whenever a new workflow, label family, or governance rule is introduced.
5. Validate every new workflow file before merging.

The repository now enforces this through `workflow-lint.yml`, which runs `actionlint` on pull requests and pushes that modify GitHub automation files.

---

## Summary

The current GitHub governance layer turns the repository into a more controlled engineering surface:

- delivery is validated,
- releases are structured,
- low-risk maintenance is automated,
- issue and PR quality are enforced,
- contributor routing is clearer,
- maintainers get a more predictable operating model.

If this governance model changes, update both the workflow files and this document in the same pull request.