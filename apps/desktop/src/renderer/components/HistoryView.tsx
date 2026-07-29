import React from 'react';
import { useAppStore } from '../stores/appStore';
import { History, FolderOpen, Trash2, CheckCircle2, AlertTriangle, FileVideo } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

export const HistoryView: React.FC = () => {
  const { jobs, setJobs, showNotice } = useAppStore();
  const [visibleCount, setVisibleCount] = React.useState(200);

  const finishedJobs = jobs.filter((j) => ['COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'].includes(j.status));

  const handleOpenFolder = async (folderPath: string) => {
    try { await window.ffConverter.system.showItemInFolder(folderPath); }
    catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('¿Eliminar este trabajo del historial?')) return;
    try {
      await window.ffConverter.jobs.remove(id);
      setJobs(await window.ffConverter.jobs.list());
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const formatMB = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Historial de Conversión</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Registro completo de trabajos finalizados y sus estadísticas de salida.
        </p>
      </header>

      {finishedJobs.length === 0 ? (
        <div className="glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          El historial está vacío.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {finishedJobs.slice(0, visibleCount).map((j) => {
            const filename = j.outputPath.substring(Math.max(j.outputPath.lastIndexOf('\\'), j.outputPath.lastIndexOf('/')) + 1);

            return (
              <div key={j.id} className="glass" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {j.status === 'COMPLETED' ? (
                    <CheckCircle2 size={20} color="var(--accent-green)" />
                  ) : (
                    <AlertTriangle size={20} color="var(--accent-red)" />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{filename}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
                      Perfil: {j.presetName} | Tamaño: {formatMB(j.outputSizeBytes || j.fileSizeBytes)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {j.status === 'COMPLETED' && (
                    <button className="btn-secondary" onClick={() => handleOpenFolder(j.outputPath)}>
                      <FolderOpen size={14} /> Abrir archivo
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => handleRemove(j.id)} style={{ color: 'var(--accent-red)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {finishedJobs.length > visibleCount && (
            <button className="btn-secondary" onClick={() => setVisibleCount((count) => count + 200)}>
              Mostrar 200 elementos más ({finishedJobs.length - visibleCount} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
