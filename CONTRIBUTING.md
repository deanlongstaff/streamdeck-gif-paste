# Contributing

Thanks for helping improve GIF Paste. This guide covers setting up a development copy, the project layout, testing, and how changes get released.

## Getting started

You'll need:

- [Node.js](https://nodejs.org) 20 or later, to run the tests and Elgato's CLI
- The [Stream Deck app](https://www.elgato.com/downloads) on macOS or Windows, to try the plugin
- Python 3 with [Pillow](https://pypi.org/project/pillow/), only if you're regenerating test fixtures

The plugin has no runtime dependencies, so there's nothing to install. To run it from your clone:

```bash
# macOS
./scripts/dev-install.sh
```

```powershell
# Windows
.\scripts\dev-install.ps1
```

Both scripts link the repo's plugin folder into Stream Deck and restart the app. After editing the plugin, restart Stream Deck to load your changes.

## Project layout

| Path | Purpose |
|---|---|
| `com.deanlongstaff.gifpaste.sdPlugin/manifest.json` | Plugin and action definition |
| `com.deanlongstaff.gifpaste.sdPlugin/plugin.js` | Talks to Stream Deck over its WebSocket API; downloads, caches and animates keys |
| `com.deanlongstaff.gifpaste.sdPlugin/gif.js` | Pure-JS GIF decoder that renders key-sized PNG frames in a worker thread |
| `com.deanlongstaff.gifpaste.sdPlugin/paste.js` | Clipboard and paste shortcut per platform (AppleScript on macOS, PowerShell on Windows) |
| `com.deanlongstaff.gifpaste.sdPlugin/pi.html` | The key's settings panel (property inspector) |
| `tests/` | Decoder tests, with fixtures rendered by Pillow as an independent reference |
| `scripts/` | Development install and packaging helpers |

### Design notes

- **No dependencies.** The plugin runs on the Node.js runtime bundled with Stream Deck and uses only built-in modules. Please keep it that way, as it keeps the plugin small and easy to audit.
- **Why the plugin animates keys itself.** Stream Deck's `setImage` doesn't accept animated GIFs. `gif.js` decodes each frame, crops it to fill the square key, and encodes it as a PNG. `plugin.js` then plays the frames with their original timing.
- **Paste safety.** Paths and URLs are passed to AppleScript as arguments and to PowerShell through an environment variable. They're never interpolated into a script or shell command.

## Tests

```bash
npm test           # decoder tests (node:test)
npm run validate   # Elgato's manifest and plugin validator
```

CI runs both on every pull request.

The fixtures in `tests/fixtures/` are generated, along with the expected output for every frame, by `tests/fixtures/generate.py`. The tests compare the decoder with Pillow's rendering, pixel for pixel. To add a case, add it to the generator and rerun it:

```bash
python3 tests/fixtures/generate.py
```

The paste behaviour depends on the operating system and the focused app, so it isn't covered by automated tests. If you change `paste.js`, please test it by hand on the platforms you touched, and say which ones in your pull request.

## Submitting changes

1. Open an issue first for anything beyond a small fix, so we can agree on the approach.
2. Create a branch, make your change, and run `npm test` and `npm run validate`.
3. Open a pull request. Its title must follow [Conventional Commits](https://www.conventionalcommits.org), because pull requests are squash-merged and the title becomes the commit message:

   | Prefix | Use for | Release |
   |---|---|---|
   | `fix:` | Bug fixes | Patch |
   | `feat:` | New features | Minor |
   | `feat!:` / `fix!:` | Breaking changes, such as a plugin ID or settings format change | Major |
   | `docs:`, `test:`, `ci:`, `chore:`, `refactor:` | Everything else | None |

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Each merge to `main` updates an open release pull request with the next version number and the `CHANGELOG.md` entries.
2. When a maintainer merges the release pull request, CI tags the release, builds a validated `.streamDeckPlugin` with the manifest version set to match, and attaches it to the GitHub release.
3. The Elgato Marketplace has no publishing API, so a maintainer uploads the file through [Maker Console](https://maker.elgato.com) by hand.

Don't edit `CHANGELOG.md`, `.release-please-manifest.json` or the manifest's `Version` field yourself. The release process manages them.

## Code of conduct

Please be respectful and constructive. This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
