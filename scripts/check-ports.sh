#!/usr/bin/env bash
set -euo pipefail

ports=(3300)
exit_code=0

for port in "${ports[@]}"; do
  if ss -ltn | awk '{print $4}' | rg -q ":${port}$"; then
    echo "[busy] port ${port} is in use"
    exit_code=1
  else
    echo "[free] port ${port} is available"
  fi
done

exit "${exit_code}"
