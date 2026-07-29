# FFmpeg integrado

FF-Converter incluye FFmpeg y FFprobe estáticos para que una instalación del
sistema no sea obligatoria. El modo predeterminado es `bundled`; si los
ejecutables integrados faltan, la aplicación conserva el fallback existente a
`PATH`. Los modos `system` y `custom` siguen disponibles en Ajustes.

## Plataformas incluidas

- Windows x64: FFmpeg 8.1.2 Essentials de Gyan, GPLv3.
- Linux x64: FFmpeg n8.1 (8.1.2-31) de BtbN, GPLv3.

Ambos builds incluyen `libx264` y `libx265`. El build de Windows también fue
verificado con NVENC, Intel QSV y AMD AMF. La presencia de un encoder no
garantiza que el equipo tenga el hardware y los controladores necesarios.

`manifest.json` es la fuente reproducible de versiones, descargas y hashes.
`THIRD_PARTY_NOTICES.md` contiene atribución y enlaces al código fuente, y
`GPL-3.0.txt` contiene la licencia que acompaña a los binarios.

La aplicación propia permanece bajo MIT. Los ejecutables FFmpeg se distribuyen
como programas separados bajo GPLv3 y no se enlazan con el código Electron.

