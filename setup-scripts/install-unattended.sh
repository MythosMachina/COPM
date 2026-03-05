#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  sudo ./setup-scripts/install-unattended.sh /path/to/copm.setup.env

This script performs an unattended COPM install:
- syncs source into COPM_INSTALL_DIR
- writes .env and .env.agent from the setup env
- installs dependencies and builds production bundle
- installs/reloads/enables systemd services for web + agent

IMPORTANT:
- COPM is dev-only and must not be internet exposed.
- Web service must bind only to LAN/private IPs (no public IP binding).
- Codex CLI must be installed/authenticated for root (agent runs as root).
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] required command not found: $cmd" >&2
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[ERROR] required variable is missing: $name" >&2
    exit 1
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "[ERROR] run as root (required for user creation + systemd)." >&2
  exit 1
fi

SETUP_ENV_FILE="$1"
if [[ ! -f "$SETUP_ENV_FILE" ]]; then
  echo "[ERROR] setup env file not found: $SETUP_ENV_FILE" >&2
  exit 1
fi

require_cmd rsync
require_cmd npm
require_cmd systemctl
require_cmd ss
require_cmd getent
require_cmd id
require_cmd runuser

set -a
# shellcheck disable=SC1090
source "$SETUP_ENV_FILE"
set +a

require_var COPM_SOURCE_DIR
require_var COPM_INSTALL_DIR
require_var COPM_RUN_USER
require_var COPM_RUN_GROUP
require_var COPM_SYSTEMD_WEB_SERVICE
require_var COPM_SYSTEMD_AGENT_SERVICE
require_var COPM_WEB_PORT
require_var COPM_BASE_URL
require_var NEXTAUTH_URL
require_var NEXTAUTH_SECRET
require_var DATABASE_URL
require_var COPM_AGENT_API_TOKEN
require_var COPM_AGENT_WORKSPACE_ROOT
require_var COPM_AGENT_POLL_INTERVAL_MS
require_var COPM_AGENT_STALE_RUN_MINUTES
require_var COPM_AGENT_MAX_RUN_MS
require_var COPM_AGENT_CODEX_COMMAND
COPM_WEB_HOST="${COPM_WEB_HOST:-0.0.0.0}"

if [[ ! -d "$COPM_SOURCE_DIR" ]]; then
  echo "[ERROR] source directory not found: $COPM_SOURCE_DIR" >&2
  exit 1
fi

is_private_bind_host() {
  local host="$1"
  if [[ "$host" == "0.0.0.0" || "$host" == "127.0.0.1" || "$host" == "localhost" || "$host" == "::1" || "$host" == "::" ]]; then
    return 0
  fi
  if [[ "$host" =~ ^10\. ]]; then
    return 0
  fi
  if [[ "$host" =~ ^192\.168\. ]]; then
    return 0
  fi
  if [[ "$host" =~ ^172\.([1][6-9]|2[0-9]|3[0-1])\. ]]; then
    return 0
  fi
  if [[ "$host" =~ ^fd[0-9a-fA-F:]*$ || "$host" =~ ^fc[0-9a-fA-F:]*$ ]]; then
    return 0
  fi
  return 1
}

if ! is_private_bind_host "$COPM_WEB_HOST"; then
  echo "[ERROR] COPM_WEB_HOST must be LAN/private only (RFC1918/ULA). Public internet binding is blocked." >&2
  exit 1
fi

if ss -ltn | awk '{print $4}' | grep -Eq ":${COPM_WEB_PORT}$"; then
  echo "[ERROR] configured COPM_WEB_PORT is already in use: $COPM_WEB_PORT" >&2
  exit 1
fi

if ! bash -lc "command -v '$COPM_AGENT_CODEX_COMMAND'" >/dev/null 2>&1; then
  echo "[ERROR] codex command not found for root context: $COPM_AGENT_CODEX_COMMAND" >&2
  exit 1
fi

if ! getent group "$COPM_RUN_GROUP" >/dev/null; then
  echo "[INFO] creating group: $COPM_RUN_GROUP"
  groupadd --system "$COPM_RUN_GROUP"
fi

if ! id "$COPM_RUN_USER" >/dev/null 2>&1; then
  echo "[INFO] creating user: $COPM_RUN_USER"
  useradd --system --gid "$COPM_RUN_GROUP" --home-dir "$COPM_INSTALL_DIR" --create-home --shell /usr/sbin/nologin "$COPM_RUN_USER"
fi

mkdir -p "$COPM_INSTALL_DIR"
mkdir -p "$COPM_AGENT_WORKSPACE_ROOT"

echo "[INFO] syncing source to: $COPM_INSTALL_DIR"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'coverage' \
  --exclude 'dist' \
  --exclude 'build' \
  --exclude 'workspaces' \
  --exclude '*.log' \
  --exclude '*.pid' \
  "$COPM_SOURCE_DIR/" "$COPM_INSTALL_DIR/"

chown -R "$COPM_RUN_USER:$COPM_RUN_GROUP" "$COPM_INSTALL_DIR" "$COPM_AGENT_WORKSPACE_ROOT"

cat > "$COPM_INSTALL_DIR/.env" <<ENVFILE
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
NEXTAUTH_URL=$NEXTAUTH_URL
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
COPM_BASE_URL=$COPM_BASE_URL
COPM_WEB_PORT=$COPM_WEB_PORT
COPM_WEB_HOST=$COPM_WEB_HOST
ENVFILE

cat > "$COPM_INSTALL_DIR/.env.agent" <<ENVFILE
COPM_AGENT_API_TOKEN=$COPM_AGENT_API_TOKEN
COPM_AGENT_BASE_URL=$COPM_BASE_URL
COPM_AGENT_WORKSPACE_ROOT=$COPM_AGENT_WORKSPACE_ROOT
COPM_AGENT_POLL_INTERVAL_MS=$COPM_AGENT_POLL_INTERVAL_MS
COPM_AGENT_STALE_RUN_MINUTES=$COPM_AGENT_STALE_RUN_MINUTES
COPM_AGENT_MAX_RUN_MS=$COPM_AGENT_MAX_RUN_MS
COPM_AGENT_CODEX_COMMAND=$COPM_AGENT_CODEX_COMMAND
COPM_AGENT_CODEX_ARGS=${COPM_AGENT_CODEX_ARGS:-}
DOMNEX_BASE_URL=${DOMNEX_BASE_URL:-}
DOMNEX_API_TOKEN=${DOMNEX_API_TOKEN:-}
GITHUB_API_TOKEN=${GITHUB_API_TOKEN:-}
GITHUB_USERNAME=${GITHUB_USERNAME:-}
GITHUB_EMAIL=${GITHUB_EMAIL:-}
ENVFILE

chown "$COPM_RUN_USER:$COPM_RUN_GROUP" "$COPM_INSTALL_DIR/.env" "$COPM_INSTALL_DIR/.env.agent"
chmod 600 "$COPM_INSTALL_DIR/.env" "$COPM_INSTALL_DIR/.env.agent"

WEB_UNIT_PATH="/etc/systemd/system/${COPM_SYSTEMD_WEB_SERVICE}.service"
AGENT_UNIT_PATH="/etc/systemd/system/${COPM_SYSTEMD_AGENT_SERVICE}.service"

cat > "$WEB_UNIT_PATH" <<UNIT
[Unit]
Description=Codex Notes System (Next.js)
After=network.target

[Service]
Type=simple
User=$COPM_RUN_USER
Group=$COPM_RUN_GROUP
WorkingDirectory=$COPM_INSTALL_DIR
EnvironmentFile=$COPM_INSTALL_DIR/.env
ExecStartPre=/usr/bin/npm run prisma:deploy
ExecStart=/bin/bash -lc 'npx next start -H "\${COPM_WEB_HOST}" -p "\${COPM_WEB_PORT}"'
Restart=always
RestartSec=3
TimeoutStopSec=20
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

cat > "$AGENT_UNIT_PATH" <<UNIT
[Unit]
Description=Codex Notes Orchestrator Agent Worker
After=network.target ${COPM_SYSTEMD_WEB_SERVICE}.service
Requires=${COPM_SYSTEMD_WEB_SERVICE}.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$COPM_INSTALL_DIR
EnvironmentFile=$COPM_INSTALL_DIR/.env
EnvironmentFile=$COPM_INSTALL_DIR/.env.agent
ExecStart=/usr/bin/npm run agent:worker
Restart=always
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

echo "[INFO] installing dependencies/building app"
runuser -u "$COPM_RUN_USER" -- bash -lc "cd '$COPM_INSTALL_DIR' && npm ci && npm run prisma:generate && npm run prisma:deploy && npm run build"

echo "[INFO] enabling and starting services"
systemctl daemon-reload
systemctl enable --now "$COPM_SYSTEMD_WEB_SERVICE.service"
systemctl enable --now "$COPM_SYSTEMD_AGENT_SERVICE.service"

echo "[INFO] waiting for services"
sleep 2
systemctl --no-pager --full status "$COPM_SYSTEMD_WEB_SERVICE.service" | sed -n '1,20p'
systemctl --no-pager --full status "$COPM_SYSTEMD_AGENT_SERVICE.service" | sed -n '1,20p'

echo "[DONE] COPM unattended install completed"
echo "[INFO] URL: $COPM_BASE_URL"
