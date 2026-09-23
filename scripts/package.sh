#!/bin/bash
# Builds dist/com.dean.gifpaste.streamDeckPlugin (double-click to install).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="com.dean.gifpaste"

mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.streamDeckPlugin"
cd "$ROOT"
zip -rq "dist/$NAME.streamDeckPlugin" "$NAME.sdPlugin" -x '*.DS_Store'
echo "Built dist/$NAME.streamDeckPlugin"
