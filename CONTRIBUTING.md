# Contribuir a FF-Converter

Gracias por ayudar a mejorar el proyecto. Antes de enviar un cambio, abra una issue para describir el problema o la mejora y evitar trabajo duplicado.

## Preparación

```bash
git clone https://github.com/wilkin-barban/FF-Converter.git
cd FF-Converter
npm ci
npm run verify
```

Use Node.js 22.12–26. Para ejecutar la aplicación en desarrollo también necesita FFmpeg y FFprobe en `PATH`, o los binarios indicados en `resources/ffmpeg/manifest.json`.

## Flujo

1. Cree una rama desde `main`.
2. Mantenga cada cambio enfocado.
3. Incluya pruebas para los comportamientos modificados.
4. Ejecute `npm run verify`.
5. Explique en el pull request qué cambió, por qué y cómo se verificó.

Use Conventional Commits: `fix(queue): ...`, `feat(logs): ...` o `docs: ...`.

## Reglas de distribución

- No confirme `node_modules`, `dist`, `dist-app`, logs ni bases de datos.
- No confirme certificados, claves ni otros secretos.
- No agregue binarios FFmpeg directamente a Git.
- Si actualiza FFmpeg, actualice juntos el manifiesto, hashes, avisos legales y enlaces de código fuente.
- Conserve el aislamiento de Electron: `contextIsolation`, sandbox y preload con API explícita.

## Reportar errores

Incluya sistema operativo, versión, pasos para reproducir, resultado esperado y logs sanitizados. No publique rutas privadas, videos personales, credenciales ni claves.
