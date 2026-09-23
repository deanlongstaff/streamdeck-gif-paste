#!/bin/bash
# Validates and builds dist/com.dean.gifpaste.streamDeckPlugin using Elgato's CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
npx -y @elgato/cli@1 pack com.dean.gifpaste.sdPlugin -o dist --force
