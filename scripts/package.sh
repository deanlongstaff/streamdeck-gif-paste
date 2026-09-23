#!/bin/bash
# Validates and builds dist/com.deanlongstaff.gifpaste.streamDeckPlugin using Elgato's CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
npx -y @elgato/cli@1 pack com.deanlongstaff.gifpaste.sdPlugin -o dist --force
