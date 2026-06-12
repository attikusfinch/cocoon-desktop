# Builds gocoon-runner from ../gocoon and places it where Tauri expects
# external binaries: src-tauri/binaries/gocoon-runner-<target-triple>[.exe]
param(
    [string]$Triple = ""
)

$ErrorActionPreference = "Stop"
$desktopRoot = Split-Path -Parent $PSScriptRoot
$gocoonRoot = Join-Path (Split-Path -Parent $desktopRoot) "gocoon"

if (-not (Test-Path (Join-Path $gocoonRoot "go.mod"))) {
    throw "gocoon repo not found at $gocoonRoot"
}

if ($Triple -eq "") {
    $hostLine = (& rustc -Vv | Select-String "^host: ").Line
    if (-not $hostLine) { throw "rustc not found; pass -Triple explicitly" }
    $Triple = $hostLine.Substring(6).Trim()
}

$ext = ""
if ($Triple -like "*windows*") { $ext = ".exe" }
$outDir = Join-Path $desktopRoot "src-tauri\binaries"
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir "gocoon-runner-$Triple$ext"

$env:CGO_ENABLED = "0"
Write-Host "building gocoon-runner ($Triple) -> $out"
go -C $gocoonRoot build -trimpath -ldflags "-s -w" -o $out ./cmd/gocoon-runner
if ($LASTEXITCODE -ne 0) { throw "go build failed" }
Write-Host "done"
