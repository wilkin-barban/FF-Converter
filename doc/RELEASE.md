# Empaquetado y lanzamiento

## Flujo reproducible

En una copia limpia del repositorio:

```powershell
npm ci
npm run verify
npm run release:preflight
npm run test:acceptance -- resources/ffmpeg/win32-x64
npm run package
npm run test:packaged
```

`release:preflight` bloquea deliberadamente la distribución cuando faltan los
binarios bundled, sus avisos legales o el build. Para desarrollo puede usarse
`release:preflight:system`; esa variante no constituye aprobación de release.

## Plataformas

- Windows 11 x64: instalador NSIS asistido y paquete `win-unpacked`.
- Ubuntu x64: AppImage y DEB. Deben generarse y probarse en Ubuntu; no se
  consideran validados por construirlos desde Windows.
- Node.js: 20 a 26 para tareas del repositorio. La aplicación usa el runtime de
  Electron una vez empaquetada.
- El agente de build Windows debe incluir Visual Studio 2022 Build Tools con
  “Desktop development with C++”, Windows SDK y Python para reconstruir
  `better-sqlite3` cuando no exista un prebuilt para el ABI de Electron.

## FFmpeg redistribuible

Antes de publicar, colocar `ffmpeg` y `ffprobe` en el directorio de plataforma
correspondiente y reemplazar `THIRD_PARTY_NOTICES.md` con los datos exactos:
versión, configuración, URL de fuente/binario, licencia, oferta de código fuente
y SHA-256. No mezclar binarios de proveedores o configuraciones distintas.

## Identidad visual

La fuente raster de marca vive en `build/icon-master.png`. Los formatos usados
por el producto son `build/icon.ico` para Windows y `build/icon.png` para Linux,
la ventana Electron y el renderer. Al regenerarlos deben conservarse el símbolo
de película, reproducción y ciclo de conversión, la paleta cian/azul/violeta y
la legibilidad desde 16 px.

## Firma

El paquete puede construirse sin certificado para pruebas internas, pero
Windows mostrará advertencias de reputación. Para distribución pública debe
configurarse un certificado Authenticode mediante las variables seguras
admitidas por electron-builder. Los secretos no deben almacenarse en el
repositorio.

## Solución de problemas

- `better-sqlite3` no carga: reconstruir dependencias para la versión de
  Electron y comprobar arquitectura x64. En Windows, confirmar que MSVC Build
  Tools y Windows SDK están instalados.
- FFmpeg aparece en modo system: faltan los binarios en `resources/ffmpeg` o no
  fueron copiados a `resources` del paquete.
- NSIS no se genera: comprobar conectividad/caché de electron-builder y espacio
  disponible.
- El smoke test vence: ejecutar el EXE desde una terminal y revisar los logs en
  el directorio de datos de usuario.
- GPU no disponible: es válido si el trabajo registra fallback y completa por
  CPU.

## Actualizaciones automáticas

En instaladores Windows y AppImage, FF-Converter busca actualizaciones después de abrir la ventana principal. Nunca descarga sin confirmación: la persona usuaria elige cuándo descargar y reiniciar. Las instalaciones DEB no se actualizan solas; el botón abre exactamente la página oficial de la versión más reciente para descargar el paquete correspondiente.

Las publicaciones deben incluir los metadatos de actualización que genera electron-builder junto con el instalador NSIS, sus blockmaps y los archivos AppImage/DEB.
