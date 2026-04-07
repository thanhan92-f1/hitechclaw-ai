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
| Continuous Integration | `.github/workflows/ci.yml` | Lint, build, smoke test, full regression, and Docker image validation. |
| CodeQL Security Analysis | `.github/workflows/codeql.yml` | Perform CodeQL scanning for JavaScript and TypeScript code. |
| Release and Delivery | `.github/workflows/release.yml` | Verify release candidates, build release bundles, publish signed containers, and create GitHub Releases. |
| Publish npm SDK | `.github/workflows/npm-publish.yml` | Build and publish `@hitechclaw-ai/sdk` to npmjs on `sdk-v*.*.*` tags or manual dispatch. |

The SDK publish workflow is intentionally strict: the Git tag version and `packages/sdk/package.json` version must already match before publication begins.

### Maintenance and governance

| Workflow | File | Purpose |
| --- | --- | --- |
| Dependency and Repository Maintenance | `.github/workflows/maintenance.yml` | Triage Dependabot PRs, auto-approve low-risk updates, and produce dependency health reports. |
| Repository Label Synchronization | `.github/workflows/labels.yml` | Keep repository labels synchronized from source-controlled YAML. |
| Issue and Pull Request Triage | `.github/workflows/triage.yml` | Apply labels based on content and changed paths. |
| Stale Issue and Pull Request Management | `.github/workflows/stale.yml` | Mark inactive items stale and close them after policy-defined windows. |
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
- Weekly dependency reports should be reviewed for recurring audit findings and outdated packages.

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

---

## Suggested Required Status Checks

At minimum, branch protection on `main` should require:

- `Lint and build application`
- `Smoke test critical APIs and UI flows`
- `Validate pull request body quality`
- `Analyze JavaScript / TypeScript attack surface`

For stricter governance, also require:

- `Validate Docker production image`
- `Full Playwright regression suite` on protected release branches or scheduled validation gates

---

## How to Extend This System

When adding new automation:

1. Prefer source-controlled configuration over repository-only manual settings.
2. Keep workflow names clear enough to become required status checks.
3. Keep contributor messaging direct, actionable, and professional.
4. Update this document whenever a new workflow, label family, or governance rule is introduced.
5. Validate every new workflow file before merging.

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