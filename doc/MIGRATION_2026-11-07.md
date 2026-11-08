# Migración del repositorio (2026-11-07)

## Resumen

- Repositorio anterior: `wilkinbarban/FF-Converter` (cuenta anterior, ya no disponible).
- Repositorio oficial: https://github.com/wilkin-barban/FF-Converter.
- Motivo: cambio de cuenta de GitHub. Se preserva el historial de Git y se republica la aplicación con las URL nuevas.
- Versión publicada en el repositorio nuevo: `v1.1.1`.

## Cambios aplicados

- `origin` actualizado a `https://github.com/wilkin-barban/FF-Converter.git`.
- URL del actualizador, descargas, issues, avisos de seguridad, `homepage`, `repository` y `bugs` actualizadas.
- `electron-builder.yml` publica contra `wilkin-barban/FF-Converter`.
- READMEs en español, inglés y portugués actualizados a los artefactos `1.1.1`.
- Workflow de release y documentación adaptados al repositorio nuevo.
- Release `v1.1.1` publicada con instaladores, metadatos de actualización y checksums.
- Etiqueta `v1.1.0` conservada para mantener el historial.

## Impacto para usuarios

- Las instalaciones de `1.1.0` no pueden autoactualizarse porque su actualizador apunta al repositorio anterior, que ya no existe. Deben descargar `1.1.1` manualmente una vez.
- A partir de `1.1.1`, el actualizador consulta el repositorio nuevo.

## Publicación

### Build local firmada (Windows)

```powershell
npm ci
npm run verify
npm run release:preflight
npm run package --workspace=apps/desktop
```

La firma usa el certificado `CN=FF-Converter Personal Development` del almacén `Cert:\CurrentUser\My`. Verificar con:

```powershell
Get-AuthenticodeSignature .\dist-app\FF-Converter-1.1.1-setup-x64.exe
```

### Build Linux (WSL/Ubuntu)

```bash
scripts/package-linux-wsl.sh /mnt/c/Users/wilki/proyectos/FF-Converter /mnt/c/Users/wilki/proyectos/FF-Converter/dist-app
```

### Publicación por CI

El workflow `Release` se dispara con tags `v*`. La firma de Windows en CI requiere los secretos `WIN_CSC_LINK` y `WIN_CSC_KEY_PASSWORD`; sin ellos se generan artefactos sin firma. La clave privada del certificado local no es exportable, por lo que no puede reutilizarse directamente en CI.

## Verificación

- `npm run verify` (73 tests).
- `npm run release:preflight`.
- `npm run test:packaged` sobre `win-unpacked`.
- `npm run test:acceptance -- resources/ffmpeg/win32-x64` (H.264, H.265, AAC).
- Firma Authenticode del instalador de Windows con el certificado documentado.
- `SHA256SUMS.txt` adjunto a la release.
- Workflow CI del repositorio nuevo en verde.

## Rollback

- El tag `v1.1.0` y la rama local `backup/pre-migration-20261107` permiten recuperar el estado anterior del código.
- La release anterior del repositorio viejo ya no está disponible públicamente; conservar los artefactos locales si se necesita reinstalar `1.1.0`.
