#!/usr/bin/env bash
# Builds gocoon-runner from ../gocoon and places it where Tauri expects
# external binaries: src-tauri/binaries/gocoon-runner-<target-triple>
set -euo pipefail

desktop_root="$(cd "$(dirname "$0")/.." && pwd)"
gocoon_root="$desktop_root/../gocoon"

triple="${1:-$(rustc -Vv | sed -n 's/^host: //p')}"
[ -n "$triple" ] || { echo "rustc not found; pass triple as \$1" >&2; exit 1; }

ext=""
case "$triple" in *windows*) ext=".exe";; esac
out_dir="$desktop_root/src-tauri/binaries"
mkdir -p "$out_dir"
out="$out_dir/gocoon-runner-$triple$ext"

# Map rust triple -> GOOS/GOARCH for cross builds (darwin/linux/windows, amd64/arm64)
case "$triple" in
  *darwin*) goos=darwin;;
  *windows*) goos=windows;;
  *) goos=linux;;
esac
case "$triple" in
  aarch64-*) goarch=arm64;;
  *) goarch=amd64;;
esac

echo "building gocoon-runner ($triple) -> $out"
(cd "$gocoon_root" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
  go build -trimpath -ldflags "-s -w" -o "$out" ./cmd/gocoon-runner)
echo "done"
