# Self-Hosted GitHub Runners

This repository uses a mixed runner model:

- lightweight governance checks run on GitHub-hosted Linux runners
- lint, build, and Playwright-heavy validation run on a Windows self-hosted runner
- container publishing and release packaging run on GitHub-hosted Linux runners

---

## Required labels

The CI workflows expect the Windows runner to expose all of these labels:

- `self-hosted`
- `windows`
- `x64`
- `hitechclaw`

If any label is missing, the runtime validation jobs in `.github/workflows/ci.yml` will remain queued.

---

## Recommended host baseline

| Component | Recommendation |
| --- | --- |
| OS | Windows Server 2022 or Windows 11 |
| Runtime | Node.js 25.x |
| Package manager | npm 10+ |
| Shell | PowerShell 7+ available as `pwsh` |
| Containers | Docker Desktop or Docker Engine with Compose v2 |
| Browser tooling | Playwright browsers for Chromium, Firefox, WebKit |
| Service mode | Run the GitHub runner as a persistent Windows service |

---

## Bootstrap checklist

1. Create a dedicated service account for GitHub Actions.
2. Install the repository or organization self-hosted runner from GitHub settings.
3. Register these labels during configuration: `self-hosted`, `windows`, `x64`, `hitechclaw`.
4. Install Node.js 25 and verify `node -v` plus `npm -v`.
5. Install Docker and confirm `docker version` plus `docker compose version`.
6. Pre-install Playwright browsers with `npx playwright install chromium firefox webkit`.
7. Ensure the runner account can access Docker without interactive elevation prompts.
8. Keep enough free disk space for `.next`, Playwright artifacts, and Docker layers.

---

## Repository assumptions on the runner

The workflows currently assume the runner can execute all of the following successfully:

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm run test:setup`
- `npm run test:smoke:managed`
- `npm run test:clean`

The CI pipeline also creates these files from tracked templates before build and test steps:

- `.env.local` from `.env.development.example`
- `.env.test.local` from `.env.test.example`

---

## Validation after registration

After the runner is online, validate it with this order:

1. Run the `Self-Hosted Runner Setup Guide` workflow manually and confirm the summary matches the intended labels.
2. Run `Continuous Integration` on a branch that changes runtime code.
3. Verify `Lint and build application` starts on the self-hosted Windows runner.
4. Verify `Smoke test critical APIs and UI flows` completes and uploads artifacts.
5. Confirm the runner remains available for queued jobs after completion.

---

## Operational notes

- Use GitHub-hosted runners for release publishing, CodeQL, and governance checks.
- Keep the self-hosted runner focused on runtime validation to reduce toolchain drift.
- If labels or host requirements change, update both this document and `docs/github-governance.md` in the same pull request.
