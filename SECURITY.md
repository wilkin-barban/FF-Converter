# Política de seguridad

## Versiones compatibles

La rama `main` y la versión estable más reciente reciben correcciones de seguridad.

## Informar una vulnerabilidad

No abra una issue pública para una vulnerabilidad sin corregir. Use **Security → Report a vulnerability**:

https://github.com/wilkin-barban/FF-Converter/security/advisories/new

Incluya una descripción, impacto, pasos mínimos para reproducir y, si existe, una corrección sugerida. No adjunte videos personales, credenciales, claves ni logs sin sanitizar.

## Alcance prioritario

- Límites IPC entre renderer, preload y proceso principal.
- Lectura o escritura fuera de rutas seleccionadas.
- Ejecución de argumentos FFmpeg no validados.
- Exposición de datos privados en logs.
- Manipulación de paquetes, actualizaciones o binarios bundled.
