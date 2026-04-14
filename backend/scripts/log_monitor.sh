#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$BASE_DIR/logs"
MAX_SIZE_MB="${MAX_LOG_SIZE_MB:-100}"

mkdir -p "$LOG_DIR"

find "$LOG_DIR" -maxdepth 1 -type f -name "*.log" | while read -r log_file; do
  size_mb=$(du -m "$log_file" | awk '{print $1}')
  if [ "$size_mb" -gt "$MAX_SIZE_MB" ]; then
    echo "[log_monitor] oversized log: $log_file (${size_mb}MB)"
  fi
done
