# FF-Converter — Guía de desarrollo

## Entorno soportado

- Node.js 20 o superior.
- npm compatible con la versión instalada de Node.js.
- Windows 11 o Ubuntu Linux.
- FFmpeg y FFprobe disponibles en `PATH` durante la fase actual.
- Visual Studio 2022 Build Tools con C++ y Windows SDK para generar paquetes
  Windows cuando `better-sqlite3` deba compilarse para el ABI de Electron.

Línea base observada durante la auditoría del 2026-07-26:

- Node.js `v26.4.0`.
- npm `12.0.1`.
- FFmpeg y FFprobe `8.1.2`.

La aplicación debe continuar siendo compatible con Node.js 20, que es la versión mínima declarada. La versión de Node.js usada por Electron en producción es la incluida por Electron, no necesariamente la instalada globalmente.

## Instalación

```sh
npm ci
```

## Desarrollo

```sh
npm run dev
```

El comando compila el proceso principal y preload, inicia Vite y abre Electron.

## Verificación

Para ejecutar la línea base completa:

```sh
npm run verify
```

Este comando ejecuta, en orden:

1. Typecheck de todos los workspaces.
2. Pruebas unitarias.
3. Build de producción.

También pueden ejecutarse por separado:

```sh
npm run typecheck
npm run test:unit
npm run build
```

## Fuentes y artefactos

- Los archivos fuente viven en `apps/*/src` y `packages/*/src`.
- Los resultados compilados viven exclusivamente en carpetas `dist`.
- No deben guardarse archivos `.js` generados junto a `.ts` o `.tsx`.
- `apps/desktop/dev-runner.js` es una excepción intencional: es un script fuente de desarrollo.

## FFmpeg durante el desarrollo

El proceso principal utiliza `FFmpegLocator` y admite:

- `bundled`: busca en `resources/ffmpeg/<platform>-<arch>`; si los binarios aún no están presentes durante desarrollo, informa el fallback y utiliza `PATH`.
- `system`: resuelve `ffmpeg` y `ffprobe` desde `PATH`.
- `custom`: exige rutas absolutas válidas para ambos binarios.

Al cambiar el modo o las rutas desde Ajustes, las capacidades se recalculan y Diagnóstico muestra el modo solicitado, el modo efectivo y cualquier fallback.

Para comprobar el entorno:

```sh
ffmpeg -version
ffprobe -version
```

Los binarios redistribuibles y sus avisos de licencia deben incorporarse siguiendo `resources/ffmpeg/README.md`. No se debe aprobar un paquete de producción mientras solo existan los placeholders.

## Criterio de línea base

Antes de iniciar una fase:

- `npm ci` debe poder restaurar dependencias.
- `npm run verify` debe finalizar correctamente.
- Los cambios deben incluir pruebas proporcionales al riesgo.
- No deben introducirse archivos compilados dentro de `src`.
- Los fallos deben conservar suficiente salida para diagnóstico.
