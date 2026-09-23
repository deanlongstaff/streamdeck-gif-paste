# Links the plugin from this repo into Stream Deck (Windows), so edits here go live after a restart.
$ErrorActionPreference = 'Stop'
$name = 'com.deanlongstaff.gifpaste.sdPlugin'
$source = Join-Path (Split-Path -Parent $PSScriptRoot) $name
$plugins = Join-Path $env:APPDATA 'Elgato\StreamDeck\Plugins'
$target = Join-Path $plugins $name

Stop-Process -Name StreamDeck -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

New-Item -ItemType Directory -Force -Path $plugins | Out-Null
if (Test-Path $target) {
  $item = Get-Item $target -Force
  # Remove a junction without touching the repo it points to
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "$target" | Out-Null }
  else { Remove-Item $target -Recurse -Force }
}
New-Item -ItemType Junction -Path $target -Target $source | Out-Null

Start-Process (Join-Path $env:ProgramFiles 'Elgato\StreamDeck\StreamDeck.exe')
Write-Host "Linked $name -> $source"
