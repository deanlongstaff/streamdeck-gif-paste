// Put a GIF file (or text) on the clipboard and send the paste shortcut to the focused app.
const { execFile } = require('child_process');

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) =>
  execFile(cmd, args, { windowsHide: true, ...opts },
    (err, stdout, stderr) => err ? reject(new Error(stderr?.trim() || err.message)) : resolve(stdout)));

// ---------- macOS ----------

const MAC_FILE = [
  'use framework "AppKit"',
  'use scripting additions',
  'on run argv',
  "set pb to current application's NSPasteboard's generalPasteboard()",
  "pb's clearContents()",
  "pb's writeObjects:{current application's NSURL's fileURLWithPath:(item 1 of argv)}",
  'delay 0.05',
  'tell application "System Events" to keystroke "v" using command down',
  'end run'
];

const MAC_TEXT = [
  'on run argv',
  'set the clipboard to (item 1 of argv)',
  'delay 0.05',
  'tell application "System Events" to keystroke "v" using command down',
  'end run'
];

const osascript = (lines, arg) => run('osascript', [...lines.flatMap(l => ['-e', l]), arg]);

// ---------- Windows ----------
// The value is passed in an environment variable so paths never need quoting.

const WIN_FILE = `
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
[void]$files.Add($env:GIFPASTE_VALUE)
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
Start-Sleep -Milliseconds 50
[System.Windows.Forms.SendKeys]::SendWait('^v')
`;

const WIN_TEXT = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText($env:GIFPASTE_VALUE)
Start-Sleep -Milliseconds 50
[System.Windows.Forms.SendKeys]::SendWait('^v')
`;

const powershell = (script, value) => run('powershell.exe',
  ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
  { env: { ...process.env, GIFPASTE_VALUE: value } });

// ---------- public ----------

function pasteFile(file) {
  if (process.platform === 'darwin') return osascript(MAC_FILE, file);
  if (process.platform === 'win32') return powershell(WIN_FILE, file);
  return Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
}

function pasteText(text) {
  if (process.platform === 'darwin') return osascript(MAC_TEXT, text);
  if (process.platform === 'win32') return powershell(WIN_TEXT, text);
  return Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
}

module.exports = { pasteFile, pasteText };
