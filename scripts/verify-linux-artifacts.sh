#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <appimage> <deb>" >&2
  exit 64
fi

appimage="$(realpath "$1")"
deb="$(realpath "$2")"
work_root="$(mktemp -d "$HOME/ff-converter-linux-verify.XXXXXX")"
trap 'rm -rf -- "$work_root"' EXIT

echo "== Debian metadata =="
dpkg-deb -f "$deb" Package Version Architecture Maintainer Homepage
dpkg-deb -x "$deb" "$work_root/deb"

deb_ffmpeg="$(find "$work_root/deb" -type f -path '*/resources/ffmpeg/linux-x64/ffmpeg' -print -quit)"
deb_ffprobe="$(find "$work_root/deb" -type f -path '*/resources/ffmpeg/linux-x64/ffprobe' -print -quit)"
deb_native="$(find "$work_root/deb" -type f -path '*/better-sqlite3/prebuilds/linux-x64.node' -print -quit)"
deb_desktop="$(find "$work_root/deb" -type f -name '*.desktop' -print -quit)"
deb_icon="$(find "$work_root/deb" -type f -path '*/icons/*' -name '*.png' -print -quit)"

test -n "$deb_ffmpeg" && test -x "$deb_ffmpeg"
test -n "$deb_ffprobe" && test -x "$deb_ffprobe"
test -n "$deb_native"
test -n "$deb_desktop"
test -n "$deb_icon"

echo "== Debian payload =="
stat -c '%A %a %n' "$deb_ffmpeg" "$deb_ffprobe"
file "$deb_native"
grep -E '^(Name|Exec|Icon|StartupWMClass)=' "$deb_desktop"
"$deb_ffmpeg" -version | head -n 1

echo "== AppImage payload =="
local_appimage="$work_root/FF-Converter.AppImage"
cp "$appimage" "$local_appimage"
chmod 0755 "$local_appimage"
(
  cd "$work_root"
  "$local_appimage" --appimage-extract >/dev/null
)

app_ffmpeg="$work_root/squashfs-root/resources/ffmpeg/linux-x64/ffmpeg"
app_ffprobe="$work_root/squashfs-root/resources/ffmpeg/linux-x64/ffprobe"
app_native="$(find "$work_root/squashfs-root" -type f -path '*/better-sqlite3/prebuilds/linux-x64.node' -print -quit)"
app_desktop="$(find "$work_root/squashfs-root" -maxdepth 2 -type f -name '*.desktop' -print -quit)"

test -x "$app_ffmpeg"
test -x "$app_ffprobe"
test -n "$app_native"
test -n "$app_desktop"

stat -c '%A %a %n' "$app_ffmpeg" "$app_ffprobe"
file "$app_native"
grep -E '^(Name|Exec|Icon|StartupWMClass)=' "$app_desktop"
"$app_ffmpeg" -version | head -n 1

echo "== Packaged smoke test =="
mkdir -p "$work_root/home"
HOME="$work_root/home" \
  FF_CONVERTER_SMOKE_TEST=1 \
  timeout 45 "$work_root/squashfs-root/AppRun" --no-sandbox --smoke-test

echo "== Artifact identity =="
file "$appimage" "$deb"
sha256sum "$appimage" "$deb"

echo "Linux artifact verification passed."
