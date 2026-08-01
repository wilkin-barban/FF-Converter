import React, { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { Sidebar } from './components/Sidebar';
import { ConvertView } from './components/ConvertView';
import { QueueView } from './components/QueueView';
import { WatchersView } from './components/WatchersView';
import { HistoryView } from './components/HistoryView';
import { PresetsView } from './components/PresetsView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { getErrorMessage } from './utils/errors';
import { useLiveInterfaceLanguage } from './utils/i18n';
import { UpdateDialog, UpdateDialogState } from './components/UpdateDialog';

export const App: React.FC = () => {
  const {
    activeTab,
    setJobs,
    updateJobInStore,
    setPresets,
    setWatchers,
    setSettings,
    setCapabilities,
    setIsQueuePaused,
    setLogs,
    addLogEntry,
    isInitializing,
    notice,
    setIsInitializing,
    showNotice,
    settings
  } = useAppStore();
  useLiveInterfaceLanguage(settings?.language ?? 'es');
  const [update, setUpdate] = useState<UpdateDialogState | null>(null);

  useEffect(() => {
    const api = window.ffConverter;
    if (!api) return;

    Promise.all([
      api.jobs.list().then(setJobs),
      api.presets.list().then(setPresets),
      api.watchers.list().then(setWatchers),
      api.settings.get().then(setSettings),
      api.system.getCapabilities().then(setCapabilities),
      api.system.getLogs().then(setLogs)
    ]).catch((error: unknown) => {
      showNotice({ kind: 'error', message: `No fue posible cargar la aplicación: ${getErrorMessage(error)}` });
    }).finally(() => setIsInitializing(false));

    // Event Listeners
    const unsubJob = api.events.onJobUpdated((job) => {
      updateJobInStore(job);
    });

    const unsubProgress = api.events.onJobProgress(() => {
      // Find job and update progress properties
      api.jobs.list().then(setJobs).catch(() => undefined);
    });

    const unsubQueue = api.events.onQueueStatus((status) => {
      setIsQueuePaused(status.paused);
    });

    const unsubLogs = api.events.onLogEntry((entry) => {
      addLogEntry(entry);
    });
    const unsubCapabilities = api.events.onCapabilitiesUpdated(setCapabilities);
    const unsubLogsCleared = api.events.onLogsCleared(() => setLogs([]));
    const unsubUpdateAvailable = api.events.onUpdateAvailable((payload) => setUpdate({ ...payload, phase: 'available' }));
    const unsubUpdateProgress = api.events.onUpdateProgress(({ percent }) => setUpdate((current) => current ? { ...current, phase: 'downloading', percent } : current));
    const unsubUpdateDownloaded = api.events.onUpdateDownloaded(() => setUpdate((current) => current ? { ...current, phase: 'downloaded' } : current));
    const unsubUpdateError = api.events.onUpdateError(() => setUpdate((current) => current ? { ...current, phase: 'error' } : current));

    // Window-level Drag and Drop handling for entire application
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.dataTransfer) return;

      const files = Array.from(e.dataTransfer.files || []);
      const items = Array.from(e.dataTransfer.items || []);
      const rawPaths: string[] = [];

      for (const file of files) {
        let p = '';
        try {
          p = await api.getPathForFile(file);
        } catch (error: unknown) {
          showNotice({ kind: 'error', message: getErrorMessage(error, 'No fue posible leer el archivo arrastrado.') });
        }
        if (p) rawPaths.push(p);
      }

      if (rawPaths.length === 0 && items.length > 0) {
        for (const item of items) {
          const file = item.getAsFile();
          if (file) {
            let p = '';
            try {
              p = await api.getPathForFile(file);
            } catch (error: unknown) {
              showNotice({ kind: 'error', message: getErrorMessage(error, 'No fue posible leer el archivo arrastrado.') });
            }
            if (p) rawPaths.push(p);
          }
        }
      }

      if (rawPaths.length > 0) {
        try {
        const expanded = await api.media.expandPaths(rawPaths);
        if (expanded && expanded.length > 0) {
          const store = useAppStore.getState();

          let targetFolder = store.outputFolder;
          if (!targetFolder) {
            const firstPath = expanded[0];
            targetFolder = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));
            store.setOutputFolder(targetFolder);
          }

          const selected = Array.from(new Set([...store.selectedFilePaths, ...expanded]));
          store.setSelectedFilePaths(selected);
          store.setActiveTab('convert');
          store.setIsInspecting(true);
          try {
            const inspections = await api.media.inspect(selected);
            store.setInspections(inspections);
            const rejected = selected.length - inspections.length;
            showNotice({
              kind: rejected > 0 ? 'info' : 'success',
              message: rejected > 0
                ? `${inspections.length} archivo(s) listos; ${rejected} no pudieron analizarse.`
                : `${inspections.length} archivo(s) agregados y analizados.`
            });
          } finally {
            store.setIsInspecting(false);
          }
        } else {
          showNotice({ kind: 'info', message: 'La selección no contiene archivos multimedia compatibles.' });
        }
        } catch (error: unknown) {
          showNotice({ kind: 'error', message: `No fue posible crear los trabajos: ${getErrorMessage(error)}` });
        }
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      if (unsubJob) unsubJob();
      if (unsubProgress) unsubProgress();
      if (unsubQueue) unsubQueue();
      if (unsubLogs) unsubLogs();
      if (unsubCapabilities) unsubCapabilities();
      if (unsubLogsCleared) unsubLogsCleared();
      if (unsubUpdateAvailable) unsubUpdateAvailable();
      if (unsubUpdateProgress) unsubUpdateProgress();
      if (unsubUpdateDownloaded) unsubUpdateDownloaded();
      if (unsubUpdateError) unsubUpdateError();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
    root.lang = settings.language;
  }, [settings?.theme, settings?.language]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => showNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{ flex: 1, background: 'var(--bg-dark)', overflow: 'hidden', position: 'relative' }}>
        {notice && (
          <div className={`app-notice app-notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <span>{notice.message}</span>
            <button onClick={() => showNotice(null)} aria-label="Cerrar mensaje">×</button>
          </div>
        )}
        {isInitializing && <div className="loading-overlay" role="status">Cargando datos de la aplicación…</div>}
        {activeTab === 'convert' && <ConvertView />}
        {activeTab === 'queue' && <QueueView />}
        {activeTab === 'watchers' && <WatchersView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'presets' && <PresetsView />}
        {activeTab === 'diagnostics' && <DiagnosticsView />}
        {activeTab === 'logs' && <LogsView />}
        {activeTab === 'settings' && <SettingsView />}
        {update && (
          <UpdateDialog
            state={update}
            onConfirm={() => {
              if (update.action === 'open-release') {
                setUpdate(null);
                void window.ffConverter.updates.downloadOrOpenRelease();
                return;
              }
              setUpdate((current) =>
                current ? { ...current, phase: 'downloading', percent: 0 } : current,
              );
              void window.ffConverter.updates.downloadOrOpenRelease();
            }}
            onDismiss={() => setUpdate(null)}
            onRestart={() => {
              void window.ffConverter.updates.install();
            }}
          />
        )}
      </main>
    </div>
  );
};
