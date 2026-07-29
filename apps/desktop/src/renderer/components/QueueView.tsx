import React from 'react';
import { useAppStore } from '../stores/appStore';
import { Job, JobStatus } from '@ff-converter/shared-types';
import { Pause, Play, XCircle, RotateCcw, FolderOpen, Zap, AlertTriangle, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';

export const QueueView: React.FC = () => {
  const { jobs, setJobs, isQueuePaused, capabilities, showNotice } = useAppStore();
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(200);

  const activeJobs = jobs.filter((j) => ['QUEUED', 'RUNNING', 'ANALYZING', 'VALIDATING_OUTPUT', 'WAITING_FOR_SPACE', 'INTERRUPTED', 'PAUSED', 'FAILED', 'CANCELLED'].includes(j.status));

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setPendingAction(key);
    try {
      await action();
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  };

  const handlePauseResume = async () => {
    await runAction('queue', () => isQueuePaused
      ? window.ffConverter.jobs.resumeQueue()
      : window.ffConverter.jobs.pauseQueue());
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('¿Cancelar este trabajo? El archivo temporal puede descartarse.')) return;
    await runAction(id, () => window.ffConverter.jobs.cancel(id));
  };

  const handleRetry = async (id: string) => {
    await runAction(id, async () => {
      const retried = await window.ffConverter.jobs.retry(id);
      setJobs(await window.ffConverter.jobs.list());
      if (!retried) showNotice({ kind: 'error', message: 'La entrada no es un archivo válido. Puedes eliminar este trabajo de la cola.' });
    });
  };

  const handleRetryAll = async () => {
    await runAction('retry-all', async () => {
      const count = await window.ffConverter.jobs.retryAll();
      setJobs(await window.ffConverter.jobs.list());
      showNotice({
        kind: count > 0 ? 'success' : 'info',
        message: count > 0 ? `${count} trabajo(s) enviados nuevamente a la cola.` : 'No hay trabajos válidos para reintentar.'
      });
    });
  };

  const handlePriority = async (job: Job, delta: number) => {
    await runAction(job.id, () => window.ffConverter.jobs.setPriority(job.id, job.priority + delta));
  };

  const handleJobPauseResume = async (job: Job) => {
    if (job.status === 'PAUSED') {
      await runAction(job.id, () => window.ffConverter.jobs.resume(job.id));
    } else {
      await runAction(job.id, () => window.ffConverter.jobs.pause(job.id));
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('¿Eliminar este trabajo del historial?')) return;
    await runAction(id, async () => {
      await window.ffConverter.jobs.remove(id);
      setJobs(await window.ffConverter.jobs.list());
      showNotice({ kind: 'success', message: 'Trabajo eliminado de la cola.' });
    });
  };

  const handleOpenFolder = async (folderPath: string) => {
    await runAction('open-folder', () => window.ffConverter.system.showItemInFolder(folderPath));
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'RUNNING':
        return <span className="badge badge-blue">EN CURSO</span>;
      case 'QUEUED':
        return <span className="badge badge-purple">EN COLA</span>;
      case 'ANALYZING':
        return <span className="badge badge-amber">ANALIZANDO</span>;
      case 'VALIDATING_OUTPUT':
        return <span className="badge badge-cyan">VALIDANDO</span>;
      case 'WAITING_FOR_SPACE':
        return <span className="badge badge-amber">ESPERANDO ESPACIO</span>;
      case 'COMPLETED':
        return <span className="badge badge-green">COMPLETADO</span>;
      case 'FAILED':
        return <span className="badge badge-red">FALLIDO</span>;
      case 'INTERRUPTED':
        return <span className="badge badge-amber">INTERRUMPIDO</span>;
      case 'PAUSED':
        return <span className="badge badge-amber">PAUSADO</span>;
      case 'CANCELLED':
        return <span className="badge badge-red">CANCELADO</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0s';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Cola de Procesamiento</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Trabajos activos en ejecución ({activeJobs.length} de {jobs.length} totales).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleRetryAll} disabled={pendingAction !== null}>
            <RotateCcw size={16} /> Reintentar fallidos
          </button>
          <button className="btn-secondary" onClick={handlePauseResume} disabled={pendingAction !== null}>
            {isQueuePaused ? <Play size={16} /> : <Pause size={16} />}
            {isQueuePaused ? 'Reanudar Cola' : 'Pausar Cola'}
          </button>
        </div>
      </header>

      {activeJobs.length === 0 ? (
        <div className="glass" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-sub)' }}>
          No hay trabajos activos en este momento. Los nuevos trabajos aparecerán aquí.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeJobs.slice(0, visibleCount).map((job) => {
            const filename = job.inputPath.substring(Math.max(job.inputPath.lastIndexOf('\\'), job.inputPath.lastIndexOf('/')) + 1);

            return (
              <div key={job.id} className="glass" aria-busy={pendingAction === job.id} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getStatusBadge(job.status)}
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{filename}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>[{job.presetName}]</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['QUEUED', 'WAITING_FOR_SPACE', 'INTERRUPTED'].includes(job.status) && (
                      <>
                        <button className="btn-secondary" onClick={() => handlePriority(job, 1)} title="Subir prioridad">
                          <ChevronUp size={14} />
                        </button>
                        <button className="btn-secondary" onClick={() => handlePriority(job, -1)} title="Bajar prioridad">
                          <ChevronDown size={14} />
                        </button>
                      </>
                    )}

                    {capabilities?.platform !== 'win32' && ['RUNNING', 'PAUSED'].includes(job.status) && (
                      <button className="btn-secondary" onClick={() => handleJobPauseResume(job)} title={job.status === 'PAUSED' ? 'Reanudar trabajo' : 'Pausar trabajo'}>
                        {job.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                    )}

                    <button className="btn-secondary" onClick={() => handleOpenFolder(job.outputPath)} title="Abrir ubicación">
                      <FolderOpen size={14} />
                    </button>

                    {['FAILED', 'INTERRUPTED', 'CANCELLED'].includes(job.status) && (
                      <button className="btn-secondary" onClick={() => handleRetry(job.id)} title="Reintentar">
                        <RotateCcw size={14} />
                      </button>
                    )}

                    {['FAILED', 'INTERRUPTED', 'CANCELLED', 'SKIPPED'].includes(job.status) && (
                      <button className="btn-secondary" onClick={() => handleRemove(job.id)} title="Eliminar de la cola" aria-label={`Eliminar ${filename}`} style={{ color: 'var(--accent-red)' }}>
                        <Trash2 size={14} /> {job.status === 'FAILED' && <span>Eliminar</span>}
                      </button>
                    )}

                    {['RUNNING', 'PAUSED', 'QUEUED', 'ANALYZING', 'WAITING_FOR_SPACE', 'INTERRUPTED'].includes(job.status) && (
                      <button className="btn-secondary" onClick={() => handleCancel(job.id)} title="Cancelar" style={{ color: 'var(--accent-red)' }}>
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div role="progressbar" aria-label={`Progreso de ${filename}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progressPercent || 0} style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${job.progressPercent || 0}%`,
                      background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                      transition: 'width 0.3s ease',
                      borderRadius: '999px'
                    }}
                  />
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>Progreso: <strong style={{ color: '#fff' }}>{job.progressPercent}%</strong></span>
                    {job.currentFps > 0 && <span>FPS: <strong style={{ color: '#fff' }}>{job.currentFps}</strong></span>}
                    {job.currentSpeed > 0 && (
                      <span>Velocidad: <strong style={{ color: 'var(--accent-green)' }}>{job.currentSpeed}x</strong></span>
                    )}
                    {job.hardwareUsed && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-purple)' }}>
                        <Zap size={12} /> {job.hardwareUsed}
                      </span>
                    )}
                  </div>

                  <div>
                    {job.etaSeconds > 0 && <span>Tiempo restante: <strong style={{ color: '#fff' }}>{formatSeconds(job.etaSeconds)}</strong></span>}
                  </div>
                </div>

                {job.error && (
                  <details className="queue-error">
                    <summary><AlertTriangle size={14} /> La conversión no pudo completarse <span>Ver detalle</span></summary>
                    <pre>{job.error}</pre>
                  </details>
                )}
              </div>
            );
          })}
          {activeJobs.length > visibleCount && (
            <button className="btn-secondary" onClick={() => setVisibleCount((count) => count + 200)}>
              Mostrar 200 trabajos más ({activeJobs.length - visibleCount} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
