import { ipcMain, dialog, shell, IpcMainInvokeEvent } from 'electron';
import { AppDatabase } from '../database/db';
import { QueueOrchestrator } from '../services/queue-orchestrator';
import { WatchService } from '../services/watch-service';
import { HardwareInspector } from '@ff-converter/media-core';
import { MediaInspector, PresetResolver } from '@ff-converter/media-core';
import {
  CreateJobSchema,
  PresetSchema,
  WatcherRuleSchema,
  AppSettingsSchema,
  AbsolutePathSchema,
  PathListSchema,
  EntityIdSchema,
  JobPrioritySchema,
  ResolvePlansSchema
} from '@ff-converter/shared-contracts';
import { SystemCapabilities, TechnicalReport } from '@ff-converter/shared-types';

import fs from 'fs/promises';
import path from 'path';
import { PathAccessRegistry } from '../security/path-access';
import { assertTrustedIpcSender } from '../security/ipc-security';

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m2ts',
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.m4v', '.3gp'
]);

async function expandMediaPaths(inputPaths: string[]): Promise<string[]> {
  const result = new Set<string>();

  async function scan(itemPath: string, depth: number) {
    if (depth > 32 || result.size >= 1000) return;
    try {
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(itemPath);
        for (const entry of entries) {
          if (result.size >= 1000) break;
          await scan(path.join(itemPath, entry), depth + 1);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(itemPath).toLowerCase();
        if (MEDIA_EXTENSIONS.has(ext)) {
          result.add(path.resolve(itemPath));
        }
      }
    } catch (err) {
      console.error(`Error scanning path ${itemPath}:`, err);
    }
  }

  for (const p of inputPaths) {
    await scan(p, 0);
  }

  return [...result];
}

import { LoggerService } from '../services/logger-service';
import { UpdateService } from '../services/update-service';

export function setupIpcHandlers(
  db: AppDatabase,
  queueOrchestrator: QueueOrchestrator,
  watchService: WatchService,
  getCapabilities: () => SystemCapabilities,
  loggerService: LoggerService,
  refreshCapabilities: () => Promise<SystemCapabilities>,
  updateService: UpdateService
) {
  const pathAccess = new PathAccessRegistry();
  const inspectionCache = new Map<string, any>();
  const secureHandle = (
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => any
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(event);
      return handler(event, ...args);
    });
  };

  for (const job of db.getJobs()) {
    try {
      pathAccess.authorizeFile(job.inputPath);
      pathAccess.authorizeGeneratedPath(job.outputPath);
      if (job.tempPath) pathAccess.authorizeGeneratedPath(job.tempPath);
    } catch (error: any) {
      loggerService.warn('Database', `Trabajo ignorado por contener rutas inválidas: ${job.id}`, error.message);
    }
  }
  for (const watcher of db.getWatchers()) {
    try {
      pathAccess.authorizeDirectory(watcher.watchPath);
      pathAccess.authorizeDirectory(watcher.outputPath);
      if (watcher.moveDestination) pathAccess.authorizeDirectory(watcher.moveDestination);
    } catch (error: any) {
      loggerService.warn('Database', `Regla ignorada por contener rutas inválidas: ${watcher.id}`, error.message);
    }
  }

  // --- Media & File Dialogs ---
  secureHandle('media:selectFiles', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', 'm2ts', 'mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    loggerService.info('System', `Seleccionados ${res.filePaths.length} archivo(s) mediante diálogo.`);
    if (res.canceled) return [];
    return res.filePaths.map((filePath) => {
      pathAccess.authorizeOutputDirectory(path.dirname(filePath));
      return pathAccess.authorizeFile(filePath);
    });
  });

  secureHandle('media:selectFolder', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return res.canceled ? null : pathAccess.authorizeDirectory(res.filePaths[0]);
  });

  secureHandle('media:authorizeDroppedPath', async (_, rawPath: unknown) => {
    const droppedPath = AbsolutePathSchema.parse(rawPath);
    const stat = await fs.stat(droppedPath);
    if (stat.isDirectory()) return pathAccess.authorizeDirectory(droppedPath);
    pathAccess.authorizeOutputDirectory(path.dirname(droppedPath));
    return pathAccess.authorizeFile(droppedPath);
  });

  secureHandle('media:expandPaths', async (_, rawPaths: unknown) => {
    const inputPaths = PathListSchema.parse(rawPaths).map((itemPath) => pathAccess.assertReadable(itemPath));
    const expanded = await expandMediaPaths(inputPaths);
    expanded.forEach((filePath) => pathAccess.authorizeFile(filePath));
    return expanded;
  });

  secureHandle('media:inspect', async (_, rawPaths: unknown) => {
    const filePaths = PathListSchema.parse(rawPaths).map((itemPath) => pathAccess.assertReadable(itemPath));
    const caps = getCapabilities();
    const inspector = new MediaInspector(caps.ffprobePath);
    const expandedPaths = await expandMediaPaths(filePaths);
    const results = [];
    for (const p of expandedPaths) {
      try {
        const snap = await inspector.inspect(p);
        inspectionCache.set(p, snap);
        results.push(snap);
      } catch (err: any) {
        loggerService.warn('FFmpeg', `No se pudo analizar el archivo: ${path.basename(p)}`, err?.message || String(err));
      }
    }
    if (expandedPaths.length > 0 && results.length === 0) {
      throw new Error('Ninguno de los archivos seleccionados pudo ser analizado por FFprobe. Revisa los formatos y consulta la consola de logs.');
    }
    return results;
  });

  secureHandle('media:resolvePlans', async (_, rawInput: unknown) => {
    const input = ResolvePlansSchema.parse(rawInput);
    const filePaths = input.filePaths.map((filePath) => pathAccess.assertReadable(filePath));
    const preset = db.getPresets().find((candidate) => candidate.id === input.presetId);
    if (!preset) throw new Error('Preset not found');
    const capabilities = getCapabilities();
    const inspector = new MediaInspector(capabilities.ffprobePath);
    const resolver = new PresetResolver();
    const results = [];
    for (const filePath of filePaths) {
      const mediaSnapshot = inspectionCache.get(filePath) || await inspector.inspect(filePath);
      inspectionCache.set(filePath, mediaSnapshot);
      results.push({
        filePath,
        plan: resolver.resolve(preset, mediaSnapshot, capabilities, db.getSettings())
      });
    }
    return results;
  });

  // --- Jobs Queue ---
  secureHandle('jobs:list', async () => {
    return db.getJobs();
  });

  secureHandle('jobs:create', async (_, rawInput: unknown) => {
    const input = CreateJobSchema.parse(rawInput);
    const inputPaths = input.inputPaths.map((itemPath) => pathAccess.assertReadable(itemPath));
    const outputFolder = pathAccess.assertDirectory(input.outputFolder);
    const expandedPaths = await expandMediaPaths(inputPaths);
    if (expandedPaths.length === 0) {
      throw new Error('No se encontraron archivos multimedia compatibles en la selección.');
    }
    const jobs = [];
    for (const p of expandedPaths) {
      const job = await queueOrchestrator.addJob(p, outputFolder, input.presetId, input.priority);
      pathAccess.authorizeGeneratedPath(job.outputPath);
      if (job.tempPath) pathAccess.authorizeGeneratedPath(job.tempPath);
      jobs.push(job);
    }
    return jobs;
  });

  secureHandle('jobs:cancel', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getJobs().some((job) => job.id === id)) throw new Error('Job not found');
    queueOrchestrator.cancelJob(id);
    return true;
  });

  secureHandle('jobs:retry', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getJobs().some((job) => job.id === id)) throw new Error('Job not found');
    return queueOrchestrator.retryJob(id);
  });

  secureHandle('jobs:retryAll', async () => {
    return queueOrchestrator.retryFailedAndInterrupted();
  });

  secureHandle('jobs:pause', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    return queueOrchestrator.pauseJob(id);
  });

  secureHandle('jobs:resume', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    return queueOrchestrator.resumeJob(id);
  });

  secureHandle('jobs:setPriority', async (_, rawInput: unknown) => {
    const input = JobPrioritySchema.parse(rawInput);
    return queueOrchestrator.setJobPriority(input.id, input.priority);
  });

  secureHandle('jobs:transitions', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getJobs().some((job) => job.id === id)) throw new Error('Job not found');
    return db.getJobTransitions(id);
  });

  secureHandle('jobs:remove', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getJobs().some((job) => job.id === id)) throw new Error('Job not found');
    return queueOrchestrator.removeJob(id);
  });

  secureHandle('jobs:pauseQueue', async () => {
    queueOrchestrator.pauseQueue();
    return true;
  });

  secureHandle('jobs:resumeQueue', async () => {
    queueOrchestrator.resumeQueue();
    return true;
  });

  // --- Presets ---
  secureHandle('presets:list', async () => {
    return db.getPresets();
  });

  secureHandle('presets:save', async (_, rawInput: unknown) => {
    const preset = PresetSchema.parse(rawInput);
    const fullPreset = {
      ...preset,
      id: preset.id || `preset-custom-${Date.now()}`
    };
    db.savePreset(fullPreset);
    return fullPreset;
  });

  secureHandle('presets:remove', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getPresets().some((preset) => preset.id === id)) throw new Error('Preset not found');
    db.deletePreset(id);
    return true;
  });

  // --- Watchers ---
  secureHandle('watchers:list', async () => {
    return db.getWatchers();
  });

  secureHandle('watchers:save', async (_, rawInput: unknown) => {
    const rule = WatcherRuleSchema.parse(rawInput);
    pathAccess.assertDirectory(rule.watchPath);
    pathAccess.assertDirectory(rule.outputPath);
    if (rule.moveDestination) pathAccess.assertDirectory(rule.moveDestination);
    const fullRule = {
      ...rule,
      id: rule.id || `rule-${Date.now()}`,
      createdAt: rule.id ? undefined : new Date().toISOString()
    } as any;
    db.saveWatcher(fullRule);
    watchService.syncWatchers(db.getWatchers());
    return fullRule;
  });

  secureHandle('watchers:remove', async (_, rawId: unknown) => {
    const id = EntityIdSchema.parse(rawId);
    if (!db.getWatchers().some((watcher) => watcher.id === id)) throw new Error('Watcher not found');
    db.deleteWatcher(id);
    watchService.syncWatchers(db.getWatchers());
    return true;
  });

  // --- Settings ---
  secureHandle('settings:get', async () => {
    return db.getSettings();
  });

  secureHandle('settings:save', async (event, rawInput: unknown) => {
    const settings = AppSettingsSchema.parse(rawInput);
    db.saveSettings(settings);
    const capabilities = await refreshCapabilities();
    event.sender.send('events:capabilities-updated', capabilities);
    return settings;
  });

  // --- Updates ---
  secureHandle('updates:downloadOrOpenRelease', async () => {
    await updateService.downloadOrOpenRelease();
    return true;
  });

  secureHandle('updates:install', async () => {
    updateService.install();
    return true;
  });

  // --- System & Hardware ---
  secureHandle('system:getCapabilities', async () => {
    return getCapabilities();
  });

  secureHandle('system:refreshCapabilities', async (event) => {
    const capabilities = await refreshCapabilities();
    event.sender.send('events:capabilities-updated', capabilities);
    return capabilities;
  });

  secureHandle('system:getTechnicalReport', async (): Promise<TechnicalReport> => {
    const capabilities = getCapabilities();
    let availableBytesOnFfmpegVolume: number | null = null;
    try {
      const capacity = await fs.statfs(path.dirname(capabilities.ffmpegPath));
      availableBytesOnFfmpegVolume = Number(capacity.bavail) * Number(capacity.bsize);
    } catch {
      // Some PATH-based binaries do not resolve to a stat-able directory.
    }
    return {
      generatedAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version || '1.0.0',
      electronVersion: process.versions.electron || 'unknown',
      nodeVersion: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      availableBytesOnFfmpegVolume,
      capabilities
    };
  });

  secureHandle('system:openPath', async (_, rawPath: unknown) => {
    const pathStr = pathAccess.assertOpenable(AbsolutePathSchema.parse(rawPath));
    const errorMessage = await shell.openPath(pathStr);
    if (errorMessage) throw new Error(errorMessage);
    return true;
  });

  secureHandle('system:showItemInFolder', async (_, rawPath: unknown) => {
    const pathStr = pathAccess.assertOpenable(AbsolutePathSchema.parse(rawPath));
    shell.showItemInFolder(pathStr);
    return true;
  });

  // --- Logs & Debug Console ---
  secureHandle('system:getLogs', async () => {
    return loggerService.getLogs();
  });

  secureHandle('system:clearLogs', async () => {
    loggerService.clearLogs();
    return true;
  });

  secureHandle('system:getLogFilePath', async () => {
    return loggerService.getLogFilePath();
  });

  secureHandle('system:openLogsFolder', async () => {
    const logFilePath = loggerService.getLogFilePath();
    if (!logFilePath) return false;
    shell.showItemInFolder(logFilePath);
    return true;
  });

  secureHandle('system:exportLogs', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Exportar logs de FF-Converter',
      defaultPath: `ff-converter-logs-${new Date().toISOString().slice(0, 10)}.jsonl`,
      filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }]
    });
    if (result.canceled || !result.filePath) return null;
    loggerService.exportLogs(result.filePath);
    return result.filePath;
  });
}
