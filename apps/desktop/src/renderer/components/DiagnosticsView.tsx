import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Activity, Copy, CheckCircle2, RotateCcw, Terminal } from 'lucide-react';
import { TechnicalReport } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

const formatBytes = (bytes: number | null) => bytes === null
  ? 'No disponible'
  : `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;

export const DiagnosticsView: React.FC = () => {
  const { capabilities, setCapabilities, setActiveTab, showNotice } = useAppStore();
  const [report, setReport] = useState<TechnicalReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const availableEncoders = capabilities?.hardwareEncoders.filter(encoder => encoder.available) ?? [];
  const unavailableEncoders = capabilities?.hardwareEncoders.filter(encoder => !encoder.available) ?? [];

  const loadReport = async (refresh = false) => {
    setIsLoading(true);
    try {
      if (refresh) setCapabilities(await window.ffConverter.system.refreshCapabilities());
      setReport(await window.ffConverter.system.getTechnicalReport());
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible obtener el diagnóstico: ${getErrorMessage(error)}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadReport(); }, []);

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  return (
    <div className="view-container" aria-busy={isLoading}>
      <header className="diagnostic-header">
        <div><h2>Diagnóstico del sistema</h2><p className="muted">Binarios, plataforma, espacio disponible y aceleradores probados.</p></div>
        <div className="button-row">
          <button className="btn-secondary" onClick={() => setActiveTab('logs')}><Terminal size={16} /> Consola</button>
          <button className="btn-secondary" onClick={() => void loadReport(true)} disabled={isLoading}><RotateCcw size={16} /> Actualizar</button>
          <button className="btn-secondary" onClick={() => void copyReport()} disabled={!report}>
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar reporte'}
          </button>
        </div>
      </header>

      <section className="glass diagnostic-card">
        <h3><Activity size={20} /> Entorno técnico</h3>
        <dl className="diagnostic-grid">
          <div><dt>FFmpeg</dt><dd>{capabilities?.ffmpegVersion || 'Cargando…'}</dd></div>
          <div><dt>Modo efectivo</dt><dd>{capabilities?.effectiveFfmpegPathMode || 'No disponible'}</dd></div>
          <div><dt>Plataforma</dt><dd>{report ? `${report.platform} ${report.architecture}` : 'Cargando…'}</dd></div>
          <div><dt>Electron / Node</dt><dd>{report ? `${report.electronVersion} / ${report.nodeVersion}` : 'Cargando…'}</dd></div>
          <div><dt>Núcleos CPU</dt><dd>{capabilities?.availableCpuCores ?? 'No disponible'}</dd></div>
          <div><dt>Espacio en volumen FFmpeg</dt><dd>{formatBytes(report?.availableBytesOnFfmpegVolume ?? null)}</dd></div>
          <div className="wide"><dt>Ruta FFmpeg</dt><dd>{capabilities?.ffmpegPath || 'No disponible'}</dd></div>
          <div className="wide"><dt>Ruta FFprobe</dt><dd>{capabilities?.ffprobePath || 'No disponible'}</dd></div>
        </dl>
        {capabilities?.ffmpegPathFallbackReason && (
          <div className="diagnostic-note" role="status">
            <strong>FFmpeg integrado no disponible.</strong>
            <span>Se está usando la instalación del sistema. La aplicación puede funcionar normalmente, pero el paquete aún no es autónomo.</span>
          </div>
        )}
      </section>

      <section>
        <div className="diagnostic-section-title">
          <div><h3>Aceleración disponible</h3><p className="muted">Solo se usarán automáticamente las opciones que superaron la prueba.</p></div>
          <span className="badge badge-green">{availableEncoders.length} compatibles</span>
        </div>
        <div className="encoder-grid">
          {availableEncoders.map((encoder) => (
            <article key={encoder.id} className="glass encoder-card">
              <div><strong>{encoder.name}</strong><code>{encoder.id}</code></div>
              <span className="badge badge-green">Disponible</span>
            </article>
          ))}
          {availableEncoders.length === 0 && <div className="glass empty-encoder">No se detectó aceleración GPU. Las conversiones usarán CPU.</div>}
        </div>
      </section>

      {unavailableEncoders.length > 0 && (
        <section className="glass unsupported-panel">
          <div className="diagnostic-section-title">
            <div>
              <h3>Opciones no disponibles</h3>
              <p className="muted">Esto describe las limitaciones del equipo o del build de FFmpeg; no son fallos de la aplicación.</p>
            </div>
            <span className="badge">{unavailableEncoders.length} omitidas</span>
          </div>
          <div className="unsupported-list">
            {unavailableEncoders.map(encoder => (
              <details key={encoder.id} className="unsupported-item">
                <summary>
                  <span><strong>{encoder.name}</strong><code>{encoder.id}</code></span>
                  <span className="badge badge-neutral">No soportado</span>
                </summary>
                <div className="technical-detail">
                  <strong>Detalle técnico</strong>
                  <pre>{encoder.errorDetails || 'El encoder no está incluido o no pudo inicializarse en este equipo.'}</pre>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
