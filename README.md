# GIF Paste for Stream Deck

[![CI](https://github.com/deanlongstaff/streamdeck-gif-paste/actions/workflows/ci.yml/badge.svg)](https://github.com/deanlongstaff/streamdeck-gif-paste/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/deanlongstaff/streamdeck-gif-paste?sort=semver)](https://github.com/deanlongstaff/streamdeck-gif-paste/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Paste your favourite reaction GIFs with a single key press. Point a Stream Deck key at a GIF, and the key plays the GIF as its icon. Press it to paste the GIF into Slack, Teams, Discord, Outlook, or whichever app you're typing in.

## Features

- **Any GIF source:** direct `.gif` links, Giphy and Tenor page links, or a GIF file on your computer.
- **Animated keys:** the key shows the GIF itself, animated. There's no icon to make.
- **Paste as a file or a link:** upload the animated GIF, or paste its URL for apps that expand links.
- **Works offline after the first load:** each GIF is downloaded once and cached locally.
- **macOS and Windows**, with no extra software to install.

## Requirements

- Stream Deck app 6.4 or later
- macOS 12 or later, or Windows 10 or later

## Installation

1. Download `com.deanlongstaff.gifpaste.streamDeckPlugin` from the [latest release](https://github.com/deanlongstaff/streamdeck-gif-paste/releases/latest).
2. Double-click the file. Stream Deck installs the plugin.

**macOS only:** the first time you press a key, macOS asks to let Stream Deck control your computer. Allow it under **System Settings → Privacy & Security → Accessibility**. The plugin needs this to send ⌘V.

## Usage

1. In Stream Deck, drag **GIF Paste → Paste GIF** onto a key.
2. In **GIF**, paste a GIF URL, or click **Browse…** to choose a GIF file.
3. The key loads the GIF and starts playing it. The status line under the settings shows **Ready**, or what went wrong.
4. Click into a chat or email and press the key.

### Settings

| Setting | Description |
|---|---|
| **GIF** | A GIF URL (`https://…/party.gif`), a Giphy or Tenor page URL, or a path to a local file. **Browse…** opens a file picker. |
| **Paste as** | **GIF file** pastes the file itself, as if you'd copied it in Finder or File Explorer. **Link** pastes the URL as text. |
| **Key icon** | Clear **Animate** to show only the first frame. |
| **Re-download** | Discards the cached copy and fetches the GIF again. |

### Choosing between file and link

- **GIF file** works in any app that accepts pasted files, including Slack, Discord, Teams and Outlook. The recipient sees the animated GIF even if they can't open the original link.
- **Link** suits apps that expand GIF links into previews, and apps that don't accept pasted files. It has no effect for local files, which are always pasted as a file.

## Privacy

The plugin only contacts the URLs you enter, to download those GIFs. It has no analytics, telemetry or accounts. Downloaded GIFs are cached here:

- macOS: `~/Library/Caches/com.deanlongstaff.gifpaste`
- Windows: `%LOCALAPPDATA%\com.deanlongstaff.gifpaste\Cache`

You can delete that folder at any time.

## Troubleshooting

| Problem | What to try |
|---|---|
| The key shows a warning triangle | Select the key and read the status line in its settings. The usual causes are a URL that isn't a GIF, a page with no GIF on it, or a file that has moved. |
| Nothing pastes (macOS) | Check that Stream Deck is allowed under **System Settings → Privacy & Security → Accessibility**. Remove it and add it again if it's already listed. |
| The app attaches a file instead of showing the GIF | Some apps treat pasted files as attachments. Switch the key to **Paste as: Link**. |
| A Giphy or Tenor link shows the wrong image | Use the direct media link instead. Right-click the GIF and copy the image address. |

Plugin logs are in `~/Library/Logs/ElgatoStreamDeck/` (macOS) or `%APPDATA%\Elgato\StreamDeck\logs` (Windows). Please attach the relevant lines when [reporting a bug](https://github.com/deanlongstaff/streamdeck-gif-paste/issues/new/choose).

## Limitations

- Only GIFs are supported, not WebP, APNG or video.
- Key animations are capped at about 15 frames per second and 60 frames. Longer GIFs are sampled evenly, and their total duration is preserved. The pasted GIF itself is never modified.
- The maximum GIF size is 30 MB.
- Linux isn't supported, because the Stream Deck app isn't available for it.

## Contributing

Bug reports, ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, test and submit changes. To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Dean Longstaff

Stream Deck and Elgato are trademarks of Corsair Memory, Inc. This project is not affiliated with or endorsed by Corsair or Elgato. GIPHY and Tenor are trademarks of their respective owners.
