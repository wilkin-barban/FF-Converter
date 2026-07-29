# FF-Converter — Plan de mejoras, estabilización y cierre funcional

Fecha de auditoría: 2026-07-26  
Documento base: `FF-Converter_Plan_Arquitectura_Implementacion.md`  
Estado evaluado: prototipo funcional avanzado / alfa técnica

## 1. Propósito

Este documento convierte los hallazgos de la revisión técnica en un plan de implementación por fases. Su objetivo es llevar FF-Converter desde el estado actual hasta un MVP seguro, probado y distribuible para Windows 11 y Ubuntu Linux.

El plan cubre:

- Correcciones funcionales y de seguridad.
- Finalización de características parcialmente implementadas.
- Pruebas unitarias, de integración y de extremo a extremo.
- Distribución de FFmpeg y empaquetado.
- Criterios de aceptación verificables.
- Auditoría específica del módulo Consola Logs.

## 2. Estado actual resumido

Estimación frente al plan original:

| Área | Avance estimado | Estado |
|---|---:|---|
| Arquitectura general | 80 % | Bien encaminada |
| Conversión principal | 70 % | Funcional con brechas |
| Inspección multimedia | 75 % | Funcional |
| Detección de hardware | 80 % | Bien implementada |
| Cola y progreso | 65 % | Parcial |
| Presets y compatibilidad | 60 % | Parcial |
| Persistencia e historial | 75 % | Funcional con deuda |
| Interfaz | 70 % | Funcional con controles faltantes |
| Consola Logs | 65 % | Recorrido básico funcional, cobertura parcial |
| Seguridad | 35 % | Requiere correcciones críticas |
| Pruebas | 35 % | Cobertura insuficiente |
| Empaquetado y distribución | 40 % | Configurado, no cerrado |

Avance global estimado:

- MVP funcional: 60–65 %.
- Plan completo: 45–50 %.
- Preparación para distribución estable: 30–35 %.

Validación realizada durante la auditoría:

- `npm test`: 4 archivos y 5 pruebas aprobadas.
- `npm run build`: compilación TypeScript y Vite aprobada.
- La compilación correcta no sustituye las pruebas de conversión real ni las pruebas del instalador.

## 3. Fortalezas que deben preservarse

- Separación entre renderer, preload, proceso principal y núcleo multimedia.
- Uso de `contextIsolation: true` y `nodeIntegration: false`.
- Ejecución de FFmpeg/FFprobe con `spawn` y argumentos como array, sin shell.
- Snapshot de FFprobe asociado al trabajo.
- Plan efectivo intermedio antes de construir argumentos.
- Prueba real corta de encoders de hardware.
- Fallback automático GPU → CPU.
- Archivo de salida temporal y validación previa al renombrado.
- Persistencia SQLite con fallback JSON para desarrollo.
- UI con conversión, cola, watchers, historial, presets, diagnóstico, logs y ajustes.

## 4. Hallazgos prioritarios

### 4.1 Críticos

1. Electron se crea con `sandbox: false` y `webSecurity: false`.
2. La CSP admite `'unsafe-inline'` y `'unsafe-eval'`.
3. Los handlers IPC de IDs y rutas no tienen validación completa.
4. `openPath` y `showItemInFolder` aceptan rutas arbitrarias provenientes del renderer.
5. No están incluidos ni resueltos los binarios FFmpeg/FFprobe prometidos.
6. Los modos `bundled`, `system` y `custom` se guardan, pero no determinan los binarios usados.
7. No hay prueba end-to-end que confirme una conversión completa.
8. Las políticas de duplicados `skip` y `overwrite` no están correctamente diferenciadas.
9. La validación final puede eliminar el destino antes del renombrado.

### 4.2 Altos

1. El motor de compatibilidad no valida suficientemente codec/contenedor, perfiles, niveles, pixel format y subtítulos.
2. Las acciones `delete` y `move` de watchers no están implementadas.
3. Los watchers pueden reprocesar archivos existentes después de reinicios.
4. No existe control de espacio disponible ni estado `WAITING_FOR_SPACE`.
5. No existe pausa real por trabajo; `ProcessRunner.isPaused` no se utiliza.
6. La recuperación de trabajos interrumpidos es parcial.
7. Los logs no cubren FFmpeg, Watcher ni Database pese a declarar esos orígenes.
8. Los logs viven solo en memoria y desaparecen al cerrar la aplicación.
9. La validación de salida no verifica streams, codecs, resolución ni tolerancia de duración.

### 4.3 Medios

1. No se puede reordenar la cola ni editar prioridad desde la UI.
2. La ETA no usa media móvil.
3. El editor de presets expone solo una parte del modelo.
4. No existe edición/eliminación completa de presets personalizados.
5. Tema, idioma y rutas FFmpeg no están completamente conectados.
6. No hay selección de streams, portada, nomenclatura ni normalización avanzada de audio.
7. No hay perfiles específicos completos para Samsung, LG y Android TV.
8. Falta registro persistente de transiciones de estado.

## 5. Auditoría del módulo Consola Logs

### 5.1 Veredicto

El módulo está **parcialmente implementado y operativo en su recorrido básico**, pero no cumple todavía la descripción de “servicio centralizado que captura eventos de todos los orígenes”.

### 5.2 Matriz de verificación

| Entrega declarada | Resultado | Evidencia / observación |
|---|---|---|
| Servicio centralizado con INFO, WARN y ERROR | Cumple | `LoggerService` modela niveles, timestamp, source, message y details |
| Orígenes FFmpeg, Queue, Watcher, Database, Hardware y System | Parcial | Los tipos existen, pero solo System, Hardware y Queue se registran de forma significativa |
| Buffer de auditoría | Cumple parcialmente | Buffer en memoria de hasta 1000 entradas; no persiste entre reinicios |
| `system:getLogs` | Cumple | Handler IPC implementado |
| `system:clearLogs` | Cumple | Handler IPC implementado |
| `events:log-entry` en vivo | Cumple | Evento emitido por main y suscripción expuesta por preload |
| Carga inicial de logs | Cumple | `App.tsx` llama `getLogs()` al iniciar |
| Vista terminal con timestamp y componente | Cumple | `LogsView.tsx` renderiza hora, nivel, source, mensaje y details |
| Filtros ALL/INFO/WARN/ERROR | Cumple | Filtrado local implementado |
| Búsqueda por texto, componente y detalles | Cumple | Busca en message, source y details |
| Copiar logs | Cumple parcialmente | Copia los logs filtrados; no maneja rechazo del portapapeles |
| Limpiar logs | Cumple | Limpia main y store local |
| Navegación desde Sidebar | Cumple | Pestaña `logs` implementada |
| Contador de errores en vivo | Cumple | Derivado del store; se actualiza con eventos |
| Captura de FFmpeg | No cumple | `ProcessRunner` acumula stderr para el error final, pero no usa `LoggerService` ni transmite líneas informativas |
| Captura de Watcher | No cumple | `WatchService` usa `console.log/error` |
| Captura de Database | No cumple | `AppDatabase` usa `console.warn/error` |
| Captura completa de Queue | Parcial | Finalización y fallo sí; análisis fallido y fallback GPU usan `console.*` |
| Persistencia de logs | No cumple | El buffer se pierde al cerrar la aplicación |
| Evento de limpieza para consumidores | Parcial | `LoggerService` emite `cleared`, pero main/preload no lo transmiten |
| Tipado extremo a extremo | Parcial | `LogEntry` existe en shared-types, pero store, preload y App usan `any` |
| Sanitización de datos sensibles | No cumple | Las rutas completas pueden aparecer en mensajes y details |

### 5.3 Correcciones necesarias para cerrar Consola Logs

- Inyectar un contrato de logging en `QueueOrchestrator`, `WatchService`, `AppDatabase`, IPC y ejecución FFmpeg.
- Sustituir `console.*` de servicios de dominio por el logger central.
- Mantener `console.*` únicamente como salida secundaria del propio logger.
- Emitir eventos relevantes:
  - creación, inicio, pausa, reanudación, cancelación y reintento;
  - inspección FFprobe fallida;
  - fallback GPU → CPU;
  - watcher iniciado/detenido, archivo detectado, filtrado y error;
  - SQLite iniciado, migración, fallback JSON y corrupción;
  - FFmpeg iniciado, comando sanitizado, advertencias relevantes y error final.
- No enviar cada línea de progreso como log; mantener progreso estructurado separado.
- Añadir persistencia rotativa en archivo con límite de tamaño y retención.
- Añadir IPC para obtener ruta de logs y exportar un reporte técnico.
- Transmitir `events:logs-cleared` o responder mediante un estado central compartido.
- Tipar `logs`, `getLogs`, `onLogEntry` y callbacks con `LogEntry`.
- Añadir manejo de error al copiar al portapapeles.
- Aplicar sanitización/redacción configurable de rutas y argumentos sensibles.
- Añadir pruebas del buffer, límite, clear, streaming, filtros, búsqueda y badge.

## 6. Plan de implementación por fases

Las fases están ordenadas por riesgo. No debe iniciarse la distribución pública antes de completar las fases 0 a 6.

### Fase 0 — Línea base y control de calidad

Objetivo: establecer una base reproducible antes de modificar comportamiento.

Tareas:

- Documentar versiones soportadas de Node.js, npm, Electron, FFmpeg y sistemas operativos.
- Añadir scripts separados: `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `lint` y `package:verify`.
- Incorporar ESLint y una configuración consistente de formato.
- Eliminar o excluir artefactos JavaScript duplicados dentro de `src` si son salidas generadas.
- Definir fixtures multimedia pequeños y legalmente redistribuibles.
- Configurar CI para Windows y Ubuntu.
- Registrar cobertura y fijar un umbral inicial.

Criterios de aceptación:

- Instalación limpia reproducible.
- Build y pruebas pasan en Windows y Ubuntu.
- Ningún archivo generado dentro de `src` actúa como fuente alternativa accidental.
- CI conserva artefactos y logs cuando falla.

### Fase 1 — Seguridad de Electron e IPC

Objetivo: cumplir la sección de seguridad del plan original.

Tareas:

- Activar `sandbox: true`.
- Eliminar `webSecurity: false`.
- Endurecer CSP y separar la política de desarrollo de la de producción.
- Eliminar `'unsafe-eval'`; reducir o eliminar `'unsafe-inline'`.
- Empaquetar fuentes locales para evitar dependencias web en producción.
- Crear schemas Zod para IDs, arrays de rutas y operaciones del sistema.
- Validar sender/origen de cada handler IPC.
- Normalizar rutas con `path.resolve`.
- Autorizar únicamente rutas seleccionadas, registradas o generadas por la aplicación.
- Restringir `openPath` y `showItemInFolder`.
- Limitar y validar `customFFmpegFlags`.
- Añadir límites de cantidad de archivos, profundidad de escaneo y tamaño de payload IPC.

Criterios de aceptación:

- Electron no reporta advertencias de seguridad en producción.
- Renderer sin acceso a Node.js.
- IPC rechaza IDs, rutas y payloads inválidos.
- Una ruta arbitraria no registrada no puede abrirse desde el renderer.
- Pruebas de seguridad cubren traversal, rutas UNC, nombres Unicode y payloads excesivos.

### Fase 2 — Resolución y distribución de FFmpeg

Objetivo: hacer reales los modos bundled, system y custom.

Tareas:

- Crear `FFmpegLocator` o servicio equivalente.
- Resolver rutas distintas en desarrollo y aplicación empaquetada.
- Implementar modo bundled por plataforma.
- Implementar modo system mediante PATH.
- Implementar rutas personalizadas y validación previa.
- Invalidar y recalcular `cachedCapabilities` al cambiar configuración.
- Verificar versión, permisos, ejecución, encoders y ffprobe.
- Incluir binarios por plataforma en `resources/ffmpeg`.
- Añadir licencias y avisos de la compilación distribuida.
- Configurar `electron-builder` para copiar recursos externos.

Criterios de aceptación:

- Diagnóstico muestra la ruta efectiva real.
- Cambiar de modo actualiza capacidades sin reiniciar o solicita reinicio explícito.
- El paquete funciona en una máquina sin FFmpeg instalado.
- Los binarios y licencias están incluidos en NSIS, AppImage y DEB.

### Fase 3 — Integridad de archivos, duplicados y validación

Objetivo: impedir pérdida de datos y resultados silenciosamente incorrectos.

Tareas:

- Centralizar la resolución de nombres de salida.
- Implementar de forma explícita `suffix`, `skip` y `overwrite`.
- Añadir políticas de nombre por preset, resolución y codec.
- Evitar colisiones de temporales para archivos con el mismo basename.
- No eliminar el archivo final dentro del validador sin una decisión previa.
- Comprobar espacio libre antes de iniciar.
- Implementar `WAITING_FOR_SPACE`.
- Validar tolerancia de duración.
- Validar presencia y tipo de streams esperados.
- Validar codec, contenedor y resolución resultantes.
- Implementar finalización segura compatible con volúmenes distintos.
- Limpiar temporales de forma controlada.

Criterios de aceptación:

- La política por defecto nunca sobrescribe.
- `skip` no ejecuta FFmpeg y produce estado `SKIPPED`.
- `overwrite` requiere configuración explícita.
- Un fallo de validación conserva el destino anterior.
- Pruebas cubren duplicados, disco lleno, temporales, fallo de rename y archivo truncado.

### Fase 4 — Cola, estados y recuperación

Objetivo: completar el ciclo de vida y la resiliencia.

Tareas:

- Definir una máquina de estados y validar transiciones.
- Persistir cada transición con fecha y motivo.
- Marcar `RUNNING`, `ANALYZING` y `VALIDATING_OUTPUT` como `INTERRUPTED` al arrancar.
- Añadir reintento masivo y política opcional de recuperación automática.
- Evitar dos runners para el mismo job.
- Añadir reordenamiento y prioridad desde la UI.
- Implementar pausa/reanudación real por trabajo cuando la plataforma lo permita.
- Diferenciar pausa de cola de pausa de procesos activos.
- Mejorar cancelación y limpieza en Windows/Linux.
- Calcular concurrencia según CPU, GPU, remux y extracción.
- Implementar ETA con media móvil.

Criterios de aceptación:

- Reiniciar durante una conversión deja un trabajo recuperable.
- Ningún trabajo se ejecuta dos veces simultáneamente.
- Cancelar termina el proceso y sus hijos.
- Reordenar y cambiar prioridad altera el siguiente trabajo seleccionado.
- Tests simulan concurrencia, reinicio, cancelación y fallback.

### Fase 5 — Compatibilidad, presets y streams

Objetivo: evitar conversiones innecesarias y producir resultados compatibles.

Tareas:

- Modelar compatibilidad por contenedor y dispositivo.
- Evaluar todos los streams relevantes, no solo el primero.
- Validar perfil, nivel, pixel format, bit depth, resolución y framerate.
- Implementar políticas de subtítulos: copy, convert, remove y burn-in.
- Añadir compatibilidad correcta de subtítulos con MP4/MKV/WebM.
- Implementar selección de pistas de audio, idioma y disposición.
- Implementar HDR preserve y HDR → SDR como decisiones explícitas.
- Añadir normalización de audio opcional.
- Completar presets Samsung, LG, Android TV, web, archivo y Apple Music.
- Completar MP3, AAC/M4A, ALAC, FLAC y WAV.
- Preservar portada y metadatos musicales cuando corresponda.
- Mostrar el plan efectivo antes de encolar.
- Ampliar creación, edición, clonación y borrado de presets personalizados.

Criterios de aceptación:

- El usuario puede ver qué se copiará, convertirá o eliminará.
- No se copian streams incompatibles al contenedor destino.
- Tests cubren múltiples audios/subtítulos, HDR, audio-only y stream copy.
- Los presets del sistema producen salidas verificadas en dispositivos objetivo o matrices documentadas.

### Fase 6 — Watchers y Consola Logs

Objetivo: cerrar las dos áreas de automatización y observabilidad.

#### Watchers

- Persistir huella o identidad de archivos procesados.
- Definir claramente si se procesan archivos existentes al activar una regla.
- Implementar subcarpetas, extensiones, estabilización y política de duplicados por regla.
- Ejecutar `keep`, `delete` y `move` únicamente después del éxito validado.
- Prevenir que output dentro del árbol vigilado cree bucles.
- Restaurar reglas de forma idempotente.
- Añadir estados y logs de watchers.

#### Consola Logs

- Aplicar todas las correcciones de la sección 5.3.
- Añadir persistencia rotativa.
- Añadir exportación de reporte y apertura de carpeta de logs.
- Separar auditoría, progreso y diagnóstico detallado.
- Añadir filtros por source, rango temporal y job ID.
- Mostrar contador de errores no revisados, no solo total acumulado.
- Definir cuándo se reinicia o confirma el contador.

Criterios de aceptación:

- Reiniciar no reprocesa archivos sin una política explícita.
- `move/delete` solo ocurre tras `COMPLETED`.
- Todos los sources declarados generan al menos eventos reales probados.
- Los logs sobreviven un reinicio y respetan retención.
- La consola maneja miles de entradas sin degradación severa.

#### Estado de implementación — completada el 26 de julio de 2026

Se implementó la base funcional de la fase:

- Logger central persistente en JSONL, con carga al iniciar, límite de 1000
  entradas en memoria, rotación a 5 MB y retención de tres archivos.
- Sanitización del directorio personal y credenciales incluidas en URLs antes
  de persistir o emitir entradas.
- Instrumentación para `System`, `Hardware`, `Queue`, `Database`, `Watcher` y
  `FFmpeg`; el runner emite diagnósticos relevantes de `stderr` y la cola
  registra el comando reproducible y los fallback de GPU.
- IPC y vista de consola ampliados con filtros por severidad, origen y rango
  temporal, búsqueda que permite localizar IDs de trabajos, limpieza
  sincronizada, copia, exportación y apertura de la carpeta de logs.
- El contador lateral representa errores no revisados y se reinicia al abrir
  la pestaña de logs.
- Los watchers persisten huellas basadas en regla, ruta, tamaño y fecha de
  modificación; permiten decidir si procesan archivos existentes y evitan
  reenviar archivos ya completados.
- Se añadieron subcarpetas, extensiones, estabilización, política de duplicados,
  prevención de bucles y restauración idempotente de reglas editadas.
- Las acciones `keep`, `delete` y `move` se ejecutan únicamente después de que
  el trabajo alcanza `COMPLETED`; `move` admite omitir, sobrescribir o generar
  un sufijo y contempla movimientos entre volúmenes.

Validación automatizada:

- `npm run verify` finaliza correctamente.
- 10 archivos de prueba y 46 pruebas superadas.
- TypeScript y la compilación de producción finalizan sin errores.
- Hay pruebas específicas para persistencia, sanitización, limpieza, rotación,
  exportación, huellas y acciones posteriores `delete`/`move`.

Validaciones de integración pendientes antes de considerar cerrados todos los
criterios de aceptación operativos:

- Ejecutar pruebas E2E con archivos escritos lentamente por aplicaciones
  externas y reinicios reales del watcher.
- Confirmar `move/delete` después de una conversión FFmpeg real, incluyendo
  archivos bloqueados y movimientos entre volúmenes.
- Medir la consola con varios miles de entradas. La memoria está limitada, pero
  la virtualización visual corresponde a la Fase 7.
- Definir una política de depuración para huellas antiguas y ampliar la
  sanitización si aparecen secretos fuera del directorio personal o de URLs.

### Fase 7 — Interfaz, accesibilidad y manejo de errores

Objetivo: convertir la interfaz alfa en una experiencia coherente.

Tareas:

- Añadir estados de carga y error a todas las llamadas IPC.
- Sustituir `any` por tipos compartidos.
- Mostrar errores Zod/IPC en mensajes comprensibles.
- Añadir confirmaciones para borrar, sobrescribir y eliminar originales.
- Completar ajustes de tema, idioma, FFmpeg y temporales.
- Añadir notificaciones nativas opcionales.
- Mejorar accesibilidad de teclado, foco, labels y contraste.
- Añadir virtualización a listas grandes de jobs y logs.
- Mostrar reporte técnico ampliado y espacio disponible.

Criterios de aceptación:

- Ningún rechazo IPC queda solo en consola de desarrollo.
- Flujo completo operable con teclado.
- Listas de 1000 trabajos/logs mantienen respuesta aceptable.
- Tema e idioma se aplican y persisten.

#### Estado de implementación — completada el 26 de julio de 2026

Se implementaron las mejoras funcionales de la fase:

- Contrato global tipado para `window.ffConverter`, eventos IPC y logs; el
  renderer y el preload ya no contienen conversiones a `any`.
- Carga inicial bloqueante y controlada, estados ocupados en operaciones
  sensibles y mensajes globales accesibles de éxito, información y error.
- Normalización de errores IPC/Zod para evitar mostrar al usuario el envoltorio
  técnico de Electron.
- Manejo visible de rechazos en conversión, cola, historial, presets, watchers,
  logs, ajustes y diagnóstico.
- Confirmaciones antes de limpiar logs, cancelar trabajos, eliminar entradas
  del historial y borrar reglas de vigilancia.
- Ajustes completos para tema oscuro, claro o del sistema; idioma; rutas de
  FFmpeg/FFprobe; concurrencia; hardware; duplicados; watchers; temporales y
  notificaciones del escritorio.
- Aplicación inmediata y persistente del tema y del idioma. La navegación y el
  estado de hardware tienen traducción español/inglés; el documento establece
  el locale seleccionado para formatos dependientes del navegador.
- Notificaciones nativas optativas para trabajos completados o fallidos,
  desactivadas de forma predeterminada.
- Foco visible, roles de estado/alerta, progreso con atributos ARIA, labels y
  controles deshabilitados durante operaciones.
- Renderizado incremental de 200 trabajos y 250 logs para mantener acotado el
  costo inicial con colecciones grandes.
- Reporte técnico ampliado con versiones de Electron/Node, plataforma,
  arquitectura, rutas, capacidades de hardware y espacio disponible en el
  volumen de FFmpeg.

Validación automatizada:

- `npm run verify` finaliza correctamente.
- TypeScript, pruebas unitarias y compilación de producción finalizan sin
  errores.
- Se añadió cobertura para mensajes de validación legibles y la activación
  explícita de notificaciones.

Validaciones manuales recomendadas antes del lanzamiento:

- Recorrer con teclado todas las vistas y verificar el orden de foco con lector
  de pantalla en Windows.
- Medir con React Profiler una base real de 1000 trabajos y 1000 logs. El
  renderizado está acotado, aunque no usa una librería de virtualización.
- Completar la traducción inglesa del contenido de todas las vistas; la
  infraestructura, navegación y persistencia ya están activas.
- Confirmar visualmente contraste y componentes con estilos inline bajo el tema
  claro en el paquete Electron final.

### Fase 8 — Empaquetado, pruebas de aceptación y lanzamiento

Objetivo: producir artefactos instalables confiables.

Tareas:

- Probar `npm run package` desde una instalación limpia.
- Validar dependencias nativas de `better-sqlite3`.
- Probar instalación, actualización y desinstalación.
- Validar NSIS en Windows 11.
- Validar AppImage y DEB en Ubuntu soportado.
- Añadir iconos, metadatos, versión y licencias.
- Evaluar firma de código.
- Crear smoke tests del paquete instalado.
- Ejecutar matriz de conversión con fixtures.
- Documentar requisitos, limitaciones y solución de problemas.

Criterios de aceptación:

- Instaladores arrancan en máquinas limpias.
- Conversión H.264, H.265 y extracción de audio funcionan usando binarios bundled.
- GPU no disponible produce fallback correcto.
- El paquete no depende del árbol del monorepo.
- Existe checklist de lanzamiento firmado y reproducible.

#### Estado de implementación — infraestructura completada el 26 de julio de 2026

Implementado:

- Configuración reproducible de electron-builder para NSIS x64, AppImage y DEB,
  con ASAR, reconstrucción nativa, artefactos versionados, instalación asistida
  y ejecución sin elevación.
- Metadatos, licencia MIT, avisos de terceros como recurso obligatorio e
  identidad visual propia. El icono combina película, reproducción y ciclo de
  conversión con la paleta cian/azul/violeta de FF-Converter.
- Icono integrado como maestro 1024 px, PNG 512 px e ICO multirresolución
  (16–256 px) en ejecutable Windows, Linux, ventana Electron, favicon y
  navegación interna.
- Electron fijado en `43.2.0` y electron-builder en `26.15.3`.
- `npm audit --omit=dev` informa cero vulnerabilidades de producción.
- Preflight estricto que comprueba builds, binarios bundled ejecutables, avisos
  legales y carga de `better-sqlite3`; rechaza paquetes incompletos.
- Smoke test del ejecutable empaquetado mediante `--smoke-test`.
- Matriz real reproducible que genera fixtures y valida H.264, H.265 y
  extracción AAC con FFprobe.
- Documentación de empaquetado, firma, requisitos y solución de problemas en
  `RELEASE.md`.
- Checklist de aprobación con versión, commit, responsables, SHA-256, pruebas
  por plataforma y firmas en `RELEASE_CHECKLIST.md`.

Evidencia obtenida en Windows:

- `npm run verify`: 11 archivos y 48 pruebas aprobadas; typecheck y build
  correctos.
- Matriz con FFmpeg del sistema: H.264, H.265 y AAC aprobados.
- electron-builder resolvió Electron y alcanzó la reconstrucción de
  `better-sqlite3`.
- El preflight estricto rechazó correctamente el release por ausencia de
  `ffmpeg.exe`, `ffprobe.exe` y avisos FFmpeg definitivos.

Bloqueos que impiden declarar el release apto:

- Seleccionar e incorporar builds redistribuibles de FFmpeg para Windows/Linux,
  con versión, configuración, licencia, fuente y SHA-256.
- Instalar Visual Studio 2022 Build Tools con C++/Windows SDK para reconstruir
  `better-sqlite3` para el ABI de Electron 43. El entorno actual no dispone de
  MSVC y no existe un prebuilt compatible.
- Generar el NSIS final con edición de recursos para comprobar el icono sobre
  el ejecutable y accesos directos reales.
- Ejecutar instalación, actualización y desinstalación en Windows 11 limpio.
- Generar y probar AppImage/DEB en Ubuntu x64.
- Configurar firma Authenticode o aprobar explícitamente una distribución sin
  firma.

Por estos bloqueos, la Fase 8 deja lista la infraestructura, pero el producto
permanece **NO APTO PARA DISTRIBUCIÓN** hasta que el preflight estricto apruebe
y se firme el checklist.

#### Correcciones operativas posteriores — 26 de julio de 2026

- Se confirmó mediante el log real que un trabajo persistido tenía una carpeta
  como `inputPath`; FFprobe lo rechazaba correctamente, pero Cola no mostraba
  la acción de eliminación.
- Cola permite eliminar explícitamente trabajos fallidos, cancelados o
  interrumpidos, libera reservas y temporizadores, refresca el store y continúa
  procesando el resto.
- Reintentar uno o todos valida primero que la entrada siga existiendo y sea un
  archivo; las carpetas o entradas desaparecidas no vuelven a bloquear la cola.
- Soltar archivos o carpetas ahora expande y analiza la selección en Convertir,
  informa resultados parciales y requiere revisar el plan antes de crear jobs.
- Solo se encolan snapshots analizados correctamente y las expansiones eliminan
  rutas duplicadas.
- La política `overwrite` nunca puede usar exactamente el input como destino;
  en ese caso se genera un sufijo seguro.
- Diagnóstico separa aceleradores disponibles de opciones no soportadas. Las
  limitaciones del hardware/FFmpeg aparecen compactas y el stderr técnico queda
  oculto en un detalle expandible con scroll.
- La consola de error de cada trabajo también limita la salida técnica mediante
  un bloque expandible para no romper el layout.
- Regresión automatizada añadida para impedir sobrescritura del archivo de
  entrada. La suite finaliza con 49 pruebas aprobadas.
- La concurrencia automática quedó subordinada al límite configurado: puede
  recomendar menos workers según carga/preset, pero nunca superar
  `maxConcurrentJobs`. Ajustes mantiene el máximo editable y explica el límite
  efectivo.
- Se configuró `AppUserModelID`, icono ICO nativo y `setIcon` explícito para que
  Windows use la marca FF-Converter en ventana y barra de tareas tras reiniciar.
- Los diagnósticos recuperables de stderr se registran como advertencias; solo
  un exit code no cero o un trabajo `FAILED` se considera error de conversión.
- Se eliminó la segunda emisión de `job-updated` al finalizar, que duplicaba los
  eventos y logs de `COMPLETED`.

## 7. Estrategia de pruebas

### Unitarias

- `MediaInspector.parseRawProbe`.
- `CompatibilityEngine`.
- `PresetResolver`.
- `CommandBuilder`.
- Parser de progreso y ETA.
- Política de nombres y duplicados.
- Máquina de estados.
- Logger, sanitización y rotación.

### Integración

- FFprobe real con fixtures.
- FFmpeg real para vídeo, audio y stream copy.
- SQLite y migraciones.
- Cola con runners simulados y reales.
- Watcher con archivos escritos por partes.
- IPC con payload válido e inválido.
- Resolución bundled/system/custom.

### End-to-end

- Seleccionar archivo → inspeccionar → convertir → validar → abrir resultado.
- Arrastrar carpeta con múltiples archivos.
- Cancelar y reintentar.
- Reiniciar con un trabajo activo.
- Conversión GPU con fallback a CPU.
- Watcher con `keep`, `move` y `delete`.
- Copiar, filtrar, buscar, limpiar y persistir logs.

### Matriz multimedia mínima

- MP4 H.264/AAC.
- MKV H.265/AC3.
- AV1.
- Vídeo 4K y vídeo vertical.
- HDR10.
- Múltiples audios.
- Subtítulos SRT, ASS y PGS.
- MP3, FLAC, WAV y M4A.
- Nombres Unicode, espacios y rutas largas.
- Archivo corrupto y archivo incompleto.

## 8. Orden recomendado de entregas

1. Fase 0: línea base.
2. Fase 1: seguridad.
3. Fase 2: FFmpeg distribuido.
4. Fase 3: integridad y duplicados.
5. Fase 4: cola y recuperación.
6. Fase 5: compatibilidad y presets.
7. Fase 6: watchers y logs.
8. Fase 7: UX y accesibilidad.
9. Fase 8: empaquetado y lanzamiento.

Las fases 1, 2 y 3 son bloqueantes para cualquier distribución externa. La fase 6 puede desarrollarse en paralelo después de estabilizar los contratos de logging y estados, pero debe cerrarse antes de declarar el MVP completo.

## 9. Definición de “MVP terminado”

El MVP se considerará terminado cuando:

- La seguridad de Electron e IPC cumpla el plan.
- FFmpeg y FFprobe bundled funcionen en Windows y Ubuntu.
- Una conversión completa esté cubierta por pruebas end-to-end.
- Las políticas de duplicados no puedan causar pérdida silenciosa.
- Cola, cancelación, reintento y recuperación estén probados.
- Watchers sean idempotentes y sus acciones posteriores funcionen.
- La Consola Logs capture realmente todos los subsistemas declarados.
- Los logs críticos persistan y puedan exportarse.
- Los instaladores hayan sido probados en máquinas limpias.
- No existan fallos críticos o altos abiertos.

## 10. Seguimiento sugerido

Para cada fase se recomienda crear issues o tareas con:

- Identificador de fase y prioridad.
- Archivos afectados.
- Riesgo y dependencias.
- Criterios de aceptación copiados de este documento.
- Pruebas requeridas.
- Evidencia final: test, captura, log o artefacto empaquetado.

Este documento debe actualizarse al cerrar cada fase, sustituyendo estimaciones por evidencia verificable.

## 11. Registro de ejecución

### 2026-07-26 — Inicio de Fase 0

Estado: completada la línea base local inicial.

Implementado:

- Script raíz `typecheck` para todos los workspaces.
- Script `test:unit`.
- Script agregado `verify`: typecheck + pruebas + build.
- Scripts de typecheck específicos por workspace.
- Versión mínima de Node.js declarada.
- `.gitignore` para dependencias, builds, runtime y artefactos generados.
- `DEVELOPMENT.md` con entorno, comandos y criterios de línea base.
- Eliminación de copias JavaScript generadas dentro de `apps/desktop/src`.
- Regla preventiva para que estos JavaScript no vuelvan a incorporarse.
- Corrección del error TypeScript `whitespace` → `whiteSpace` detectado en `LogsView.tsx`.

Evidencia:

- `npm run verify`: aprobado.
- Typecheck de todos los workspaces: aprobado.
- 4 archivos de pruebas, 5 pruebas unitarias: aprobadas.
- Build TypeScript y Vite: aprobado.

Pendiente de Fase 0 para infraestructura remota:

- Incorporar lint cuando se añada su dependencia y configuración.
- Configurar CI Windows/Ubuntu.
- Añadir fixtures multimedia redistribuibles.
- Medir cobertura y fijar umbral inicial.

Estos puntos requieren una decisión sobre proveedor de CI y política de dependencias, pero no bloquean el inicio local de la Fase 1.

### 2026-07-26 — Fase 1: seguridad de Electron e IPC

Estado: núcleo de la fase implementado y validado estáticamente.

Implementado:

- `sandbox: true` y `webSecurity: true` en `BrowserWindow`.
- Bloqueo de ventanas emergentes y navegación fuera del origen de desarrollo.
- CSP endurecida:
  - eliminado `'unsafe-eval'`;
  - scripts limitados a `'self'`;
  - objetos, formularios y base URI bloqueados;
  - fuentes web externas eliminadas.
- Wrapper único para registrar handlers IPC con validación de frame y origen.
- Rechazo de subframes y orígenes distintos de la página empaquetada o loopback de desarrollo.
- Schemas Zod para IDs, rutas, listas de rutas y límites de prioridad.
- Límite de 1000 rutas por payload y profundidad máxima de escaneo.
- Validación de existencia de jobs, presets y watchers antes de mutarlos.
- Registro de rutas autorizadas:
  - archivos elegidos por diálogo;
  - carpetas elegidas;
  - archivos y carpetas arrastrados mediante `webUtils`;
  - rutas persistidas de jobs y watchers;
  - salidas generadas por la aplicación.
- Separación entre autorización de lectura y autorización de carpeta de salida.
- Restricción de `openPath` y `showItemInFolder` a rutas registradas.
- Drag-and-drop actualizado para autorizar la ruta desde preload antes de enviarla al renderer.
- Restricciones iniciales a argumentos FFmpeg personalizados peligrosos.
- Protección ante rutas persistidas inválidas sin impedir el arranque.
- Pruebas para:
  - IDs malformados;
  - payloads vacíos o excesivos;
  - bytes nulos;
  - prioridad fuera de rango;
  - argumentos FFmpeg inseguros;
  - rutas exactas, descendientes, relativas y de solo salida;
  - nombres Unicode;
  - orígenes IPC permitidos y rechazados.

Evidencia:

- `npm run verify`: aprobado.
- 5 archivos de pruebas, 12 pruebas: aprobadas.
- Typecheck y build de producción: aprobados.
- Búsqueda estática sin `sandbox: false`, `webSecurity: false` ni `'unsafe-eval'`.
- Todos los handlers IPC pasan por el wrapper seguro.

Validación pendiente antes de distribución:

- Smoke test interactivo de diálogos y drag-and-drop bajo sandbox.
- Prueba del ejecutable empaquetado con CSP de producción.
- Casos específicos de rutas UNC y symlinks por plataforma.
- Revisión de allowlist más granular para argumentos FFmpeg avanzados.

Estas validaciones se integrarán con las fases de pruebas end-to-end y empaquetado.

### 2026-07-26 — Fase 2: resolución y distribución de FFmpeg

Estado: resolución y empaquetado estructural implementados; incorporación de binarios redistribuibles pendiente.

Implementado:

- Servicio `FFmpegLocator` independiente y probado.
- Modo `bundled` con rutas por plataforma y arquitectura.
- Modo `system` mediante búsqueda explícita en `PATH`.
- Modo `custom` que exige FFmpeg y FFprobe existentes.
- Rutas diferenciadas para desarrollo y aplicación empaquetada.
- Fallback visible de bundled a system durante desarrollo cuando faltan recursos.
- Registro del modo solicitado, modo efectivo y causa de fallback en capacidades.
- Recálculo de capacidades al guardar ajustes.
- Evento IPC en vivo `events:capabilities-updated`.
- Acción IPC manual `system:refreshCapabilities`.
- Diagnóstico ampliado con rutas y modos efectivos.
- Controles de Ajustes para bundled, system y custom.
- `electron-builder` configurado para copiar `resources/ffmpeg`.
- Estructura preparada para Windows x64 y Linux x64.
- Documentación de layout, checksums y obligaciones de licencia.
- Pruebas unitarias de bundled, system, custom, fallback y ausencia total.

Evidencia:

- `npm run verify`: aprobado.
- 6 archivos de pruebas, 17 pruebas: aprobadas.
- Typecheck y build de producción: aprobados.
- El entorno de auditoría resuelve FFmpeg/FFprobe 8.1.2 desde PATH.

Bloqueo explícito para declarar distribución bundled terminada:

- Seleccionar builds redistribuibles exactas para Windows y Linux.
- Incorporar los cuatro binarios reales.
- Registrar versión, configuración, URL de origen y SHA-256.
- Sustituir el placeholder de avisos por las licencias correspondientes.
- Probar NSIS, AppImage y DEB en máquinas sin FFmpeg instalado.

No se copiaron automáticamente los binarios presentes en el equipo de desarrollo porque hacerlo sin fijar procedencia, configuración y licencia produciría un artefacto de distribución no auditable.

### 2026-07-26 — Fase 3: integridad, duplicados y validación

Estado: núcleo de integridad implementado y cubierto por pruebas.

Implementado:

- `OutputPathResolver` como punto único para nombres de salida.
- Políticas diferenciadas:
  - `suffix`: busca el siguiente sufijo libre;
  - `skip`: crea un trabajo `SKIPPED` sin inspeccionar ni ejecutar FFmpeg;
  - `overwrite`: solo reemplaza cuando la colisión existía y la política fue explícita.
- Reservas en memoria para evitar que trabajos simultáneos elijan la misma salida.
- Protección adicional para impedir dos arranques simultáneos del mismo trabajo.
- Temporales únicos con job ID.
- Política de watcher conectada al resolver de duplicados.
- Persistencia de la decisión `overwriteExisting` en SQLite y fallback JSON.
- Migración incremental de SQLite para bases existentes.
- `DiskSpaceInspector` con:
  - estimación de tamaño de conversión;
  - reserva de seguridad;
  - cálculo mediante `statfs`;
  - estado `WAITING_FOR_SPACE`;
  - reintento periódico.
- Cola y Sidebar actualizados para mostrar `WAITING_FOR_SPACE`.
- `OutputValidator` ampliado:
  - archivo existente y tamaño mayor que cero;
  - inspección FFprobe;
  - tolerancia de duración del 3 % o 2 segundos;
  - presencia de streams esperados;
  - límites de resolución;
  - codec esperado para transcodificación de vídeo y audio;
  - detección de un destino que aparece durante la conversión.
- Reemplazo recuperable:
  - el destino anterior se mueve a un backup;
  - el temporal validado pasa a ser destino;
  - ante fallo se intenta restaurar el anterior;
  - el destino nunca se elimina antes de validar.
- Temporales ubicados en la carpeta final, evitando movimientos normales entre volúmenes.

Evidencia:

- `npm run verify`: aprobado.
- 7 archivos de pruebas, 26 pruebas: aprobadas.
- Pruebas específicas de skip, overwrite, suffix, reservas y temporales únicos.
- Pruebas de destino aparecido durante la conversión.
- Pruebas de preservación del destino ante validación fallida.
- Pruebas de reemplazo validado y eliminación del backup.
- Pruebas de duración, streams, codec, resolución y capacidad insuficiente.
- Typecheck y build de producción: aprobados.

Pendiente relacionado para fases posteriores:

- Registrar formalmente cada transición de estado en una tabla de auditoría.
- Añadir control de cancelación manual para trabajos `WAITING_FOR_SPACE`.
- Probar disco lleno y fallos de rename con un filesystem controlado de integración.
- Ampliar validación de contenedor y múltiples streams durante la Fase 5.

### 2026-07-26 — Fase 4: cola, estados y recuperación

Estado: núcleo de ciclo de vida y control de cola implementado.

Implementado:

- `JobStateMachine` con transiciones válidas explícitas.
- Nuevo estado terminal `CANCELLED`, separado de `CANCELLING`.
- Método único del orquestador para cambiar estado, persistir y emitir eventos.
- Tabla SQLite `job_transitions` con:
  - estado anterior;
  - estado nuevo;
  - motivo;
  - fecha;
  - índice por job.
- Historial equivalente en el fallback JSON.
- API IPC para consultar transiciones de un trabajo.
- Recuperación al iniciar:
  - `RUNNING`;
  - `ANALYZING`;
  - `VALIDATING_OUTPUT`;
  - `PAUSED`;
  - `CANCELLING`;
  pasan a `INTERRUPTED` con motivo persistido.
- Los trabajos que ya estaban `QUEUED` vuelven a procesarse al iniciar.
- Los trabajos `WAITING_FOR_SPACE` restauran su temporizador de comprobación.
- Prevención de doble arranque mediante `startingJobs` y `activeRunners`.
- Cancelación completada para:
  - queued;
  - análisis en curso;
  - espera de espacio;
  - interrumpidos;
  - procesos FFmpeg activos.
- Terminación del árbol de procesos con `taskkill /t /f` en Windows.
- Suspensión/reanudación individual con `SIGSTOP`/`SIGCONT` en plataformas POSIX.
- Controles de pausa individual ocultos en Windows, donde no existe soporte nativo fiable.
- Reintento individual de `FAILED`, `INTERRUPTED` y `CANCELLED`.
- Reintento masivo desde la interfaz.
- Prioridad editable desde la cola con límites validados.
- Persistencia de prioridad corregida en el UPSERT SQLite.
- Política automática de workers:
  - hasta 4 para audio/remux;
  - hasta 3 con encoder de hardware;
  - entre 1 y 2 para CPU intensiva.
- ETA suavizada mediante media móvil de las últimas diez muestras de velocidad.
- Cola e historial actualizados para mostrar pausados y cancelados.

Evidencia:

- `npm run verify`: aprobado.
- 8 archivos de pruebas, 31 pruebas: aprobadas.
- Pruebas del ciclo normal, recuperación, reintento, espera de espacio y terminales inválidos.
- Pruebas de prioridad y ETA suavizada.
- Búsqueda estática: los cambios de estado del orquestador pasan por la máquina central.
- Typecheck y build de producción: aprobados.

Pendiente de validación de integración:

- Cerrar la aplicación durante una conversión real y verificar recuperación con SQLite.
- Probar pausa/reanudación con FFmpeg real en Ubuntu.
- Probar terminación de procesos hijos con FFmpeg real en Windows.
- Añadir una vista detallada del historial de transiciones en la interfaz.

### 2026-07-26 — Fase 5: compatibilidad, presets y streams

Estado: motor avanzado y vista previa implementados; validación física en dispositivos pendiente.

Implementado:

- Modelo de preset ampliado con:
  - familia de dispositivo;
  - perfil y nivel de vídeo;
  - pixel format y profundidad máxima;
  - política HDR;
  - política de subtítulos;
  - idioma o índice de audio;
  - número de canales;
  - normalización de volumen.
- Plan efectivo ampliado con:
  - índices absolutos de streams;
  - acción HDR;
  - encoder de subtítulos;
  - razonamiento legible.
- Inspector FFprobe clasifica subtítulos de texto y bitmap.
- Motor de compatibilidad por contenedor para MP4, MOV, MKV, WebM y formatos de audio.
- Normalización de aliases de codecs como H.265/HEVC y SubRip/SRT.
- Evaluación independiente de vídeo, audio y subtítulos.
- Selección de audio:
  - índice explícito;
  - idioma preferido;
  - pista predeterminada;
  - primera pista como fallback.
- Selección de subtítulo forced/default antes del primero disponible.
- Stream copy únicamente cuando codec, contenedor, resolución, framerate, profundidad, pixel format y HDR lo permiten.
- Fallback seguro cuando un preset `copy` encuentra incompatibilidad:
  - VP9/Opus para WebM;
  - codecs seguros por formato de audio;
  - H.264/AAC para contenedores generales.
- Políticas de subtítulos:
  - preservar compatibles;
  - convertir texto a `mov_text`, `webvtt` o `srt`;
  - eliminar;
  - burn-in para subtítulos de texto.
- Subtítulos bitmap incompatibles se eliminan de forma segura en lugar de producir comandos inválidos.
- Tone mapping HDR → SDR mediante zscale + tonemap + BT.709.
- Mapping explícito de streams con `-map`.
- Soporte de perfil/nivel, normalización `loudnorm` y filtros combinados.
- Encoders AV1 de hardware seleccionables cuando las capacidades los validan.
- Nuevos presets:
  - Samsung TV 4K;
  - LG TV HEVC 4K;
  - Android TV / Google TV;
  - ALAC/M4A;
  - WAV PCM.
- Presets del sistema se actualizan por UPSERT al iniciar sin eliminar presets personalizados.
- Editor de presets ampliado con HDR, subtítulos, idioma y normalización.
- Nuevo IPC `media:resolvePlans` con cache de inspección.
- Vista previa antes de encolar con acciones, encoders, HDR y razonamiento.

Evidencia:

- `npm run verify`: aprobado.
- 9 archivos de pruebas, 40 pruebas: aprobadas.
- Matriz de pruebas para:
  - decisiones independientes de streams;
  - selección por idioma e índice;
  - subtítulos MP4/MKV;
  - rechazo seguro de bitmap;
  - HDR → SDR;
  - mapping;
  - burn-in de texto;
  - extracción de audio y normalización;
  - fallback WebM VP9/Opus.
- Typecheck y build de producción: aprobados.

Pendiente antes de certificar compatibilidad:

- Fixtures reales con múltiples audios y subtítulos.
- Pruebas reales de tone mapping HDR.
- Validación en televisores Samsung, LG y Android TV representativos.
- Burn-in de subtítulos bitmap mediante una ruta de filtros dedicada.
- Portada embebida y nomenclatura musical avanzada.
- Selección interactiva de stream por archivo desde la UI.

### 2026-07-26 — Distribución autónoma de FFmpeg

Estado: integración bundled para Windows x64 y Linux x64 implementada; paquete
Windows apto para continuar con el empaquetado.

Decisión:

- Mantener el código propio de FF-Converter bajo MIT.
- Redistribuir `ffmpeg` y `ffprobe` como ejecutables separados bajo GPLv3.
- Usar builds GPL porque los presets existentes requieren `libx264` y
  `libx265`.
- Mantener tres modos de resolución:
  - `bundled` como predeterminado y recomendado;
  - fallback automático a `PATH` si el bundled no existe;
  - rutas personalizadas para instalaciones administradas.

Implementado:

- Windows x64:
  - FFmpeg 8.1.2 Essentials de Gyan.dev;
  - `libx264`, `libx265`, NVENC, QSV y AMF presentes;
  - paquete y binarios validados por SHA-256.
- Linux x64:
  - FFmpeg n8.1 GPL estático de BtbN;
  - paquete y binarios validados por SHA-256.
- `electron-builder` incluye todo `resources/ffmpeg` en la aplicación.
- Manifiesto reproducible con:
  - versión;
  - proveedor;
  - URL de descarga;
  - commit fuente;
  - scripts del proveedor;
  - hashes de paquete y ejecutables.
- Avisos de terceros y texto GPLv3 incluidos junto a los binarios.
- Preflight reforzado:
  - exige manifiesto, licencia y avisos;
  - calcula y compara SHA-256 de los binarios de la plataforma;
  - ejecuta `ffmpeg -version` y `ffprobe -version`;
  - mantiene las validaciones del build y `better-sqlite3`.
- Ajustes explican el comportamiento de cada origen de FFmpeg.

Hallazgo durante la selección:

- El build de Windows de BtbN fue bloqueado por Windows Application Control en
  el equipo de prueba, aunque `ffprobe` sí iniciaba.
- Se sustituyó únicamente Windows por Gyan.dev, proveedor enlazado desde la
  página oficial de descargas de FFmpeg. El nuevo `ffmpeg.exe` ejecutó sin
  bloqueo.

Evidencia:

- Matriz bundled real:
  - transcodificación H.264 + AAC;
  - transcodificación H.265 + AAC;
  - extracción AAC;
  - inspección final con FFprobe.
- `npm run test:acceptance -- resources/ffmpeg/win32-x64`: aprobado.
- `npm run verify`: aprobado, 11 archivos y 50 pruebas.
- `npm run release:preflight`: APTO para continuar con empaquetado.
- El intento de `package:dir` confirmó que `electron-builder` recoge la
  configuración, pero se detuvo antes de crear el paquete al recompilar
  `better-sqlite3`: el host no tiene Visual Studio Build Tools. Este bloqueo no
  pertenece a FFmpeg y no se desactivó `npmRebuild`, porque hacerlo degradaría
  silenciosamente la aplicación al almacenamiento JSON.

Pendiente de certificación multiplataforma:

- Ejecutar la matriz de aceptación y el preflight en un host Linux x64.
- Construir y probar físicamente AppImage y DEB en Linux, comprobando permisos
  `0755`.
- Repetir smoke test sobre el instalador NSIS final firmado.
- Instalar Visual Studio Build Tools con la carga de C++ para generar el módulo
  nativo `better-sqlite3` compatible con Electron 43, o fijar una combinación
  Electron/SQLite con prebuild comprobado; después repetir `package:dir`.
- En cada actualización de FFmpeg, renovar binarios, manifiesto, hashes, commit
  fuente y avisos como una sola unidad.
