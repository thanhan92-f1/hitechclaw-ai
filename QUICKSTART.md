# Quick Start

Get HiTechClaw AI running in 5 minutes. Three commands, one agent, one test event.

---

## 1. Start HiTechClaw AI

```bash
git clone https://github.com/thanhan92-f1/hitechclaw-ai.git && cd hitechclaw-ai
cp .env.example .env
docker compose up -d
```

Edit `.env` first — at minimum set `MC_ADMIN_TOKEN` to a passphrase you'll remember.

## 2. Run the Setup Wizard

Open **http://localhost:3000** in your browser.

The wizard walks you through:
- Creating your admin account
- Registering one or more agents (each gets its own API token)
- Choosing per-agent install mode: script, remote SSH deploy, or both
- Copying ready-made OpenClaw or NemoClaw setup instructions when you select those frameworks

Save the API token — you'll need it in the next step.

### OpenClaw / NemoClaw during setup

If you select **OpenClaw** or **NemoClaw** while registering agents, step 3 now gives you a full per-agent integration block:

- **OpenClaw**: paste `MC_INGEST_URL` and `MC_AGENT_TOKEN` into the agent `.env`, then restart the runtime.
- **NemoClaw**: paste the generated `telemetry.endpoint` and `telemetry.token` YAML block, then reload the runtime.

If you choose **Remote deploy** or **Remote + script**, the wizard can also attempt to write the config over SSH during setup. Each agent keeps separate tokens and config paths, so OpenClaw and NemoClaw can share one host without overwriting each other.

After that, use **Start Listening** or **Send Test Event** in the wizard to confirm telemetry is live.

## 3. Send a Test Event

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "message_sent", "agent": "my-agent", "content": "Hello world!"}'
```

Go back to the dashboard — your event appears in the activity feed.

---

## What You'll See

After the test event:
- **Dashboard** shows 1 agent, 1 event, health score
- **Activity** page shows the event with timestamp and type badge
- **Agents** page shows your agent card with last-active status

## What's Next

| Want to... | Go to... |
|-----------|----------|
| Connect a real agent | [API.md](API.md) — full integration guide |
| Set up threat detection | ThreatGuard page — automatic, starts scanning on first event |
| Track costs | Costs page — add `tokens` and `model` to event metadata |
| Automate operations | Workflows page — start with a template |
| Monitor servers | [INSTALL.md](INSTALL.md#step-6-add-server-monitoring-optional) — push-based reporting |
| Set budget alerts | Admin Panel — configure budget limits per tenant |
| Get notifications | Settings > Notifications — add Telegram, Slack, Discord, email, or webhook |

## Adding Token & Model Data

To get cost tracking working, include `tokens` and `model` in your event metadata:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message_sent",
    "agent": "my-agent",
    "content": "Processed customer request",
    "metadata": {
      "model": "claude-sonnet-4-6",
      "tokens": 1250,
      "input_tokens": 800,
      "output_tokens": 450
    }
  }'
```

## Need Help?

- Press **?** on any page in HiTechClaw AI for contextual help
- See [INSTALL.md](INSTALL.md) for the full installation guide
- See [API.md](API.md) for the complete API reference
- See [SUPPORT.md](SUPPORT.md) for issue, Discussion, security, and licensing routes
- See [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for usage terms
