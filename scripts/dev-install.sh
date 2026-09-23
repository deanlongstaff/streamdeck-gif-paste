#!/bin/bash
# Links the plugin from this repo into Stream Deck, so edits here go live after a restart.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins"
NAME="com.dean.gifpaste.sdPlugin"

mkdir -p "$PLUGINS"
rm -rf "${PLUGINS:?}/$NAME"
ln -s "$ROOT/$NAME" "$PLUGINS/$NAME"

killall "Stream Deck" 2>/dev/null || true
sleep 2
open -b com.elgato.StreamDeck
echo "Linked $NAME -> $ROOT/$NAME"
