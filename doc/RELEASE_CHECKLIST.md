# Checklist reproducible de lanzamiento

Versión: __________  Commit: __________  Fecha: __________

## Repositorio y release

- [ ] `git remote -v` apunta a `wilkin-barban/FF-Converter`.
- [ ] El tag `vX.Y.Z` coincide con la versión de `package.json`.
- [ ] La release incluye instaladores, `latest.yml`, `latest-linux.yml`, blockmaps y `SHA256SUMS.txt`.
- [ ] El actualizador apunta a `https://github.com/wilkin-barban/FF-Converter/releases/latest`.
- [ ] La firma Authenticode del instalador de Windows fue verificada o su ausencia fue aceptada explícitamente.


Responsable técnico: __________  Responsable de publicación: __________

## Fuente y dependencias

- [ ] El árbol de trabajo corresponde al commit indicado y no contiene cambios accidentales.
- [ ] Node cumple el rango declarado y `npm ci` termina desde un clon limpio.
- [ ] `npm run verify` termina sin errores.
- [ ] `npm run release:preflight` informa `APTO`.
- [ ] Los binarios bundled tienen origen, versión, configuración, licencia y SHA-256 registrados.
- [ ] `better-sqlite3` carga dentro del runtime empaquetado.

## Pruebas

- [ ] `npm run test:acceptance -- resources/ffmpeg/win32-x64` aprueba H.264, H.265 y AAC.
- [ ] La prueba de GPU no disponible confirma fallback a CPU.
- [ ] `npm run test:packaged` aprueba sobre `win-unpacked`.
- [ ] Instalación, actualización y desinstalación se verificaron en Windows 11 limpio.
- [ ] AppImage y DEB se verificaron en Ubuntu soportado.
- [ ] Watcher `keep`, `move` y `delete` se verificó con archivos reales.

## Artefactos y seguridad

- [ ] NSIS, AppImage y DEB muestran el icono FF-Converter (película, play y ciclo), versión, licencia y avisos correctos.
- [ ] Los artefactos no dependen del árbol del monorepo.
- [ ] Se calcularon y publicaron SHA-256 de los instaladores.
- [ ] La firma de código se aplicó o su ausencia fue aceptada explícitamente.
- [ ] No hay credenciales, rutas privadas ni logs personales en el paquete.

## Aprobación

Resultado: [ ] APROBADO  [ ] RECHAZADO

Firma técnica: ____________________  Firma de publicación: ____________________
