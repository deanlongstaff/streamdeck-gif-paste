# GIF Paste for Stream Deck

A Stream Deck plugin for macOS and Windows that pastes a GIF with one key press. Give each key a GIF URL. The key shows the GIF, animated, and pressing it pastes the GIF into whatever app has focus (Teams, Slack, Outlook, Discord, …).

- Works with direct `.gif` links and with Giphy and Tenor page links.
- Also accepts a local GIF: click **Browse…** to pick one, or type a path (`~/Pictures/thing.gif`, `C:\Users\me\thing.gif`).
- **Paste as GIF file** uploads the animated GIF itself. **Paste as Link** pastes the URL, which Slack and Discord expand.
- No dependencies. It runs on Stream Deck's built-in Node.js with a bundled GIF decoder.

## Install

Download `com.deanlongstaff.gifpaste.streamDeckPlugin` from [Releases](../../releases) and double-click it.

**macOS:** on first use, allow Stream Deck under **System Settings → Privacy & Security → Accessibility**. The plugin needs this to send ⌘V.

**Windows:** no setup. Pasting uses the built-in Windows PowerShell to put the file on the clipboard and send Ctrl+V.

## Use

1. Drag **GIF Paste → Paste GIF** onto a key.
2. Paste a GIF URL into **GIF**, or click **Browse…** to choose a local file.
3. The key downloads the GIF and starts animating. The status line shows `Ready` or the error.

**Re-download** clears the cached copy for that key. GIFs are cached in `~/Library/Caches/com.deanlongstaff.gifpaste` (macOS) or `%LOCALAPPDATA%\com.deanlongstaff.gifpaste\Cache` (Windows).

## Develop

```bash
./scripts/dev-install.sh   # macOS: symlink this repo into Stream Deck and restart it
./scripts/package.sh       # build dist/com.deanlongstaff.gifpaste.streamDeckPlugin
```

```powershell
.\scripts\dev-install.ps1   # Windows: junction this repo into Stream Deck and restart it
```

After editing, restart Stream Deck to reload the plugin. Plugin logs are in `~/Library/Logs/ElgatoStreamDeck/` (macOS) or `%APPDATA%\Elgato\StreamDeck\logs` (Windows).

| File | Purpose |
|---|---|
| `manifest.json` | Plugin and action definition |
| `plugin.js` | Downloads, caches and animates the key |
| `gif.js` | Pure-JS GIF decoder: frames → key-sized PNGs (runs in a worker thread) |
| `paste.js` | Clipboard + paste shortcut per platform (AppleScript / PowerShell) |
| `pi.html` | Key settings panel |

Stream Deck's `setImage` does not accept animated GIFs, so the plugin decodes the frames and plays them on the key itself. Playback is capped at about 15 fps and 60 frames.

## Release

Releases are managed by [release-please](https://github.com/googleapis/release-please) using [Conventional Commits](https://www.conventionalcommits.org):

- `fix: …` → patch, `feat: …` → minor, `feat!: …` → major. Other types (`chore:`, `docs:`, `ci:`) don't trigger a release.
- Pushes to `main` update a **release PR** with the next version and `CHANGELOG.md`.
- Merging that PR tags the release, then CI packs a validated `.streamDeckPlugin` (with the manifest `Version` stamped to match) and attaches it to the GitHub release.

The Elgato Marketplace has no publishing API, so the last step is manual: download the file from the release and submit it as a new version in [Maker Console](https://maker.elgato.com).
