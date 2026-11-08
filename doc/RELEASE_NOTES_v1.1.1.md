# FF-Converter v1.1.1

Versión de migración del repositorio. No hay cambios funcionales respecto de 1.1.0.

## Repositorio nuevo

El proyecto ahora se publica en https://github.com/wilkin-barban/FF-Converter. El repositorio anterior (`wilkinbarban/FF-Converter`) ya no está disponible.

## Instalar o actualizar

- **Windows:** instalá `FF-Converter-1.1.1-setup-x64.exe`. La aplicación avisa cuando hay una versión nueva; confirmá la descarga y elegí reiniciar cuando esté lista.
- **Ubuntu AppImage:** descargá `FF-Converter-1.1.1-x86_64.AppImage`, otorgale permiso de ejecución y abrilo.
- **Ubuntu/Debian DEB:** instalá `FF-Converter-1.1.1-amd64.deb` con `sudo apt install ./FF-Converter-1.1.1-amd64.deb`. Los DEB no se auto-instalan: el aviso abre la página oficial de releases.

Si venís de `1.1.0`, descargá `1.1.1` manualmente una vez: el actualizador de `1.1.0` apuntaba al repositorio anterior.

## Cambios

- URL del actualizador, descargas, issues, seguridad y metadatos actualizadas al repositorio nuevo.
- Pipeline de release y documentación adaptados a `wilkin-barban/FF-Converter`.
- Artefactos reconstruidos y firmados con el certificado personal de desarrollo.

## Verificación

- Se ejecutaron `npm run verify` y `npm run release:preflight`.
- El instalador de Windows tiene firma Authenticode válida en este equipo.
- La release incluye `SHA256SUMS.txt` para verificar las descargas.

## Notes in English

Repository migration release. No functional changes from 1.1.0. Download 1.1.1 manually once if you are on 1.1.0, because the old updater pointed to the previous repository. From 1.1.1 onward, updates use https://github.com/wilkin-barban/FF-Converter.

## Notas em português

Versão de migração do repositório. Sem mudanças funcionais em relação à 1.1.0. Baixe a 1.1.1 manualmente uma vez se estiver na 1.1.0, porque o atualizador antigo apontava para o repositório anterior. A partir da 1.1.1, as atualizações usam https://github.com/wilkin-barban/FF-Converter.
