# Historial de cambios

## 1.1.1 - 2026-11-07

### Cambiado

- Repositorio migrado a https://github.com/wilkin-barban/FF-Converter.
- Actualizadas las URL de actualizaciones, descargas, issues, seguridad y metadatos del proyecto.
- Actualizado el flujo de publicación y la documentación para el repositorio nuevo.
- Assets de la release reconstruidos por CI y firmados con el certificado CI exportable.
- Sin cambios funcionales respecto de 1.1.0.

### Actualización

- Las instalaciones de 1.1.0 deben descargar 1.1.1 manualmente una vez porque su actualizador apuntaba al repositorio anterior.
- Si ya se descargó la build inicial de 1.1.1, volver a descargar los assets para obtener la build CI firmada con E166.
- Windows: `FF-Converter-1.1.1-setup-x64.exe`.
- Ubuntu AppImage: `FF-Converter-1.1.1-x86_64.AppImage`.
- Ubuntu/Debian DEB: `FF-Converter-1.1.1-amd64.deb`.

## 1.1.0 - 2026-07-29

### Añadido

- Actualizador de GitHub Releases para Windows y AppImage: no revisa durante desarrollo, no descarga sin confirmación y muestra progreso y reinicio cuando corresponde.
- Reglas de carpetas vigiladas más fiables: los post-procesos fallidos tienen reintentos acotados, se cancelan al desactivar o cambiar una regla y no se duplican.
- Validación más estricta de flags FFmpeg personalizados para rechazar argumentos no permitidos.

### Seguridad y estabilidad

- Actualizaciones con confirmación explícita y verificación de integridad.
- Mejoras de recuperación y control de concurrencia en trabajos y watchers.

## 1.0.0 - 2026-07-29

### Añadido

- Conversión multimedia por lotes con cola persistente.
- Perfiles, historial y carpetas vigiladas.
- FFmpeg y FFprobe bundled para Windows x64 y Linux x64.
- Diagnóstico de CPU, FFmpeg y aceleración GPU.
- Consola de logs persistente con filtros, búsqueda, copia y limpieza.
- Interfaz en español e inglés con cambio en vivo.
- Temas claro, oscuro y del sistema.
- Instalador NSIS, AppImage y paquete DEB.

### Seguridad y estabilidad

- Aislamiento de contexto, sandbox y navegación externa bloqueada.
- Validación de salidas antes de completar trabajos.
- Recuperación de trabajos interrumpidos y control de concurrencia.
- Sanitización, persistencia y rotación limitada de logs.
