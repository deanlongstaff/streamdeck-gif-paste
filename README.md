# GIF Paste for Stream Deck

A Stream Deck plugin for macOS that pastes a GIF with one key press. Give each key a GIF URL. The key shows the GIF, animated, and pressing it pastes the GIF into whatever app has focus (Teams, Slack, Outlook, Discord, …).

- Works with direct `.gif` links and with Giphy and Tenor page links.
- Also accepts a local file path (`~/Pictures/thing.gif`).
- **Paste as GIF file** uploads the animated GIF itself. **Paste as Link** pastes the URL, which Slack and Discord expand.
- No dependencies. It uses Stream Deck's built-in Node.js and macOS's own image APIs.

## Install

Download `com.dean.gifpaste.streamDeckPlugin` from [Releases](../../releases) and double-click it.

On first use, allow Stream Deck under **System Settings → Privacy & Security → Accessibility**. The plugin needs this to send ⌘V.

## Use

1. Drag **GIF Paste → Paste GIF** onto a key.
2. Paste a GIF URL into **GIF URL**.
3. The key downloads the GIF and starts animating. The status line shows `Ready` or the error.

**Re-download** clears the cached copy for that key. GIFs are cached in `~/Library/Caches/com.dean.gifpaste`.

## Develop

```bash
./scripts/dev-install.sh   # symlink this repo into Stream Deck and restart it
./scripts/package.sh       # build dist/com.dean.gifpaste.streamDeckPlugin
```

After editing, restart Stream Deck to reload the plugin. Plugin logs are in `~/Library/Logs/ElgatoStreamDeck/`.

| File | Purpose |
|---|---|
| `manifest.json` | Plugin and action definition |
| `plugin.js` | Downloads, caches, animates the key and pastes |
| `frames.js` | Decodes a GIF into key-sized PNG frames (JXA / AppKit) |
| `pi.html` | Key settings panel |

Stream Deck's `setImage` does not accept animated GIFs, so the plugin decodes the frames and plays them on the key itself. Playback is capped at about 15 fps and 60 frames.

## Release

```bash
git tag v2.0.0 && git push --tags
```

GitHub Actions builds the `.streamDeckPlugin` and attaches it to a release.
