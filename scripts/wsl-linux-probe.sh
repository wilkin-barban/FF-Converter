#!/usr/bin/env bash
set -euo pipefail

source /etc/os-release
printf 'OS=%s\n' "$PRETTY_NAME"
printf 'KERNEL=%s\n' "$(uname -r)"
printf 'ARCH=%s\n' "$(uname -m)"
printf 'USER=%s\n' "$(id -un)"

for command_name in node npm python3 make g++ git file dpkg-deb fakeroot; do
  command_path="$(command -v "$command_name" || true)"
  printf '%s=%s\n' "$command_name" "${command_path:-missing}"
done

printf 'NODE_VERSION=%s\n' "$(node --version 2>/dev/null || echo missing)"
printf 'NPM_VERSION=%s\n' "$(npm --version 2>/dev/null || echo missing)"
printf 'HOME_FREE_KB=%s\n' "$(df -Pk "$HOME" | awk 'NR == 2 { print $4 }')"
printf 'WINDOWS_FREE_KB=%s\n' "$(df -Pk /mnt/c | awk 'NR == 2 { print $4 }')"
