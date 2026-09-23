# GIF Paste for Stream Deck

A Stream Deck plugin for macOS that pastes a GIF with one key press. Give each key a GIF URL. The key shows the GIF, animated, and pressing it pastes the GIF into whatever app has focus (Teams, Slack, Outlook, Discord, …).

- Works with direct `.gif` links and with Giphy and Tenor page links.
- Also accepts a local GIF: click **Browse…** to pick one in Finder, or type a path (`~/Pictures/thing.gif`).
- **Paste as GIF file** uploads the animated GIF itself. **Paste as Link** pastes the URL, which Slack and Discord expand.
- No dependencies. It uses Stream Deck's built-in Node.js and macOS's own image APIs.

## Install

Download `com.dean.gifpaste.streamDeckPlugin` from [Releases](../../releases) and double-click it.

On first use, allow Stream Deck under **System Settings → Privacy & Security → Accessibility**. The plugin needs this to send ⌘V.

## Use

1. Drag **GIF Paste → Paste GIF** onto a key.
2. Paste a GIF URL into **GIF**, or click **Browse…** to choose a local file.
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

Releases are managed by [release-please](https://github.com/googleapis/release-please) using [Conventional Commits](https://www.conventionalcommits.org):

- `fix: …` → patch, `feat: …` → minor, `feat!: …` → major. Other types (`chore:`, `docs:`, `ci:`) don't trigger a release.
- Pushes to `main` update a **release PR** with the next version and `CHANGELOG.md`.
- Merging that PR tags the release, then CI packs a validated `.streamDeckPlugin` (with the manifest `Version` stamped to match) and attaches it to the GitHub release.

The Elgato Marketplace has no publishing API, so the last step is manual: download the file from the release and submit it as a new version in [Maker Console](https://maker.elgato.com).
