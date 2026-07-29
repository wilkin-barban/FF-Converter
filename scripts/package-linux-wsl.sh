#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <project-source> <artifact-destination>" >&2
  exit 64
fi

source_root="$(realpath "$1")"
artifact_destination="$(realpath -m "$2")"
case "$source_root" in
  /mnt/*) ;;
  *)
    echo "The source must be a Windows workspace mounted below /mnt." >&2
    exit 64
    ;;
esac

build_root="$(mktemp -d "$HOME/ff-converter-linux-build.XXXXXX")"
cleanup() {
  if [[ "${KEEP_LINUX_BUILD:-0}" == "1" ]]; then
    echo "Linux build preserved at: $build_root"
  else
    rm -rf -- "$build_root"
  fi
}
trap cleanup EXIT

echo "Copying the project to the WSL2 ext4 filesystem..."
tar \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./dist-app' \
  --exclude='./apps/desktop/dist' \
  --exclude='./apps/desktop/dist-app' \
  --exclude='./packages/*/dist' \
  -C "$source_root" -cf - . |
  tar -C "$build_root" -xf -

cd "$build_root"
chmod 0755 \
  resources/ffmpeg/linux-x64/ffmpeg \
  resources/ffmpeg/linux-x64/ffprobe
export PATH="$build_root/resources/ffmpeg/linux-x64:$PATH"

echo "Checking the bundled Linux FFmpeg binaries..."
resources/ffmpeg/linux-x64/ffmpeg -version | head -n 1
resources/ffmpeg/linux-x64/ffprobe -version | head -n 1

echo "Installing native Linux dependencies..."
npm ci --no-audit --no-fund

echo "Running verification in Linux..."
npm run verify

echo "Building AppImage and Debian packages..."
npm run package --workspace=apps/desktop -- --linux AppImage deb --x64

mkdir -p "$artifact_destination"
mapfile -t artifacts < <(
  find dist-app -maxdepth 1 -type f \
    \( -name '*.AppImage' -o -name '*.deb' -o -name '*.yml' \) \
    -print | sort
)
if [[ ${#artifacts[@]} -lt 2 ]]; then
  echo "Expected AppImage and .deb artifacts were not generated." >&2
  exit 1
fi

cp -f -- "${artifacts[@]}" "$artifact_destination/"

echo "Linux artifacts copied to: $artifact_destination"
for artifact in "${artifacts[@]}"; do
  file "$artifact"
  sha256sum "$artifact"
done
