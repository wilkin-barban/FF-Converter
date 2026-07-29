# FF-Converter

<p align="center"><img src="build/icon.png" alt="FF-Converter icon" width="128"></p>

**A Windows and Ubuntu desktop media converter for FFmpeg batch workflows, without requiring a separate FFmpeg installation.**

[Español](README.md) · English · [Português do Brasil](README.pt-BR.md)

## Download

**[Open the latest release](https://github.com/wilkinbarban/FF-Converter/releases/latest)**

| System | Recommended file |
|---|---|
| Windows 10/11 x64 | `FF-Converter-1.0.0-setup-x64.exe` |
| Ubuntu x64, portable | `FF-Converter-1.0.0-x86_64.AppImage` |
| Ubuntu/Debian x64 | `FF-Converter-1.0.0-amd64.deb` |

FFmpeg and FFprobe are bundled. You do not need to install them separately.

## Install on Windows

1. Download the `.exe` installer.
2. Open it and follow the setup wizard.
3. If Microsoft Defender SmartScreen warns you, choose **More info** and verify that the publisher is `FF-Converter Personal Development`.

This personal release uses a self-signed certificate. The signature protects file integrity, but Windows may not recognize its reputation yet.

## Install on Ubuntu

### AppImage

Allow the file to run as a program in its properties, or use:

```bash
chmod +x FF-Converter-1.0.0-x86_64.AppImage
./FF-Converter-1.0.0-x86_64.AppImage
```

### DEB package

Open the `.deb` with the software installer or run:

```bash
sudo apt install ./FF-Converter-1.0.0-amd64.deb
```

## First conversion

1. Drag videos, audio files, or an entire folder into **Convert**.
2. Select an output folder and preset.
3. Review the jobs and start conversion.
4. Follow progress in **Queue**.

## Main features

- Batch conversion and consistent concurrent-job control.
- Reusable presets, history, and watched folders.
- FFmpeg, CPU, and GPU diagnostics.
- Searchable and filterable live logs.
- Live Spanish/English language switching.
- Light, dark, and system themes.
- Interrupted-job recovery and output validation.

Hardware acceleration depends on the GPU, drivers, and detected encoders. When an option is unsupported, FF-Converter reports the reason and can use CPU when the preset allows it.

## Verify a download

Every release includes `SHA256SUMS.txt`.

```powershell
Get-FileHash .\FF-Converter-1.0.0-setup-x64.exe -Algorithm SHA256
```

```bash
sha256sum FF-Converter-1.0.0-x86_64.AppImage
```

Compare the result with the published checksum.

## Privacy and support

Conversions run locally. FF-Converter does not need to upload your media. Logs redact the home directory and credentials accidentally included in URLs.

If something fails, review **Diagnostics** and **Log console**, then open an [issue](https://github.com/wilkinbarban/FF-Converter/issues).

## Development

Requirements: Node.js 20–26, npm, and FFmpeg/FFprobe for development.

```bash
npm ci
npm run verify
npm run dev
```

Redistributable FFmpeg binaries are excluded from Git because of their size. `resources/ffmpeg/manifest.json` records reproducible versions, URLs, and hashes. See [DEVELOPMENT.md](DEVELOPMENT.md) and [RELEASE.md](RELEASE.md).

## Licenses

FF-Converter source code is licensed under [MIT](LICENSE). The separate bundled FFmpeg/FFprobe executables are distributed under GPLv3. See the [third-party notices](resources/ffmpeg/THIRD_PARTY_NOTICES.md) and [GPLv3 text](resources/ffmpeg/GPL-3.0.txt).

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
