---
title: "Dobby — Reference"
type: technical
tags: [dobby, openclaw, ai-assistant, telegram, claude, architecture, home-lab]
created: 2026-03-29
updated: 2026-03-29
status: evergreen
summary: "Component locations, workspace files, secrets, config paths, and quick-reference commands for Dobby / OpenClaw."
related: ["[[dobby-explained]]", "[[networking-concepts-explained]]", "[[pihole-reference]]"]
---

## Overview

**What:** Dobby is a personal AI assistant built on OpenClaw, running as a macOS LaunchAgent on your Mac. It listens via Telegram, reasons via Claude, and executes on the Pi via SSH.
**Why:** Always-on monitoring and on-demand control of the Pi home lab without needing to SSH in manually.
**Mental model:** OpenClaw polls Telegram for messages (like checking email), asks Claude what to do, runs the allowed commands, and replies. Your Mac never exposes a port — all traffic is outbound.

> [!NOTE]
> See [[dobby-explained]] for the full message flow, the control tower analogy, and why the polling model means no open ports are needed.

---

## Architecture

```mermaid
flowchart LR
    subgraph cloud["Cloud"]
        TG[Telegram Servers\n@dobbywizard_bot]
        CL[Claude API\napi.anthropic.com]
        BQ[BigQuery\nkairon-491223.kairon.trades]
    end

    subgraph mac["Your Mac"]
        OC[OpenClaw Gateway\n127.0.0.1:18789\nmacOS LaunchAgent]
        WS[Workspace Files\n~/.openclaw/workspace/]
        CFG[Config\n~/.openclaw/openclaw.json]
    end

    subgraph pi["Pi 192.168.1.45"]
        SSH[SSH\nid_ed25519_pi]
        KC[Kairon Containers\nkairon-btc-1\nkairon-hbar-1]
        SVC[influxdb\ngrafana\npihole]
    end

    OC -->|polls| TG
    OC -->|POST /v1/messages| CL
    CL -->|tool calls| OC
    OC -->|ssh pi "..."| SSH
    SSH --> KC & SVC
    OC -->|bq query| BQ
    OC -->|sendMessage| TG
    OC -->|reads every session| WS
```

---

## How It Works

### OpenClaw Gateway

The Gateway is the always-on process. It runs as a macOS LaunchAgent — starts on login, restarts on crash.

- Binds to `127.0.0.1:18789` — loopback only, unreachable from the network
- Polls Telegram every few seconds via `GET /getUpdates`
- On new message: reads workspace files → calls Claude → executes tool calls → sends reply
- Manages the heartbeat cron scheduler

### Claude — Two Models, Two Jobs

| Job | Model | Why |
|---|---|---|
| Conversations (on-demand) | `claude-sonnet-4-6` | Quality — handles nuance, context, reasoning |
| Heartbeat (every 6 hours) | `claude-haiku-4-5` | Cost — structured check, no complex reasoning needed |

### SSH Tool

OpenClaw SSHes into the Pi using a dedicated key. Commands must be on the explicit allowlist in `TOOLS.md` — Dobby cannot run arbitrary commands.

```bash
# OpenClaw executes commands like this:
ssh pi "cd ~/kairon && docker compose ps"
ssh pi "docker logs --tail=50 kairon-btc-1 2>&1 | grep -i error"
```

The Pi alias `pi` is defined in `~/.ssh/config` on the Mac pointing to `192.168.1.45`.

### BigQuery Tool

OpenClaw uses gcloud Application Default Credentials (ADC) already authenticated on the Mac. Queries go directly to Google Cloud — the Pi is not involved.

```bash
bq query --nouse_legacy_sql \
  'SELECT * FROM `kairon-491223.kairon.trades` ORDER BY timestamp DESC LIMIT 10'
```

---

## Key Decisions

| Decision | Why | Trade-off |
|---|---|---|
| Polling over webhooks | No open ports — Mac stays invisible to internet | Slight latency (few seconds) vs instant push |
| OpenClaw runs natively on Mac (not Docker) | Needs host-level access to run SSH + Docker commands | Must be managed as a LaunchAgent, not Compose |
| Haiku for heartbeats | Hundreds of heartbeats/month — cost savings are meaningful | Less reasoning capacity (sufficient for structured checks) |
| Dedicated SSH key for Dobby | Can revoke Dobby's Pi access independently of personal keys | One more key to manage |
| Command allowlist in TOOLS.md | Prevents Claude from running destructive commands autonomously | Must update TOOLS.md to grant new capabilities |
| Secrets in env vars, not config files | Config files committed to GitHub — env vars stay on machine | Slightly more setup friction |

---

## Reference

### Component Table

| Component | What it is | Where it lives | Config |
|---|---|---|---|
| OpenClaw Gateway | Always-on orchestration service | Mac — macOS LaunchAgent | `~/.openclaw/openclaw.json` |
| Telegram Bot | Interface — `@dobbywizard_bot` | Cloud — Telegram servers | Bot token in env var |
| Claude API | Reasoning engine | Cloud — `api.anthropic.com` | `~/.openclaw/agents/main/agent/auth-profiles.json` |
| Raspberry Pi | Runs all services — Kairon, InfluxDB, Grafana, Pi-hole | `192.168.1.45` (alias: `pi`) | `~/.ssh/config` |
| Kairon | Trading bot — two Docker containers | Pi — `~/kairon/` | `~/kairon/docker-compose.yml` |
| BigQuery | Trade data store — `trades` and `ticks` tables | GCP — `kairon-491223` | gcloud ADC on Mac |
| Heartbeat Cron | 6-hourly proactive check — silent if all clear | Mac — OpenClaw cron scheduler | `~/.openclaw/workspace/HEARTBEAT.md` |

---

### Workspace Files

All in `~/.openclaw/workspace/`. Read by Claude at the start of every session. Backed up to `git@github.com:jasmine-nguyen/openclaw`.

| File | Purpose | Edit when |
|---|---|---|
| `SOUL.md` | Dobby's personality — values, voice, sock references | Adjusting Dobby's communication style |
| `USER.md` | Everything about Jas — Pi setup, Kairon, preferences | Setup changes, new context to add |
| `TOOLS.md` | SSH access details + explicit allowed command list | Granting Dobby new SSH capabilities |
| `HEARTBEAT.md` | Scheduled check instructions — what to monitor, thresholds, when to alert | Changing monitoring scope or alert thresholds |
| `IDENTITY.md` | Dobby's name and agent configuration | Rarely |
| `AGENTS.md` | Multi-agent routing config | Rarely |

> [!WARNING]
> Editing `TOOLS.md` directly changes what commands Dobby is allowed to run. Editing `SOUL.md` changes Dobby's personality in the next conversation. These take effect immediately — no restart needed.

---

### Secrets

| Secret | Stored in | Notes |
|---|---|---|
| Telegram bot token | Env var: `$OPENCLAW_TELEGRAM_TOKEN` | Set in LaunchAgent plist or shell profile |
| Gateway auth token | Env var: `$OPENCLAW_GATEWAY_TOKEN` | — |
| Anthropic API key | `~/.openclaw/agents/main/agent/auth-profiles.json` | Gitignored |
| SSH key (Pi access) | `~/.ssh/id_ed25519_pi` | Gitignored — Dobby-specific key |
| GCloud credentials | `~/.config/gcloud/` (gcloud ADC) | Gitignored |

> [!WARNING]
> `openclaw.json`, `auth-profiles.json`, and `~/.ssh/` are all gitignored. **Never** commit these. Only workspace files and cron definitions are committed to GitHub.

---

### Security Model

**Locked down:**

- Gateway on `127.0.0.1` only — not reachable from the internet or LAN
- SSH key-based auth only — no passwords
- Dedicated SSH key (`id_ed25519_pi`) — separate from personal keys, independently revocable
- Explicit SSH command allowlist in `TOOLS.md`
- Telegram DM pairing — only approved users can trigger Dobby
- Secrets in env vars — never in committed config files

**Requires your explicit approval:**

- Restarting any container
- Any command not in `TOOLS.md`
- Modifying `docker-compose.yml` or `config.py`
- Running `docker system prune`
- Installing packages on the Pi
- Any network configuration changes

---

### Heartbeat — What It Checks

Runs every 6 hours. Uses `claude-haiku-4-5`. Silent if all clear; posts to Telegram if anything fails.

```bash
# 1. Container status
ssh pi "cd ~/kairon && docker compose ps"
# Checks: kairon-btc-1, kairon-hbar-1, influxdb, grafana, pihole all running?

# 2. Error scan (last 50 lines of each bot log)
ssh pi "docker logs --tail=50 kairon-btc-1 2>&1 | grep -i error"
ssh pi "docker logs --tail=50 kairon-hbar-1 2>&1 | grep -i error"

# 3. System health
ssh pi "df -h / | tail -1"           # Alert if disk > 80%
ssh pi "free -h | grep Mem"          # Alert if memory > 85%
ssh pi "vcgencmd measure_temp"       # Alert if CPU temp > 75°C

# 4. Trade loss check (BigQuery)
# Alert if: loss > 3% OR PnL < -$5 in recent trades
bq query --nouse_legacy_sql 'SELECT * FROM `kairon-491223.kairon.trades` ...'
```

---

### Quick Reference Commands

```bash
# Gateway management
openclaw tui                          # Open Dobby TUI on Mac
openclaw status                       # Check Gateway status
openclaw gateway restart              # Restart the Gateway
openclaw logs --follow                # View live Gateway logs

# Cron / heartbeat
openclaw cron list                    # List all cron jobs
openclaw cron run <job-id>            # Run a cron job manually
openclaw cron runs --id <job-id>      # Check cron run history

# Config
openclaw config get channels.telegram # Check Dobby's Telegram config

# Workspace backup
cd ~/.openclaw && git add . && git commit -m "update" && git push

# Manual Pi access (bypass Dobby)
ssh pi

# BigQuery — recent trades
bq query --nouse_legacy_sql \
  'SELECT * FROM `kairon-491223.kairon.trades` ORDER BY timestamp DESC LIMIT 10'
```

---

## Related

- [[dobby-explained]] — control tower analogy, full 11-step message flow, polling model, security model reasoning
- [[networking-concepts-explained]] — loopback / binding model — why `127.0.0.1` means the Gateway is invisible to the internet
- [[pihole-reference]] — one of the services Dobby's heartbeat monitors
