import { useEffect } from 'react';
import { AppSettings } from '@ff-converter/shared-types';

export type UiLanguage = AppSettings['language'];

const ENGLISH: Record<string, string> = {
  'Convertir': 'Convert',
  'Cola': 'Queue',
  'Vigiladas': 'Watched folders',
  'Historial': 'History',
  'Perfiles': 'Presets',
  'Diagnóstico': 'Diagnostics',
  'Consola Logs': 'Log console',
  'Ajustes': 'Settings',
  'Aceleración GPU Activa': 'GPU acceleration active',
  'Modo CPU Software': 'Software CPU mode',
  'Detectando hardware...': 'Detecting hardware...',
  'Cargando datos de la aplicación…': 'Loading application data…',
  'Convertir Medios': 'Convert Media',
  'Arrastrá archivos multimedia o carpetas completas, seleccioná un perfil optimizado y comenzá el procesamiento por lotes.': 'Drag media files or complete folders, select an optimized preset, and start batch processing.',
  'Hacé clic o arrastrá tus archivos o carpetas de video aquí': 'Click or drag your video files or folders here',
  'Soporta MP4, MKV, AVI, MOV, FLAC, MP3, WAV, etc.': 'Supports MP4, MKV, AVI, MOV, FLAC, MP3, WAV, and more.',
  'Seleccionar Archivos': 'Select Files',
  'Seleccionar Carpeta Completa': 'Select Complete Folder',
  'Archivos Seleccionados': 'Selected Files',
  'Limpiar lista': 'Clear list',
  'Pendiente de análisis': 'Pending analysis',
  'Perfil de Conversión': 'Conversion Preset',
  'Carpeta de Destino': 'Destination Folder',
  'Seleccionar carpeta de destino...': 'Select destination folder...',
  'Explorar': 'Browse',
  'Escritura temporal atómica con validación FFprobe previa': 'Atomic temporary writes with prior FFprobe validation',
  'Vista previa del plan efectivo': 'Effective plan preview',
  'Vídeo': 'Video',
  'Audio': 'Audio',
  'Añadir e Iniciar Conversión': 'Add and Start Conversion',
  'Diagnóstico del sistema': 'System Diagnostics',
  'Binarios, plataforma, espacio disponible y aceleradores probados.': 'Binaries, platform, available space, and tested accelerators.',
  'Copiado': 'Copied',
  'Copiar reporte': 'Copy report',
  'Actualizar': 'Refresh',
  'Entorno técnico': 'Technical Environment',
  'Plataforma': 'Platform',
  'Núcleos CPU': 'CPU cores',
  'No disponible': 'Unavailable',
  'Aceleración disponible': 'Available Acceleration',
  'Solo se usarán automáticamente las opciones que superaron la prueba.': 'Only options that passed the test will be used automatically.',
  'No se detectó aceleración GPU. Las conversiones usarán CPU.': 'No GPU acceleration was detected. Conversions will use the CPU.',
  'Opciones no compatibles': 'Unsupported Options',
  'Esto describe las limitaciones del equipo o del build de FFmpeg; no son fallos de la aplicación.': 'These are limitations of the computer or FFmpeg build, not application failures.',
  'Detalle técnico': 'Technical details',
  'El encoder no está incluido o no pudo inicializarse en este equipo.': 'The encoder is not included or could not initialize on this computer.',
  'Consola de Auditoría y Logs': 'Audit and Log Console',
  'Registro en vivo de operaciones, advertencias y errores del núcleo FFmpeg y sistema.': 'Live record of operations, warnings, and errors from FFmpeg and the system.',
  'Carpeta': 'Folder',
  'Exportar': 'Export',
  'Copiar Logs': 'Copy Logs',
  'Limpiar': 'Clear',
  'Buscar por mensaje, componente o error...': 'Search by message, component, or error...',
  'TODOS LOS ORÍGENES': 'ALL SOURCES',
  'ÚLTIMA HORA': 'LAST HOUR',
  'ÚLTIMAS 24H': 'LAST 24 HOURS',
  'TODO EL HISTORIAL': 'ALL HISTORY',
  'No hay registros que coincidan con los filtros.': 'No records match the current filters.',
  'Historial de Conversión': 'Conversion History',
  'Registro completo de trabajos finalizados y sus estadísticas de salida.': 'Complete record of finished jobs and their output statistics.',
  'El historial está vacío.': 'History is empty.',
  'Perfil': 'Preset',
  'Tamaño': 'Size',
  'Abrir archivo': 'Open file',
  'Ajustes del sistema': 'System Settings',
  'Configuración global de rendimiento, apariencia, FFmpeg y archivos temporales.': 'Global performance, appearance, FFmpeg, and temporary-file settings.',
  'Apariencia': 'Appearance',
  'Oscuro': 'Dark',
  'Claro': 'Light',
  'Usar configuración del sistema': 'Use system settings',
  'Idioma': 'Language',
  'Español': 'Spanish',
  'Origen de FFmpeg y FFprobe': 'FFmpeg and FFprobe source',
  'Integrado con la aplicación': 'Bundled with the application',
  'Instalado en el sistema (PATH)': 'Installed on the system (PATH)',
  'Rutas personalizadas': 'Custom paths',
  'Recomendado: usa FFmpeg 8.1.2 incluido. Si falta, se intenta la instalación del sistema.': 'Recommended: uses the included FFmpeg 8.1.2. If missing, the system installation is attempted.',
  'Requiere que FFmpeg y FFprobe estén disponibles en PATH.': 'Requires FFmpeg and FFprobe to be available in PATH.',
  'Usa ejecutables específicos mediante dos rutas absolutas.': 'Uses specific executables through two absolute paths.',
  'Acelerador preferido': 'Preferred accelerator',
  'Automático': 'Automatic',
  'Solo CPU': 'CPU only',
  'Ruta absoluta de FFmpeg': 'Absolute FFmpeg path',
  'Ruta absoluta de FFprobe': 'Absolute FFprobe path',
  'Límite máximo de trabajos simultáneos': 'Maximum simultaneous jobs',
  'Política de archivos duplicados': 'Duplicate file policy',
  'Añadir sufijo numerado': 'Add numbered suffix',
  'Omitir si existe': 'Skip if it exists',
  'Sobrescribir destino': 'Overwrite destination',
  'Automatización y temporales': 'Automation and temporary files',
  'Concurrencia automática': 'Automatic concurrency',
  'Iniciar watchers automáticamente': 'Start watchers automatically',
  'Conservar temporales si falla una conversión': 'Keep temporary files when a conversion fails',
  'Mostrar notificaciones del escritorio al terminar': 'Show desktop notifications when finished',
  'Los cambios se validan antes de persistirse.': 'Changes are validated before being saved.',
  'Guardando…': 'Saving…',
  'Guardar ajustes': 'Save settings',
  'Cargando ajustes…': 'Loading settings…',
  'Carpetas Vigiladas': 'Watched Folders',
  'Supervisión en segundo plano: procesa automáticamente archivos nuevos apenas completan la escritura.': 'Background monitoring: automatically processes new files once writing finishes.',
  'Nueva Regla Vigilada': 'New Watched Rule',
  'Nueva Regla de Vigilancia': 'New Watch Rule',
  'Acción después del éxito': 'Action after success',
  'Conservar original': 'Keep original',
  'Eliminar original': 'Delete original',
  'Mover original': 'Move original',
  'Añadir sufijo': 'Add suffix',
  'Carpeta de Origen (Vigilada)': 'Source Folder (Watched)',
  'Carpeta de origen...': 'Source folder...',
  'Carpeta de Destino (Resultado)': 'Destination Folder (Result)',
  'Carpeta de destino...': 'Destination folder...',
  'Tiempo de estabilización:': 'Stabilization time:',
  'Cancelar': 'Cancel',
  'Guardar Regla': 'Save Rule',
  'Estabilización': 'Stabilization',
  'Cola de Procesamiento': 'Processing Queue',
  'Reintentar fallidos': 'Retry failed',
  'Reanudar Cola': 'Resume Queue',
  'Pausar Cola': 'Pause Queue',
  'No hay trabajos activos en este momento. Los nuevos trabajos aparecerán aquí.': 'There are no active jobs right now. New jobs will appear here.',
  'Reanudar trabajo': 'Resume job',
  'Pausar trabajo': 'Pause job',
  'Abrir ubicación': 'Open location',
  'Reintentar': 'Retry',
  'Eliminar de la cola': 'Remove from queue',
  'Eliminar': 'Remove',
  'La conversión no pudo completarse': 'The conversion could not be completed',
  'Ver detalle': 'View details',
  'Catálogo de Perfiles': 'Preset Catalog',
  'Perfiles preconfigurados para televisores, dispositivos, redes sociales y bibliotecas de audio.': 'Preconfigured presets for televisions, devices, social networks, and audio libraries.',
  'Crear Perfil Personalizado': 'Create Custom Preset',
  'Nuevo Perfil Personalizado': 'New Custom Preset',
  'Nombre': 'Name',
  'Descripción': 'Description',
  'Contenedor': 'Container',
  'Codec de vídeo': 'Video codec',
  'Codec de audio': 'Audio codec',
  'Política HDR': 'HDR policy',
  'Subtítulos': 'Subtitles',
  'Preservar': 'Preserve',
  'Convertir texto': 'Convert text',
  'Incrustar en vídeo': 'Burn into video',
  'Guardar Perfil': 'Save Preset',
  'TODOS': 'ALL',
  'ADVERTENCIA': 'WARNING',
  'INFORMACIÓN': 'INFORMATION',
  'ERROR': 'ERROR',
  '¿Limpiar todos los registros de la consola? Esta acción no se puede deshacer.': 'Clear all console records? This action cannot be undone.',
  '¿Eliminar este trabajo del historial?': 'Remove this job from history?',
  '¿Eliminar esta regla de vigilancia?': 'Delete this watch rule?',
  '¿Cancelar este trabajo? El archivo temporal puede descartarse.': 'Cancel this job? The temporary file may be discarded.'
};

const PATTERNS: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d+) núcleos \| (.+)$/u, (cores, platform) => `${cores} cores | ${platform}`],
  [/^Archivos Seleccionados \((\d+)\)$/u, count => `Selected Files (${count})`],
  [/^Añadir e Iniciar Conversión \((\d+)\)$/u, count => `Add and Start Conversion (${count})`],
  [/^Mostrar (\d+) registros más \((\d+) restantes\)$/u, (count, remaining) => `Show ${count} more records (${remaining} remaining)`],
  [/^Mostrar (\d+) elementos más \((\d+) restantes\)$/u, (count, remaining) => `Show ${count} more items (${remaining} remaining)`],
  [/^Mostrar (\d+) trabajos más \((\d+) restantes\)$/u, (count, remaining) => `Show ${count} more jobs (${remaining} remaining)`],
  [/^Trabajos activos en ejecución \((\d+) de (\d+) totales\)\.$/u, (active, total) => `Active jobs running (${active} of ${total} total).`],
  [/^Perfil: (.+) \| Tamaño: (.+)$/u, (preset, size) => `Preset: ${preset} | Size: ${size}`],
  [/^Perfil: (.+)$/u, preset => `Preset: ${preset}`],
  [/^Estabilización: (.+)$/u, seconds => `Stabilization: ${seconds}`],
  [/^El modo automático puede usar menos recursos, pero nunca superará (\d+)\.$/u, count => `Automatic mode may use fewer resources, but will never exceed ${count}.`],
  [/^La cola podrá ejecutar hasta (\d+) trabajo\(s\) a la vez\.$/u, count => `The queue can run up to ${count} job(s) at once.`],
  [/^Vista del primer archivo; se resolverá un plan independiente para cada uno de los (\d+) archivos\.$/u, count => `Preview of the first file; an independent plan will be resolved for each of the ${count} files.`]
];

const TEXT_SOURCES = new WeakMap<Text, string>();
const TEXT_RENDERED = new WeakMap<Text, string>();
const ATTRIBUTE_SOURCES = new WeakMap<Element, Map<string, string>>();

export function translateUiText(value: string, language: UiLanguage): string {
  if (language !== 'en') return value;
  const leading = value.match(/^\s*/u)?.[0] ?? '';
  const trailing = value.match(/\s*$/u)?.[0] ?? '';
  const normalized = value.trim();
  if (!normalized) return value;
  const exact = ENGLISH[normalized];
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, render] of PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return `${leading}${render(...match.slice(1))}${trailing}`;
  }
  return value;
}

export function useLiveInterfaceLanguage(language: UiLanguage): void {
  useEffect(() => {
    document.documentElement.lang = language;
    const attributes = ['placeholder', 'title', 'aria-label'];

    const translateTextNode = (node: Text) => {
      const current = node.nodeValue ?? '';
      if (TEXT_RENDERED.get(node) !== current) TEXT_SOURCES.set(node, current);
      const rendered = translateUiText(TEXT_SOURCES.get(node) ?? current, language);
      TEXT_RENDERED.set(node, rendered);
      if (current !== rendered) node.nodeValue = rendered;
    };

    const translateElement = (element: Element) => {
      let sources = ATTRIBUTE_SOURCES.get(element);
      if (!sources) {
        sources = new Map();
        ATTRIBUTE_SOURCES.set(element, sources);
      }
      for (const attribute of attributes) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        if (!sources.has(attribute)) sources.set(attribute, current);
        const translated = translateUiText(sources.get(attribute) ?? current, language);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    };

    const translateTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) translateTextNode(root as Text);
      if (root.nodeType === Node.ELEMENT_NODE) translateElement(root as Element);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
        else translateElement(node as Element);
      }
    };

    translateTree(document.body);
    const observer = new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'characterData') translateTextNode(record.target as Text);
        for (const node of Array.from(record.addedNodes)) translateTree(node);
      }
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const nativeConfirm = window.confirm.bind(window);
    window.confirm = (message?: string) => nativeConfirm(translateUiText(String(message ?? ''), language));

    return () => {
      observer.disconnect();
      window.confirm = nativeConfirm;
    };
  }, [language]);
}
