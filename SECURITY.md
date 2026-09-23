# Security policy

## Supported versions

Security fixes go into the latest release only. Please update to the [latest version](https://github.com/deanlongstaff/streamdeck-gif-paste/releases/latest) before reporting an issue.

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately through [GitHub's private vulnerability reporting](https://github.com/deanlongstaff/streamdeck-gif-paste/security/advisories/new).

Please include:

- The affected version and operating system
- Steps to reproduce, or a proof of concept
- What an attacker could achieve

You'll get an acknowledgement within a few days. Once a fix is released, the advisory is published, crediting you unless you'd rather stay anonymous.

## Scope

GIF Paste downloads content from URLs a user enters, decodes it, and places files on the clipboard. It then sends a paste shortcut by running `osascript` on macOS or `powershell.exe` on Windows. Examples of issues in scope:

- A crafted GIF or web page that causes code execution, arbitrary file writes, or hangs the plugin
- A URL or file path that gets interpreted as a command
- The plugin reading or sending data beyond the GIFs a user asked for
