# FF-Converter v1.1.1

Versión de migración del repositorio. No hay cambios funcionales respecto de 1.1.0.

Los assets publicados de esta versión fueron reconstruidos por CI y firmados con el certificado CI exportable `E166...`. La build inicial firmada con el certificado local `12A84...` fue reemplazada.

## Repositorio nuevo

El proyecto ahora se publica en https://github.com/wilkin-barban/FF-Converter. El repositorio anterior (`wilkinbarban/FF-Converter`) ya no está disponible.

## Instalar o actualizar

- **Windows:** instalá `FF-Converter-1.1.1-setup-x64.exe`. La aplicación avisa cuando hay una versión nueva; confirmá la descarga y elegí reiniciar cuando esté lista.
- **Ubuntu AppImage:** descargá `FF-Converter-1.1.1-x86_64.AppImage`, otorgale permiso de ejecución y abrilo.
- **Ubuntu/Debian DEB:** instalá `FF-Converter-1.1.1-amd64.deb` con `sudo apt install ./FF-Converter-1.1.1-amd64.deb`. Los DEB no se auto-instalan: el aviso abre la página oficial de releases.

Si venís de `1.1.0`, descargá `1.1.1` manualmente una vez: el actualizador de `1.1.0` apuntaba al repositorio anterior. Si ya descargaste una build anterior de `1.1.1`, volvé a descargar los assets para obtener la build CI firmada con `E166...`.

## Cambios

- URL del actualizador, descargas, issues, seguridad y metadatos actualizadas al repositorio nuevo.
- Pipeline de release y documentación adaptados a `wilkin-barban/FF-Converter`.
- Artefactos reconstruidos por CI y firmados con el certificado CI exportable (`E166...`).

## Verificación

- Se ejecutaron `npm run verify` (73 tests) y `npm run release:preflight`.
- Se aprobaron `npm run test:packaged` sobre `win-unpacked` y la matriz de aceptación con FFmpeg bundled (H.264, H.265, AAC).
- El instalador de Windows fue firmado por CI con el certificado `E166...`; la firma existe. Para verlo como `Valid`, importar `build/certificates/FF-Converter-Personal-Development-CI.cer` en `TrustedPublisher` y `Root`.
- La release incluye `SHA256SUMS.txt` para verificar las descargas.
- El workflow `Release` de CI (run `42433639116`) construyó y firmó Windows y Linux correctamente.

## Notes in English

Repository migration release. No functional changes from 1.1.0. The published 1.1.1 assets were rebuilt by CI and signed with the exportable CI certificate (`E166...`). Download 1.1.1 manually once if you are on 1.1.0, because the old updater pointed to the previous repository. Re-download the 1.1.1 assets if you already downloaded the initial local-certificate build.

## Notas em português

Versão de migração do repositório. Sem mudanças funcionais em relação à 1.1.0. Os assets publicados da 1.1.1 foram reconstruídos pela CI e assinados com o certificado CI exportável (`E166...`). Baixe a 1.1.1 manualmente uma vez se estiver na 1.1.0, porque o atualizador antigo apontava para o repositório anterior. Baixe novamente os assets da 1.1.1 se você já baixou a build inicial assinada com o certificado local.
