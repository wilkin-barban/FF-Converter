import { create } from 'zustand';
import { Job, Preset, WatcherRule, AppSettings, SystemCapabilities, MediaSnapshot, LogEntry } from '@ff-converter/shared-types';

export type TabId = 'convert' | 'queue' | 'watchers' | 'history' | 'presets' | 'diagnostics' | 'logs' | 'settings';

interface AppStoreState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // Convert tab state
  selectedFilePaths: string[];
  inspections: MediaSnapshot[];
  selectedPresetId: string;
  outputFolder: string;
  isInspecting: boolean;
  setSelectedFilePaths: (paths: string[]) => void;
  setInspections: (inspections: MediaSnapshot[]) => void;
  setSelectedPresetId: (presetId: string) => void;
  setOutputFolder: (folder: string) => void;
  setIsInspecting: (inspecting: boolean) => void;

  // Global domain data
  jobs: Job[];
  presets: Preset[];
  watchers: WatcherRule[];
  settings: AppSettings | null;
  capabilities: SystemCapabilities | null;
  isQueuePaused: boolean;
  logs: LogEntry[];
  unreadErrorCount: number;
  isInitializing: boolean;
  notice: { kind: 'success' | 'error' | 'info'; message: string } | null;

  setJobs: (jobs: Job[]) => void;
  updateJobInStore: (job: Job) => void;
  setPresets: (presets: Preset[]) => void;
  setWatchers: (watchers: WatcherRule[]) => void;
  setSettings: (settings: AppSettings) => void;
  setCapabilities: (caps: SystemCapabilities) => void;
  setIsQueuePaused: (paused: boolean) => void;
  setLogs: (logs: LogEntry[]) => void;
  addLogEntry: (entry: LogEntry) => void;
  setIsInitializing: (value: boolean) => void;
  showNotice: (notice: AppStoreState['notice']) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  activeTab: 'convert',
  setActiveTab: (tab) => set((state) => ({
    activeTab: tab,
    unreadErrorCount: tab === 'logs' ? 0 : state.unreadErrorCount
  })),

  selectedFilePaths: [],
  inspections: [],
  selectedPresetId: 'system-smarttv-compat',
  outputFolder: '',
  isInspecting: false,

  setSelectedFilePaths: (paths) => set({ selectedFilePaths: paths }),
  setInspections: (inspections) => set({ inspections }),
  setSelectedPresetId: (presetId) => set({ selectedPresetId: presetId }),
  setOutputFolder: (folder) => set({ outputFolder: folder }),
  setIsInspecting: (inspecting) => set({ isInspecting: inspecting }),

  jobs: [],
  presets: [],
  watchers: [],
  settings: null,
  capabilities: null,
  isQueuePaused: false,
  logs: [],
  unreadErrorCount: 0,
  isInitializing: true,
  notice: null,

  setJobs: (jobs) => set({ jobs }),
  updateJobInStore: (updatedJob) =>
    set((state) => {
      const idx = state.jobs.findIndex((j) => j.id === updatedJob.id);
      if (idx !== -1) {
        const newJobs = [...state.jobs];
        newJobs[idx] = updatedJob;
        return { jobs: newJobs };
      } else {
        return { jobs: [updatedJob, ...state.jobs] };
      }
    }),
  setPresets: (presets) => set({ presets }),
  setWatchers: (watchers) => set({ watchers }),
  setSettings: (settings) => set({ settings }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setIsQueuePaused: (isQueuePaused) => set({ isQueuePaused }),
  setLogs: (logs) => set({ logs, unreadErrorCount: logs.filter(entry => entry.level === 'error').length }),
  addLogEntry: (entry) => set((state) => ({
    logs: [entry, ...state.logs].slice(0, 1000),
    unreadErrorCount: entry.level === 'error' && state.activeTab !== 'logs'
      ? state.unreadErrorCount + 1
      : state.unreadErrorCount
  })),
  setIsInitializing: (isInitializing) => set({ isInitializing }),
  showNotice: (notice) => set({ notice }),
}));
