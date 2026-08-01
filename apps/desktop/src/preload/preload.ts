import { contextBridge, ipcRenderer, webUtils, IpcRendererEvent } from 'electron';
import { Job, Preset, WatcherRule, AppSettings, SystemCapabilities, ProgressEventPayload, MediaSnapshot, JobTransition, EffectiveConversionPlan, LogEntry, TechnicalReport } from '@ff-converter/shared-types';

const ffConverterAPI = {
  getPathForFile: async (file: File): Promise<string> => {
    const filePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke('media:authorizeDroppedPath', filePath);
  },
  media: {
    selectFiles: (): Promise<string[]> => ipcRenderer.invoke('media:selectFiles'),
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke('media:selectFolder'),
    expandPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('media:expandPaths', paths),
    inspect: (paths: string[]): Promise<MediaSnapshot[]> => ipcRenderer.invoke('media:inspect', paths),
    resolvePlans: (filePaths: string[], presetId: string): Promise<Array<{ filePath: string; plan: EffectiveConversionPlan }>> =>
      ipcRenderer.invoke('media:resolvePlans', { filePaths, presetId }),
  },
  jobs: {
    list: (): Promise<Job[]> => ipcRenderer.invoke('jobs:list'),
    create: (input: { inputPaths: string[]; outputFolder: string; presetId: string; priority?: number }): Promise<Job[]> =>
      ipcRenderer.invoke('jobs:create', input),
    cancel: (id: string): Promise<boolean> => ipcRenderer.invoke('jobs:cancel', id),
    retry: (id: string): Promise<boolean> => ipcRenderer.invoke('jobs:retry', id),
    retryAll: (): Promise<number> => ipcRenderer.invoke('jobs:retryAll'),
    pause: (id: string): Promise<boolean> => ipcRenderer.invoke('jobs:pause', id),
    resume: (id: string): Promise<boolean> => ipcRenderer.invoke('jobs:resume', id),
    setPriority: (id: string, priority: number): Promise<Job> =>
      ipcRenderer.invoke('jobs:setPriority', { id, priority }),
    transitions: (id: string): Promise<JobTransition[]> => ipcRenderer.invoke('jobs:transitions', id),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('jobs:remove', id),
    pauseQueue: (): Promise<boolean> => ipcRenderer.invoke('jobs:pauseQueue'),
    resumeQueue: (): Promise<boolean> => ipcRenderer.invoke('jobs:resumeQueue'),
  },
  presets: {
    list: (): Promise<Preset[]> => ipcRenderer.invoke('presets:list'),
    save: (input: Partial<Preset>): Promise<Preset> => ipcRenderer.invoke('presets:save', input),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('presets:remove', id),
  },
  watchers: {
    list: (): Promise<WatcherRule[]> => ipcRenderer.invoke('watchers:list'),
    save: (input: Partial<WatcherRule>): Promise<WatcherRule> => ipcRenderer.invoke('watchers:save', input),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('watchers:remove', id),
  },
  updates: {
    downloadOrOpenRelease: (): Promise<boolean> => ipcRenderer.invoke('updates:downloadOrOpenRelease'),
    install: (): Promise<boolean> => ipcRenderer.invoke('updates:install'),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (input: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:save', input),
  },
  system: {
    getCapabilities: (): Promise<SystemCapabilities> => ipcRenderer.invoke('system:getCapabilities'),
    refreshCapabilities: (): Promise<SystemCapabilities> => ipcRenderer.invoke('system:refreshCapabilities'),
    getTechnicalReport: (): Promise<TechnicalReport> => ipcRenderer.invoke('system:getTechnicalReport'),
    openPath: (pathStr: string): Promise<boolean> => ipcRenderer.invoke('system:openPath', pathStr),
    showItemInFolder: (pathStr: string): Promise<boolean> => ipcRenderer.invoke('system:showItemInFolder', pathStr),
    getLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('system:getLogs'),
    clearLogs: (): Promise<boolean> => ipcRenderer.invoke('system:clearLogs'),
    getLogFilePath: (): Promise<string | null> => ipcRenderer.invoke('system:getLogFilePath'),
    openLogsFolder: (): Promise<boolean> => ipcRenderer.invoke('system:openLogsFolder'),
    exportLogs: (): Promise<string | null> => ipcRenderer.invoke('system:exportLogs'),
  },
  events: {
    onJobUpdated: (callback: (job: Job) => void) => {
      const listener = (_: IpcRendererEvent, job: Job) => callback(job);
      ipcRenderer.on('events:job-updated', listener);
      return () => ipcRenderer.removeListener('events:job-updated', listener);
    },
    onJobProgress: (callback: (payload: ProgressEventPayload) => void) => {
      const listener = (_: IpcRendererEvent, payload: ProgressEventPayload) => callback(payload);
      ipcRenderer.on('events:job-progress', listener);
      return () => ipcRenderer.removeListener('events:job-progress', listener);
    },
    onQueueStatus: (callback: (status: { paused: boolean }) => void) => {
      const listener = (_: IpcRendererEvent, status: { paused: boolean }) => callback(status);
      ipcRenderer.on('events:queue-status', listener);
      return () => ipcRenderer.removeListener('events:queue-status', listener);
    },
    onLogEntry: (callback: (entry: LogEntry) => void) => {
      const listener = (_: IpcRendererEvent, entry: LogEntry) => callback(entry);
      ipcRenderer.on('events:log-entry', listener);
      return () => ipcRenderer.removeListener('events:log-entry', listener);
    },
    onCapabilitiesUpdated: (callback: (capabilities: SystemCapabilities) => void) => {
      const listener = (_: IpcRendererEvent, capabilities: SystemCapabilities) => callback(capabilities);
      ipcRenderer.on('events:capabilities-updated', listener);
      return () => ipcRenderer.removeListener('events:capabilities-updated', listener);
    },
    onUpdateAvailable: (callback: (payload: { version: string; releaseNotes?: string; action: 'download' | 'open-release' }) => void) => {
      const listener = (_: IpcRendererEvent, payload: { version: string; releaseNotes?: string; action: 'download' | 'open-release' }) => callback(payload);
      ipcRenderer.on('events:update-available', listener);
      return () => ipcRenderer.removeListener('events:update-available', listener);
    },
    onUpdateProgress: (callback: (payload: { percent: number }) => void) => {
      const listener = (_: IpcRendererEvent, payload: { percent: number }) => callback(payload);
      ipcRenderer.on('events:update-progress', listener);
      return () => ipcRenderer.removeListener('events:update-progress', listener);
    },
    onUpdateDownloaded: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('events:update-downloaded', listener);
      return () => ipcRenderer.removeListener('events:update-downloaded', listener);
    },
    onUpdateError: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('events:update-error', listener);
      return () => ipcRenderer.removeListener('events:update-error', listener);
    },
    onLogsCleared: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('events:logs-cleared', listener);
      return () => ipcRenderer.removeListener('events:logs-cleared', listener);
    }
  }
};

contextBridge.exposeInMainWorld('ffConverter', ffConverterAPI);

export type FFConverterAPI = typeof ffConverterAPI;
