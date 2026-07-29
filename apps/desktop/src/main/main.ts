import { app, BrowserWindow, Menu, Notification, nativeImage } from 'electron';
import path from 'path';
import { AppDatabase } from './database/db';
import { QueueOrchestrator } from './services/queue-orchestrator';
import { WatchService } from './services/watch-service';
import { setupIpcHandlers } from './ipc';
import { HardwareInspector } from '@ff-converter/media-core';
import { SystemCapabilities } from '@ff-converter/shared-types';

import { LoggerService } from './services/logger-service';
import { FFmpegLocator } from './services/ffmpeg-locator';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase;
let queueOrchestrator: QueueOrchestrator;
let watchService: WatchService;
let loggerService: LoggerService;
let cachedCapabilities: SystemCapabilities | null = null;
const isSmokeTest = process.argv.includes('--smoke-test') || process.env.FF_CONVERTER_SMOKE_TEST === '1';
app.setName('FF-Converter');
if (process.platform === 'win32') app.setAppUserModelId('com.ffconverter.app');

async function initCapabilities(forceRefresh = false): Promise<SystemCapabilities> {
  if (cachedCapabilities && !forceRefresh) return cachedCapabilities;
  const locator = new FFmpegLocator({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged
  });
  try {
    const resolution = locator.resolve(db.getSettings());
    if (resolution.fallbackReason) loggerService.warn('Hardware', resolution.fallbackReason);
    const inspector = new HardwareInspector(resolution.ffmpegPath, resolution.ffprobePath);
    cachedCapabilities = {
      ...(await inspector.detectCapabilities()),
      requestedFfmpegPathMode: resolution.requestedMode,
      effectiveFfmpegPathMode: resolution.effectiveMode,
      ffmpegPathFallbackReason: resolution.fallbackReason
    };
  } catch (err: any) {
    loggerService.error('Hardware', 'No fue posible resolver o inspeccionar FFmpeg.', err.message);
    cachedCapabilities = {
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      ffmpegVersion: `FFmpeg unavailable: ${err.message}`,
      requestedFfmpegPathMode: db.getSettings().ffmpegPathMode,
      hardwareEncoders: [],
      availableCpuCores: 4,
      platform: process.platform as any
    };
  }
  return cachedCapabilities;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const windowIconPath = isDev
    ? path.resolve(app.getAppPath(), '../../build/icon.ico')
    : path.join(process.resourcesPath, process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png');
  const windowIcon = nativeImage.createFromPath(windowIconPath);

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'FF-Converter',
    icon: windowIcon,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a', // sleek dark mode
    show: !isSmokeTest,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.setMenu(null);
  if (!windowIcon.isEmpty()) mainWindow.setIcon(windowIcon);
  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      loggerService.info('System', 'Smoke test del paquete completado.');
      app.exit(0);
    });
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      const expectedOrigin = new URL(process.env.VITE_DEV_SERVER_URL).origin;
      if (new URL(navigationUrl).origin === expectedOrigin) return;
    }
    event.preventDefault();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  loggerService = new LoggerService({
    logDirectory: path.join(app.getPath('userData'), 'logs')
  });
  loggerService.info('System', 'Iniciando Antigravity FF-Converter Core...');

  db = new AppDatabase(loggerService);
  const recoveredJobs = db.recoverInterruptedJobs();
  if (recoveredJobs.length > 0) {
    loggerService.warn('Queue', `Se recuperaron ${recoveredJobs.length} trabajo(s) interrumpido(s).`);
  }
  const caps = await initCapabilities();
  loggerService.info('Hardware', `Detectados ${caps.availableCpuCores} núcleos CPU en plataforma ${caps.platform}.`);

  const activeGpus = caps.hardwareEncoders.filter(e => e.available && e.type !== 'cpu').map(e => e.name).join(', ');
  if (activeGpus) {
    loggerService.info('Hardware', `Aceleradores GPU disponibles: ${activeGpus}`);
  } else {
    loggerService.warn('Hardware', 'No se detectaron aceleradores GPU dedicados. Usando codificadores por software CPU.');
  }

  queueOrchestrator = new QueueOrchestrator(
    db,
    () => cachedCapabilities!,
    () => db.getSettings(),
    loggerService
  );

  watchService = new WatchService(queueOrchestrator, db, loggerService);

  // Send events to renderer
  queueOrchestrator.on('job-updated', (job) => {
    if (job.status === 'FAILED') {
      loggerService.error('Queue', `Trabajo fallido: ${job.inputPath}`, job.error);
    } else if (job.status === 'COMPLETED') {
      loggerService.info('Queue', `Trabajo completado con éxito: ${job.outputPath}`);
    }
    if (db.getSettings().desktopNotifications && Notification.isSupported()) {
      if (job.status === 'COMPLETED') {
        new Notification({ title: 'Conversión completada', body: path.basename(job.outputPath) }).show();
      } else if (job.status === 'FAILED') {
        new Notification({ title: 'Conversión fallida', body: path.basename(job.inputPath) }).show();
      }
    }
    mainWindow?.webContents.send('events:job-updated', job);
  });

  queueOrchestrator.on('job-progress', (payload) => {
    mainWindow?.webContents.send('events:job-progress', payload);
  });

  queueOrchestrator.on('queue-status', (status) => {
    mainWindow?.webContents.send('events:queue-status', status);
  });

  loggerService.on('log', (entry) => {
    mainWindow?.webContents.send('events:log-entry', entry);
  });
  loggerService.on('cleared', () => {
    mainWindow?.webContents.send('events:logs-cleared');
  });

  setupIpcHandlers(
    db,
    queueOrchestrator,
    watchService,
    () => cachedCapabilities!,
    loggerService,
    () => initCapabilities(true)
  );

  // Restore watchers
  const settings = db.getSettings();
  if (settings.autoStartWatchers) {
    watchService.syncWatchers(db.getWatchers());
  }

  createWindow();
  queueOrchestrator.processQueue();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (watchService) watchService.stopAll();
  if (process.platform !== 'darwin') app.quit();
});
