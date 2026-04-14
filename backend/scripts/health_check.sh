#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API2_SOCKET="/tmp/smap_fastapi.sock"
API3_URL="http://127.0.0.1:9000/health"

check_api2() {
  if [ ! -S "$API2_SOCKET" ]; then
    echo "[health_check] api2 socket missing: $API2_SOCKET"
    return 1
  fi

  curl --silent --fail --unix-socket "$API2_SOCKET" http://localhost/health >/dev/null
}

check_api3() {
  curl --silent --fail "$API3_URL" >/dev/null
}

cd "$BASE_DIR"

check_api2 || echo "[health_check] api2 check failed"
check_api3 || echo "[health_check] api3 check failed"
