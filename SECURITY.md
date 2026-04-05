# Security Policy

HiTechClaw AI includes governance, authentication, proxying, workflow execution, and infrastructure monitoring features. Because the product can handle sensitive operational data, security reports should follow the private disclosure path below.

---

## Reporting a Vulnerability

Please **do not** open public GitHub issues for exploitable vulnerabilities.

Instead, use one of these channels:

1. Open a private GitHub Security Advisory draft for this repository.
2. If advisory access is unavailable, contact the repository owner through the private licensing or business contact channel already established for the project.

When reporting a vulnerability, include:

- affected version, commit, container tag, or deployment revision
- affected area such as authentication, RBAC, threat detection, MCP proxy, workflows, or infrastructure reporting
- reproduction steps or proof of concept
- expected impact
- any mitigations or temporary workarounds already identified

---

## Scope

Security-sensitive areas include, but are not limited to:

- authentication and session handling
- CSRF enforcement
- RBAC and tenant isolation
- API key generation and storage
- secret redaction and leak detection
- workflow execution and outbound HTTP actions
- MCP proxy authentication and routing
- infrastructure collection and remote reporting
- notification integrations and webhook delivery

---

## Response Expectations

The project will attempt to:

- acknowledge a valid private report as quickly as practical
- assess severity and affected versions
- prepare a fix or mitigation plan
- coordinate disclosure timing when a fix is available

No formal SLA is promised in this repository, but reports that are clear, reproducible, and privately disclosed are easier to handle quickly.

---

## Disclosure Expectations

Please give the maintainer reasonable time to validate and address the issue before any public disclosure.

If the report turns out not to be a vulnerability but instead a support problem or configuration mistake, it may be redirected to Discussions or standard issue intake after review.

---

## Hardening Guidance for Operators

For self-hosted deployments, operators should at minimum:

- set strong values for `MC_ADMIN_TOKEN` and `NEXTAUTH_SECRET`
- use TLS in front of the application
- keep Docker base images and dependencies current
- review workflow actions that can trigger outbound requests
- protect database backups and infrastructure credentials
- restrict access to administrative endpoints and notification secrets

Also review:

- [`INSTALL.md`](INSTALL.md)
- [`API.md`](API.md)
- [`docs/github-governance.md`](docs/github-governance.md)

---

## Supported Versions

This repository currently documents security handling for the active `main` branch and the latest published release artifacts. Older forks, modified downstream deployments, and unofficial images may require separate validation by their operators.