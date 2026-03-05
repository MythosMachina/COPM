# Codex Operator Project Management System (COPM)

Operator platform for managing AI-driven software projects with lifecycle modules, documentation sync, and autonomous Codex execution.

## Usage Scope (Mandatory)

- This app is **DEV-only**.
- Do **not** expose COPM directly to the public internet.
- Run behind local/private network access only.
- `Codex CLI` must be installed and authenticated in **root context** on the host for stable agent operation.

## Important Integration Notice

This tool is designed to run in cooperation with:
- **Codex CLI (OpenAI)** for autonomous project execution
- **DomNexDomain** for automated domain provisioning and teardown  
  https://github.com/AsaTyr2018/DomNexDomain

## Core Capabilities

- Initial registration (`/register`): first account becomes `ADMIN`
- Project lifecycle engine (`BIRTH`, `CHANGE`, `FIX`, `ITERATE`, `TEARDOWN`, `DEPLOYED`)
- Autonomous agent runs with live status + stream logs
- Project-scoped API key workflow in web UI (`/dashboard/api-keys`)
- AGENTS export + AI kickstart endpoints
- Admin maintenance flow after deployment (`Add Module` for `CHANGE`/`FIX`)
- Documentation as source of truth in COPM (versioned docs)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- PostgreSQL + Prisma
- NextAuth (Credentials/JWT)
- Zod
- Vitest

## Runtime Components

- **Web app**: COPM UI + API
- **Agent worker**: polls projects, starts Codex runs, syncs lifecycle/doc evidence

Default app URL pattern:
- `http://<host>:<port>` (port is environment-controlled; often `3300`)

## Local Development

1. Copy `.env.example` to `.env` and set values.
2. Install deps: `npm install`
3. Start PostgreSQL.
4. Run DB setup: `npm run prisma:deploy && npm run prisma:generate`
5. Start app: `npm run dev`
6. Open `/register` and create initial admin.
7. Generate API keys under `/dashboard/api-keys`.

Optional:
- Port check script: `npm run ports:check`
- Start worker manually: `npm run agent:worker`

## Docker Compose (Required Variables)

Before running `docker compose up`, you must define all required `COPM_*` variables used by `docker-compose.yml`.
If any are missing, compose fails fast.

Required:
- `COPM_DATABASE_URL`
- `COPM_DATABASE_URL_TEST`
- `COPM_NEXTAUTH_SECRET`
- `COPM_NEXTAUTH_URL`
- `COPM_POSTGRES_USER`
- `COPM_POSTGRES_PASSWORD`
- `COPM_POSTGRES_DB`
- `COPM_POSTGRES_TEST_USER`
- `COPM_POSTGRES_TEST_PASSWORD`
- `COPM_POSTGRES_TEST_DB`

Example usage:
- `export COPM_POSTGRES_USER=postgres`
- `export COPM_POSTGRES_PASSWORD='<strong-random>'`
- `export COPM_POSTGRES_DB=codex_ops`
- `export COPM_POSTGRES_TEST_USER=postgres`
- `export COPM_POSTGRES_TEST_PASSWORD='<strong-random-test>'`
- `export COPM_POSTGRES_TEST_DB=codex_ops_test`
- `export COPM_DATABASE_URL='postgresql://postgres:<strong-random>@postgres:5432/codex_ops'`
- `export COPM_DATABASE_URL_TEST='postgresql://postgres:<strong-random-test>@postgres_test:5432/codex_ops_test'`
- `export COPM_NEXTAUTH_SECRET='<64+ char random secret>'`
- `export COPM_NEXTAUTH_URL='http://<host>:3300'`

## Unattended Install (Dev Host Only)

Use the setup scripts in [`setup-scripts/`](/CodexDev/CodexNotesSystem/setup-scripts):

1. Copy and edit:
   - [`setup-scripts/.env.setup.example`](/CodexDev/CodexNotesSystem/setup-scripts/.env.setup.example)
2. Run as root:
   - `sudo ./setup-scripts/install-unattended.sh /path/to/your/setup.env`

Installer actions:
- deploys code to `COPM_INSTALL_DIR`
- generates `.env` + `.env.agent`
- runs `npm ci`, Prisma deploy/generate, production build
- creates/enables systemd services for web + agent

Important installer behavior:
- binds web service to LAN by default (`COPM_WEB_HOST=0.0.0.0`)
- installer blocks public bind targets; only private/LAN addresses are allowed
- runs agent service as `root` to use root-context Codex CLI/auth

## API Entry Points

- `/api/v1` (bearer token required)
- `/api/help` (machine-readable API catalog)
- `/api/register` (only before first account exists)

Key project endpoints:
- `/api/v1/projects/:id/ai-kickstart`
- `/api/v1/projects/:id/agents-md`
- `/api/v1/projects/:id/lifecycle/runs`

## Operations

- systemd web service: configurable (example: `codex-notes-system`)
- systemd agent service: configurable (example: `codex-notes-agent`)
- workspace root: configurable (example: `/var/lib/copm/workspaces`)

## Depersonalized Distribution Reset

Before shipping/cloning to another host, wipe personal data and keep only one generic admin:

- `./setup-scripts/reset-depersonalized-state.sh .env`

This removes:
- all projects, tasks, docs, lifecycle runs, agent runs, API keys
- all users
- adapter credentials (DomNex/GitHub)

Then it creates one depersonalized default admin account (override via env vars):
- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

## Security and Scope Model

- COPM acts as control plane and source of truth
- Project execution is workspace-bound (`workspaces/PRJ-*`)
- Project DB isolation is expected (`PRJ-*` naming for project runtime DBs)
- API auth uses generated bearer keys (project-bound where applicable)

## Tests

- Unit/integration: `npm test`
- Type checks: `npm run typecheck`
- Lint: `npm run lint`

## Support Channel

- Discord: https://discord.gg/GnAUmXhfeG
