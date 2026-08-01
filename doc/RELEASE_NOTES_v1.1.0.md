# FF-Converter v1.1.0

Versión menor con actualizaciones automáticas controladas y mejoras de fiabilidad y seguridad.

## Actualizar e instalar

- **Windows:** instalá `FF-Converter-1.1.0-setup-x64.exe`. La aplicación avisa cuando hay una versión nueva; confirmá la descarga y elegí reiniciar cuando esté lista.
- **Ubuntu AppImage:** descargá `FF-Converter-1.1.0-x86_64.AppImage`, otorgale permiso de ejecución y abrilo. También puede descargar actualizaciones con confirmación.
- **Ubuntu/Debian DEB:** instalá `FF-Converter-1.1.0-amd64.deb` con `sudo apt install ./FF-Converter-1.1.0-amd64.deb`. Los DEB no se auto-instalan: el aviso abre la página oficial de releases para descargar el paquete nuevo.

## Novedades

- Actualizador de GitHub Releases para Windows y AppImage: no revisa durante desarrollo, no descarga sin confirmación y muestra progreso y reinicio cuando corresponde.
- Reglas de carpetas vigiladas más fiables: los post-procesos fallidos tienen reintentos acotados, se cancelan al desactivar o cambiar una regla y no se duplican.
- Validación más estricta de flags FFmpeg personalizados para rechazar argumentos no permitidos.

## Verificación

Se ejecutaron `npm run verify`, `npm run release:preflight`, las pruebas focalizadas del actualizador y `git diff --check`.

## Notes in English

Windows and AppImage ask before downloading updates; DEB opens the official release page for manual installation. Watcher post-actions now retry safely, and custom FFmpeg flags are strictly allowlisted.

## Notas em português

Windows e AppImage pedem confirmação antes de baixar atualizações; DEB abre a página oficial para instalação manual. As ações pós-processamento dos watchers agora tentam novamente com segurança, e flags FFmpeg personalizados usam uma lista estrita de permissões.
