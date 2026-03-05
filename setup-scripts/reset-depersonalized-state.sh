#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  ./setup-scripts/reset-depersonalized-state.sh [/path/to/.env]

Purpose:
- Remove all project/user runtime data from COPM database.
- Keep only one depersonalized default admin account.
- Clear global integration credentials (DomNex/GitHub).

Optional env overrides:
- DEFAULT_ADMIN_USERNAME (default: admin)
- DEFAULT_ADMIN_EMAIL    (default: admin@local.invalid)
- DEFAULT_ADMIN_PASSWORD (default: auto-generated strong password)
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] required command not found: $cmd" >&2
    exit 1
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ENV_FILE="${1:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] env file not found: $ENV_FILE" >&2
  exit 1
fi

require_cmd psql
require_cmd node

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] DATABASE_URL is missing." >&2
  exit 1
fi

DEFAULT_ADMIN_USERNAME="${DEFAULT_ADMIN_USERNAME:-admin}"
DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@local.invalid}"
if [[ -z "${DEFAULT_ADMIN_PASSWORD:-}" ]]; then
  DEFAULT_ADMIN_PASSWORD="$(
    node <<'NODE'
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

function safeRead(path) {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

const entropyParts = [
  Date.now().toString(),
  process.hrtime.bigint().toString(),
  os.hostname(),
  os.platform(),
  os.arch(),
  os.release(),
  safeRead("/etc/machine-id"),
  safeRead("/var/lib/dbus/machine-id"),
  safeRead("/sys/class/dmi/id/product_uuid"),
  safeRead("/sys/class/dmi/id/board_serial"),
  safeRead("/sys/class/dmi/id/product_serial"),
  crypto.randomBytes(64).toString("hex"),
];

const digest = crypto
  .createHash("sha512")
  .update(entropyParts.filter(Boolean).join("|"))
  .digest("base64url");

const timeTag = Date.now().toString(36);
const password = `Adm!${digest.slice(0, 24)}#${timeTag.slice(-6)}`;
process.stdout.write(password);
NODE
  )"
  GENERATED_ADMIN_PASSWORD=1
else
  GENERATED_ADMIN_PASSWORD=0
fi

ADMIN_HASH="$(
  node -e 'const bcrypt=require("bcryptjs"); console.log(bcrypt.hashSync(process.argv[1], 12));' "$DEFAULT_ADMIN_PASSWORD"
)"

psql "$DATABASE_URL" \
  --set=admin_username="$DEFAULT_ADMIN_USERNAME" \
  --set=admin_email="$DEFAULT_ADMIN_EMAIL" \
  --set=admin_hash="$ADMIN_HASH" <<'SQL'
BEGIN;

TRUNCATE TABLE
  "ApiKey",
  "AgentRun",
  "LifecycleEvidence",
  "LifecycleTransition",
  "LifecycleModule",
  "LifecycleRun",
  "Task",
  "Documentation",
  "Project",
  "UserDomNexDomainAccess"
RESTART IDENTITY CASCADE;

DELETE FROM "User";

INSERT INTO "User" (
  "id",
  "username",
  "email",
  "passwordHash",
  "role",
  "projectLimit",
  "githubEnabled",
  "githubEncryptedApiToken",
  "githubTokenHint",
  "githubUsername",
  "githubEmail",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  :'admin_username',
  :'admin_email',
  :'admin_hash',
  'ADMIN',
  100,
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  now(),
  now()
);

UPDATE "DomNexAdapterConfig"
SET
  "enabled" = false,
  "baseUrl" = 'http://127.0.0.1:0',
  "defaultDomain" = NULL,
  "encryptedApiToken" = NULL,
  "tokenHint" = NULL,
  "lastCheckedAt" = NULL,
  "lastHealthStatus" = NULL,
  "lastHealthMessage" = NULL,
  "updatedAt" = now();

UPDATE "GitHubAdapterConfig"
SET
  "enabled" = false,
  "encryptedApiToken" = NULL,
  "tokenHint" = NULL,
  "username" = NULL,
  "email" = NULL,
  "lastCheckedAt" = NULL,
  "lastHealthStatus" = NULL,
  "lastHealthMessage" = NULL,
  "updatedAt" = now();

COMMIT;
SQL

echo "[DONE] COPM depersonalized reset completed."
echo "[INFO] Default admin:"
echo "  username: $DEFAULT_ADMIN_USERNAME"
echo "  email:    $DEFAULT_ADMIN_EMAIL"
echo "  password: $DEFAULT_ADMIN_PASSWORD"
if [[ "$GENERATED_ADMIN_PASSWORD" -eq 1 ]]; then
  echo "[INFO] Password was auto-generated using system time + host hardware identifiers + cryptographic randomness."
fi
echo "[WARN] Change the default admin password immediately after first login."
