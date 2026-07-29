# FF-Converter — Plan de Arquitectura e Implementación

## 1. Visión del producto

FF-Converter será una aplicación de escritorio multiplataforma para Windows 11 y Ubuntu Linux orientada a la conversión, optimización y extracción de contenido multimedia mediante FFmpeg.

La aplicación deberá permitir:

- Convertir múltiples archivos de video por lotes.
- Utilizar perfiles optimizados para televisores, dispositivos y plataformas.
- Extraer audio en formatos compatibles con reproductores y bibliotecas musicales.
- Detectar y utilizar aceleración por hardware cuando esté disponible.
- Vigilar carpetas y procesar automáticamente los archivos nuevos.
- Controlar la cantidad de conversiones simultáneas.
- Pausar, cancelar, reintentar y recuperar trabajos.
- Mantener historial y configuración entre reinicios.
- Mostrar información clara sobre progreso, velocidad, tiempo restante y errores.

El objetivo principal no será exponer directamente toda la complejidad de FFmpeg, sino ofrecer perfiles seguros y comprensibles, conservando un modo avanzado para usuarios técnicos.

---

## 2. Alcance funcional

### 2.1 Conversión manual

El usuario podrá:

- Seleccionar uno o varios archivos.
- Arrastrar archivos o carpetas a la aplicación.
- Analizar los medios antes de convertirlos.
- Elegir un perfil de salida.
- Elegir la carpeta de destino.
- Iniciar todos los trabajos o elementos individuales.
- Reordenar la cola.
- Pausar la cola.
- Cancelar una conversión.
- Reintentar trabajos fallidos.
- Abrir el archivo o la carpeta resultante.

### 2.2 Conversión automática

El usuario podrá crear reglas de vigilancia con:

- Carpeta de entrada.
- Perfil de conversión.
- Carpeta de salida.
- Inclusión opcional de subcarpetas.
- Extensiones permitidas.
- Tiempo de estabilización del archivo.
- Acción después de convertir.
- Política para archivos duplicados.
- Eliminación opcional del archivo original.
- Inicio automático con la aplicación.

La aplicación solo procesará un archivo cuando su tamaño y fecha de modificación permanezcan estables durante un período configurable.

### 2.3 Perfiles de dispositivos

Los perfiles podrán representar:

- Smart TV genérica.
- Samsung TV.
- LG TV.
- Android TV / Google TV.
- Reproducción web.
- Archivo de alta calidad.
- Compresión eficiente.
- YouTube y redes sociales.
- Extracción de audio.
- Apple Music, mediante exportación compatible.
- Perfil personalizado.

Cada perfil definirá:

- Contenedor.
- Codec de video.
- Codec de audio.
- Resolución máxima.
- Framerate máximo.
- Pixel format.
- Compatibilidad HDR/SDR.
- Calidad objetivo.
- Política de subtítulos.
- Política de metadatos.
- Reglas de copia directa de streams.
- Codificadores permitidos según el hardware.

---

## 3. Stack tecnológico

### Aplicación de escritorio

- Electron.
- Vite.
- TypeScript.
- React para la interfaz.
- CSS Modules, Tailwind CSS o una capa de estilos propia.
- Zustand para estado visual y temporal de la interfaz.

### Proceso principal

- Node.js incluido con Electron.
- `child_process.spawn` para FFmpeg y FFprobe.
- SQLite para persistencia.
- Zod para validar configuraciones, perfiles e IPC.
- Chokidar para vigilancia de carpetas.
- Pino para logs estructurados.

### Empaquetado

- electron-builder.
- Instalador NSIS para Windows.
- AppImage y paquete `.deb` para Ubuntu.
- FFmpeg y FFprobe incluidos como recursos independientes por plataforma.

No se utilizará el FFmpeg interno de Electron para las conversiones. La aplicación distribuirá binarios independientes y controlados.

---

## 4. Arquitectura general

```text
┌─────────────────────────────────────────────────────────────┐
│                       Renderer Process                       │
│                                                             │
│  Dashboard · Dropzone · Cola · Presets · Historial          │
│  Carpetas vigiladas · Ajustes · Diagnóstico                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    API segura mediante preload
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                         Main Process                        │
│                                                             │
│  IPC Controllers                                            │
│  Application Services                                       │
│  Queue Orchestrator                                         │
│  Watch Folder Service                                       │
│  Notification Service                                       │
│  Settings Service                                           │
│  Database Repositories                                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       Media Core                            │
│                                                             │
│  Media Inspector      → FFprobe                             │
│  Compatibility Engine → Decide copy/transcode               │
│  Preset Resolver      → Produce conversión efectiva         │
│  Command Builder      → Args seguros para FFmpeg            │
│  Process Runner       → Ejecutar, cancelar y monitorear     │
│  Progress Parser      → Progreso estructurado               │
│  Hardware Inspector   → NVENC/QSV/AMF/VAAPI/CPU             │
│  Output Validator     → Verificar resultado                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Procesos y responsabilidades

### 5.1 Renderer Process

El renderer será responsable exclusivamente de:

- Presentar la interfaz.
- Mostrar estados recibidos desde el proceso principal.
- Recoger las decisiones del usuario.
- Enviar comandos mediante una API limitada.
- Mantener estado temporal de navegación y componentes.

No tendrá:

- Acceso directo a Node.js.
- Acceso directo al sistema de archivos.
- Acceso directo a `child_process`.
- Capacidad para construir comandos de shell.
- Acceso directo a SQLite.

### 5.2 Preload

El preload expondrá una API explícita:

```ts
window.ffConverter = {
  media: {
    selectFiles(),
    selectFolder(),
    inspect(paths)
  },
  jobs: {
    create(input),
    start(id),
    pauseQueue(),
    resumeQueue(),
    cancel(id),
    retry(id),
    remove(id)
  },
  presets: {
    list(),
    create(input),
    update(id, input),
    remove(id)
  },
  watchers: {
    list(),
    create(input),
    update(id, input),
    enable(id),
    disable(id)
  },
  system: {
    getCapabilities(),
    openPath(path),
    showItemInFolder(path)
  },
  events: {
    onJobUpdated(callback),
    onQueueUpdated(callback),
    onSystemEvent(callback)
  }
}
```

Todos los datos deberán validarse en el proceso principal antes de ser utilizados.

### 5.3 Queue Orchestrator

El orquestador deberá:

- Mantener la cola.
- Respetar el límite de concurrencia.
- Evitar dos ejecuciones del mismo trabajo.
- Asignar recursos según el tipo de codificador.
- Recuperar trabajos interrumpidos.
- Aplicar prioridad.
- Esperar espacio disponible en disco.
- Detener nuevos trabajos al pausar la cola.
- Finalizar correctamente procesos cancelados.

El límite de workers será configurable, pero también deberá existir un modo automático.

Ejemplo de política automática:

- CPU: entre 1 y 2 procesos intensivos.
- NVIDIA NVENC: entre 1 y 3 procesos inicialmente.
- Extracción o remux sin recodificación: mayor concurrencia.
- Disco lento o espacio insuficiente: reducir o detener la cola.

No se asumirá que ocho procesos simultáneos son siempre seguros.

---

## 6. Ciclo de vida de un trabajo

Cada trabajo tendrá los siguientes estados:

```text
DISCOVERED
    ↓
PENDING_ANALYSIS
    ↓
ANALYZING
    ↓
READY
    ↓
QUEUED
    ↓
RUNNING
    ├── PAUSED
    ├── CANCELLING
    ├── FAILED
    └── COMPLETED
```

Estados adicionales:

- `INTERRUPTED`: la aplicación se cerró durante la ejecución.
- `SKIPPED`: el archivo ya era compatible o una regla indicó omitirlo.
- `VALIDATING_OUTPUT`: FFmpeg terminó y se está verificando el resultado.
- `WAITING_FOR_FILE`: archivo vigilado todavía en escritura.
- `WAITING_FOR_SPACE`: espacio insuficiente.
- `NEEDS_ATTENTION`: requiere una decisión del usuario.

Cada transición deberá registrarse en la base de datos.

---

## 7. Inspección multimedia

Antes de construir el comando, FFprobe deberá obtener:

### Contenedor

- Formato.
- Duración.
- Bitrate.
- Tamaño.
- Metadatos.

### Video

- Codec.
- Perfil y nivel.
- Resolución.
- Framerate.
- Pixel format.
- Bit depth.
- HDR o SDR.
- Color primaries.
- Transfer characteristics.
- Rotación.
- Relación de aspecto.

### Audio

- Codec.
- Canales.
- Channel layout.
- Sample rate.
- Bitrate.
- Idioma.
- Disposición predeterminada.

### Subtítulos

- Codec.
- Idioma.
- Tipo de subtítulo.
- Compatibilidad con el contenedor de destino.
- Indicador forced/default.

El resultado del análisis se almacenará como un snapshot JSON asociado al trabajo.

---

## 8. Motor de compatibilidad

El motor determinará independientemente para cada stream si debe:

- Copiarse sin recodificación.
- Recodificarse.
- Eliminarse.
- Convertirse a otro formato.
- Incrustarse permanentemente en el video.
- Preservarse como stream seleccionable.

Ejemplo:

```text
Video H.264 compatible        → copy
Audio DTS no compatible       → AAC o AC3
Subtítulos PGS en MP4         → convertir, eliminar o burn-in
Resolución superior al perfil → escalar
AV1 no soportado por la TV    → H.264 o H.265
```

Esto evitará recodificaciones innecesarias y pérdida de calidad.

---

## 9. Resolución de presets

Un preset no será solamente una lista fija de argumentos.

El motor combinará:

```text
Preset base
+ información del archivo
+ capacidades del equipo
+ preferencias del usuario
+ restricciones del dispositivo
= plan efectivo de conversión
```

Ejemplo de plan efectivo:

```json
{
  "container": "mp4",
  "video": {
    "action": "transcode",
    "encoder": "h264_nvenc",
    "qualityMode": "cq",
    "quality": 21,
    "maxWidth": 1920,
    "maxHeight": 1080,
    "pixelFormat": "yuv420p"
  },
  "audio": {
    "action": "transcode",
    "encoder": "aac",
    "bitrate": "192k",
    "channels": 2
  },
  "subtitles": {
    "action": "preserve-compatible"
  }
}
```

Los argumentos de FFmpeg se generarán desde este plan intermedio, no directamente desde la interfaz.

---

## 10. Presets iniciales

### 10.1 Smart TV — máxima compatibilidad

- MP4.
- H.264 High.
- Pixel format `yuv420p`.
- AAC estéreo o AC3 configurable.
- Resolución máxima seleccionable.
- Framerate preservado o limitado a 60 fps.
- Faststart.
- Conversión de codecs no compatibles.
- Opción de mantener subtítulos compatibles.

### 10.2 Smart TV — calidad eficiente

- MKV o MP4.
- H.265 Main/Main10 según el dispositivo.
- AAC o AC3.
- Preservación de HDR solo cuando el perfil lo soporte.
- Conversión a SDR como opción separada.

### 10.3 YouTube / redes sociales

- MP4.
- H.264.
- AAC.
- Faststart.
- 1080p o 4K.
- Framerate conservado.
- Normalización opcional de audio.

### 10.4 Archivo de alta calidad

- MKV.
- H.265 o AV1.
- Calidad constante.
- Audio copy, FLAC o PCM.
- Conservación de metadatos y subtítulos.
- Sin reducción automática de resolución.

### 10.5 Compresión rápida

- MP4.
- H.265 por hardware cuando esté disponible.
- Calidad equilibrada.
- Audio AAC.
- Escalado opcional.

### 10.6 Extracción de audio

Opciones:

- MP3 320 kbps.
- AAC/M4A.
- ALAC/M4A.
- FLAC.
- WAV.

Deberá permitir:

- Mantener título, artista, álbum y número de pista.
- Seleccionar stream de audio.
- Aplicar portada cuando exista.
- Normalizar volumen opcionalmente.
- Elegir nomenclatura de archivos.

### 10.7 Exportación para Apple Music

Este perfil generará:

- AAC en contenedor M4A.
- ALAC en contenedor M4A.
- Metadatos compatibles.
- Portada embebida cuando sea posible.
- Nombres de archivo limpios.

Al finalizar podrá:

- Abrir la carpeta de exportación.
- Abrir el archivo con la aplicación asociada.
- Mostrar instrucciones de importación.
- Ejecutar una integración local específica del sistema cuando exista una opción estable y soportada.

No se prometerá carga automática a la biblioteca en la nube como parte del MVP.

---

## 11. Hardware acceleration

El inspector de hardware deberá verificar capacidades reales ejecutando pruebas contra el FFmpeg distribuido.

### NVIDIA

- `h264_nvenc`.
- `hevc_nvenc`.
- `av1_nvenc` únicamente cuando el hardware lo soporte.
- Decodificación CUDA opcional.

### Intel

- Quick Sync Video.
- H.264, H.265 y AV1 según hardware y controladores.

### AMD

- AMF en Windows.
- VAAPI en Linux cuando corresponda.

### CPU

- libx264.
- libx265.
- libaom-av1 o SVT-AV1, si se incluyen.
- Encoders de audio por software.

La detección deberá diferenciar:

- Encoder presente en FFmpeg.
- Hardware presente.
- Controlador funcional.
- Prueba corta de codificación satisfactoria.

Si una prueba falla, se utilizará fallback por CPU sin perder el trabajo.

---

## 12. Progreso y telemetría local

FFmpeg se ejecutará sin shell y recibirá argumentos como array.

El progreso deberá incluir:

- Tiempo procesado.
- Duración total.
- Porcentaje.
- Frames procesados.
- FPS.
- Velocidad relativa.
- Bitrate.
- Tamaño de salida.
- Tiempo estimado restante.
- Estado actual.

El cálculo de ETA utilizará una media móvil para evitar cambios bruscos.

Los logs se dividirán en:

- Progreso estructurado.
- Mensajes informativos.
- Advertencias.
- Error final.
- Comando reproducible con datos sensibles eliminados.

No se enviarán datos fuera del equipo en el MVP.

---

## 13. Archivos de salida

Para evitar resultados corruptos:

1. FFmpeg escribirá en un archivo temporal.
2. Se comprobará el código de salida.
3. FFprobe analizará el resultado.
4. Se validará que exista una duración razonable.
5. Se verificará que los streams esperados estén presentes.
6. El archivo temporal se renombrará atómicamente al nombre final.

Ejemplo:

```text
pelicula.mp4
pelicula.ffconverter.partial.mp4
```

Los archivos parciales podrán:

- Eliminarse automáticamente.
- Mantenerse para diagnóstico.
- Reutilizarse únicamente si existe una estrategia de reanudación válida.

---

## 14. Política de nombres y duplicados

Opciones:

- Sobrescribir.
- Omitir.
- Agregar sufijo incremental.
- Añadir nombre del preset.
- Añadir resolución o codec.
- Preguntar cada vez.

Ejemplos:

```text
video.mp4
video-TV-1080p.mp4
video-TV-1080p-2.mp4
```

La aplicación nunca sobrescribirá silenciosamente un archivo por defecto.

---

## 15. Persistencia

SQLite almacenará:

### Jobs

- Identificador.
- Archivo de entrada.
- Archivo de salida.
- Preset.
- Estado.
- Progreso.
- Fechas.
- Error.
- Snapshot de inspección.
- Plan efectivo.
- Estadísticas finales.

### Presets

- Presets del sistema.
- Presets personalizados.
- Versión del esquema.
- Fecha de modificación.

### Watch folders

- Directorio.
- Perfil.
- Directorio de salida.
- Filtros.
- Acciones posteriores.
- Estado activo.

### Settings

- Workers.
- Hardware preferido.
- Tema.
- Idioma.
- Rutas de FFmpeg.
- Política de archivos.
- Inicio automático.

Al iniciar la aplicación:

- `RUNNING` pasará a `INTERRUPTED`.
- Los trabajos interrumpidos podrán reintentarse.
- Las reglas de vigilancia activas se restaurarán.
- Se verificará la disponibilidad de las rutas configuradas.

---

## 16. Diseño de interfaz

### Navegación principal

- Convertir.
- Cola.
- Carpetas vigiladas.
- Historial.
- Presets.
- Diagnóstico.
- Ajustes.

### Pantalla Convertir

- Dropzone.
- Archivos seleccionados.
- Resultado del análisis.
- Perfil.
- Carpeta de destino.
- Resumen de acciones.
- Botón para añadir a la cola.

### Pantalla Cola

Cada trabajo mostrará:

- Nombre.
- Resolución y codec.
- Perfil.
- Estado.
- Progreso.
- Velocidad.
- ETA.
- Tamaño.
- Hardware utilizado.
- Acciones disponibles.

### Diagnóstico

Mostrará:

- Versión de FFmpeg.
- Ruta efectiva.
- Encoders detectados.
- GPU detectada.
- Resultado de pruebas de hardware.
- Espacio disponible.
- Carpeta de logs.
- Botón para copiar reporte técnico.

---

## 17. Seguridad

La aplicación deberá utilizar:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Renderer sandboxed.
- Content Security Policy.
- Canales IPC explícitos.
- Validación Zod en cada handler.
- Ejecución de FFmpeg sin `shell: true`.
- Argumentos como array.
- Normalización y validación de rutas.
- Restricción de operaciones a archivos seleccionados o registrados.
- Sin evaluación dinámica de código.
- Sin descarga automática de binarios no verificados.

Las rutas y nombres de archivo se tratarán como datos, nunca como fragmentos de comandos.

---

## 18. Distribución de FFmpeg

La aplicación utilizará un modelo híbrido:

### Modo predeterminado

FFmpeg y FFprobe estarán incluidos con la aplicación:

```text
resources/
└── ffmpeg/
    ├── win32-x64/
    │   ├── ffmpeg.exe
    │   └── ffprobe.exe
    └── linux-x64/
        ├── ffmpeg
        └── ffprobe
```

### Modo avanzado

El usuario podrá seleccionar:

- FFmpeg integrado.
- FFmpeg instalado en el sistema.
- Ruta personalizada.

La aplicación validará:

- Existencia.
- Permisos.
- Versión.
- Encoders.
- Capacidad para ejecutar una prueba.

También deberá incluir las licencias y avisos correspondientes a FFmpeg y a la compilación distribuida.

---

## 19. Estructura propuesta del proyecto

```text
ff-converter/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── ipc/
│       │   │   ├── services/
│       │   │   ├── repositories/
│       │   │   ├── database/
│       │   │   └── bootstrap/
│       │   ├── preload/
│       │   └── renderer/
│       │       ├── components/
│       │       ├── features/
│       │       ├── pages/
│       │       ├── stores/
│       │       └── styles/
│       └── resources/
│
├── packages/
│   ├── media-core/
│   │   ├── inspection/
│   │   ├── compatibility/
│   │   ├── presets/
│   │   ├── command-builder/
│   │   ├── execution/
│   │   └── validation/
│   ├── shared-contracts/
│   ├── shared-types/
│   └── preset-catalog/
│
├── resources/
│   └── ffmpeg/
│
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── security.md
│   ├── presets.md
│   └── testing.md
│
├── package.json
├── pnpm-workspace.yaml
└── electron-builder.yml
```

---

## 20. Estrategia de pruebas

### Unitarias

- Resolución de presets.
- Reglas de compatibilidad.
- Construcción de argumentos.
- Cálculo de progreso.
- Políticas de nombres.
- Validación de configuraciones.

### Integración

- FFprobe con archivos reales.
- FFmpeg con archivos pequeños.
- Cancelación.
- Recuperación de errores.
- Fallback GPU → CPU.
- Validación de resultados.
- Vigilancia de carpetas.

### End-to-end

- Añadir archivo.
- Crear trabajo.
- Iniciar conversión.
- Visualizar progreso.
- Cancelar.
- Reintentar.
- Recuperar cola después de reiniciar.
- Crear y ejecutar una regla vigilada.

### Matriz multimedia mínima

- H.264.
- H.265 8-bit y 10-bit.
- AV1.
- VP9.
- AAC.
- AC3/EAC3.
- DTS.
- MKV y MP4.
- Subtítulos SRT, ASS y PGS.
- Video vertical.
- Framerate variable.
- HDR10.
- Archivo dañado.
- Ruta con espacios, acentos y caracteres Unicode.

---

## 21. Fases de desarrollo

### Fase 0 — Especificación

- Requisitos funcionales.
- Requisitos no funcionales.
- Estados de trabajos.
- Contratos IPC.
- Esquema de presets.
- Criterios de aceptación.
- Casos multimedia de prueba.

### Fase 1 — Base segura de Electron

- Electron, Vite, React y TypeScript.
- Main, preload y renderer separados.
- IPC seguro.
- Logging.
- Configuración de empaquetado.
- Pantalla de diagnóstico inicial.

### Fase 2 — Media Core

- Localización de FFmpeg y FFprobe.
- Inspección multimedia.
- Detección de encoders.
- Command Builder.
- Ejecución controlada.
- Progreso estructurado.
- Cancelación.

### Fase 3 — Cola persistente

- SQLite.
- Estados y transiciones.
- Concurrencia.
- Recuperación.
- Historial.
- Reintentos.

### Fase 4 — Presets inteligentes

- Perfil Smart TV.
- Perfil YouTube.
- Perfil compresión.
- Perfil archivo.
- Extracción de audio.
- Exportación para Apple Music.
- Perfiles personalizados.

### Fase 5 — Watch folders

- Vigilancia.
- Estabilización.
- Reglas.
- Prevención de duplicados.
- Acciones posteriores.
- Recuperación tras reinicio.

### Fase 6 — UX completa

- Dropzone.
- Cola visual.
- Configuración avanzada.
- Diagnóstico.
- Notificaciones.
- Accesibilidad.
- Traducciones.

### Fase 7 — Validación y distribución

- Pruebas Windows.
- Pruebas Ubuntu.
- Instaladores.
- Verificación de licencias.
- Firma de aplicación cuando corresponda.
- Documentación de usuario.
- Reporte de fallos.

---

## 22. Criterios de aceptación del MVP

El MVP se considerará funcional cuando:

1. Pueda importar archivos y carpetas.
2. Analice correctamente los streams mediante FFprobe.
3. Convierta a H.264 y AAC mediante CPU.
4. Utilice NVENC cuando esté disponible.
5. Realice fallback automático a CPU.
6. Muestre progreso, velocidad y ETA.
7. Permita cancelar y reintentar.
8. Respete un límite configurable de workers.
9. Mantenga la cola después de reiniciar.
10. Genere archivos mediante escritura temporal y validación final.
11. Incluya al menos un perfil Smart TV.
12. Incluya extracción de audio a M4A, MP3 y FLAC.
13. Vigile al menos una carpeta.
14. Evite procesar archivos todavía en escritura.
15. Se distribuya con FFmpeg y FFprobe incluidos.
16. Funcione en Windows 11 y Ubuntu.
17. No exponga Node.js al renderer.
18. Genere un reporte técnico de diagnóstico.

---

## 23. Decisiones adoptadas

- Se utilizará Electron, React, Vite y TypeScript.
- FFmpeg y FFprobe estarán incluidos por plataforma.
- También se permitirá configurar un FFmpeg externo.
- SQLite persistirá trabajos, presets y watchers.
- FFprobe será obligatorio antes de planificar una conversión.
- La cola y el motor multimedia serán módulos independientes.
- La GPU será una optimización, no un requisito.
- Siempre existirá fallback por CPU.
- Los perfiles se resolverán dinámicamente.
- Los archivos se escribirán primero como temporales.
- La integración Apple Music inicial será una exportación asistida.
- La primera versión estará centrada en Windows y Ubuntu x64.
- El modo avanzado no permitirá argumentos arbitrarios sin validación.

---

## 24. Resultado esperado

Al terminar las fases principales, FF-Converter será una aplicación estable que permita seleccionar archivos o vigilar carpetas, analizar automáticamente su compatibilidad, aplicar un perfil de dispositivo, elegir el método de codificación más adecuado y producir archivos validados.

La arquitectura permitirá añadir posteriormente:

- Nuevos perfiles de TV.
- Procesamiento distribuido.
- Plugins de presets.
- Normalización avanzada.
- Detección automática de escenas.
- Transcripción o subtítulos.
- Integración con servidores multimedia.
- Importadores específicos para bibliotecas musicales.
- Actualizaciones automáticas de la aplicación.
