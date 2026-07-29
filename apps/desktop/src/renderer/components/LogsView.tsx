import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Terminal, Copy, Trash2, CheckCircle2, AlertTriangle, Info, Search, Download, FolderOpen } from 'lucide-react';
import { LogEntry, LogLevel, LogSource } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

export const LogsView: React.FC = () => {
  const { logs, setLogs, showNotice } = useAppStore();
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'hour' | 'day'>('all');
  const [visibleCount, setVisibleCount] = useState(250);
  const [isWorking, setIsWorking] = useState(false);

  const filteredLogs = logs.filter((log: LogEntry) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
    const age = Date.now() - new Date(log.timestamp).getTime();
    if (timeFilter === 'hour' && age > 60 * 60 * 1000) return false;
    if (timeFilter === 'day' && age > 24 * 60 * 60 * 1000) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchSrc = log.source.toLowerCase().includes(q);
      const matchDet = log.details ? log.details.toLowerCase().includes(q) : false;
      return matchMsg || matchSrc || matchDet;
    }
    return true;
  });

  const handleClear = async () => {
    if (!window.confirm('¿Limpiar todos los registros de la consola? Esta acción no se puede deshacer.')) return;
    setIsWorking(true);
    try {
      await window.ffConverter.system.clearLogs();
      setLogs([]);
      showNotice({ kind: 'success', message: 'Los registros fueron eliminados.' });
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = () => {
    const text = filteredLogs.map((l: LogEntry) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message} ${l.details ? `\n  Details: ${l.details}` : ''}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error: unknown) => showNotice({ kind: 'error', message: `No fue posible copiar: ${getErrorMessage(error)}` }));
  };

  const handleExport = async () => {
    try {
      const exported = await window.ffConverter.system.exportLogs();
      if (exported) showNotice({ kind: 'success', message: `Logs exportados en ${exported}` });
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.ffConverter.system.openLogsFolder();
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> ERROR</span>;
      case 'warn':
        return <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> WARN</span>;
      default:
        return <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Info size={12} /> INFO</span>;
    }
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={24} color="var(--accent-cyan)" /> Consola de Auditoría y Logs
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Registro en vivo de operaciones, advertencias y errores del núcleo FFmpeg y sistema.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleOpenFolder}><FolderOpen size={16} /> Carpeta</button>
          <button className="btn-secondary" onClick={handleExport}><Download size={16} /> Exportar</button>
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? <CheckCircle2 size={16} color="var(--accent-green)" /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar Logs'}
          </button>
          <button className="btn-secondary" onClick={handleClear} disabled={isWorking} style={{ color: 'var(--accent-red)' }}>
            <Trash2 size={16} /> Limpiar
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'rgba(9, 13, 22, 0.9)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <Search size={16} color="var(--text-sub)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por mensaje, componente o error..."
            style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'info', 'warn', 'error'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl as LogLevel | 'all')}
              className="btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: filterLevel === lvl ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                borderColor: filterLevel === lvl ? 'var(--accent-blue)' : 'var(--border-color)',
                color: filterLevel === lvl ? '#fff' : 'var(--text-muted)'
              }}
            >
              {lvl.toUpperCase()}
            </button>
          ))}
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="btn-secondary" style={{ color: '#fff' }}>
          <option value="all">TODOS LOS ORÍGENES</option>
          {(['FFmpeg', 'Queue', 'Watcher', 'Database', 'Hardware', 'System'] as LogSource[]).map(source => (
            <option value={source} key={source}>{source}</option>
          ))}
        </select>
        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as 'all' | 'hour' | 'day')} className="btn-secondary" aria-label="Rango temporal" style={{ color: '#fff' }}>
          <option value="all">TODO EL TIEMPO</option>
          <option value="hour">ÚLTIMA HORA</option>
          <option value="day">ÚLTIMAS 24H</option>
        </select>
      </div>

      {/* Terminal Log Stream */}
      <div
        className="glass"
        style={{
          flex: 1,
          padding: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(9, 13, 22, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '40px' }}>
            No hay registros de log que coincidan con los filtros.
          </div>
        ) : (
          filteredLogs.slice(0, visibleCount).map((entry: LogEntry) => {
            const time = new Date(entry.timestamp).toLocaleTimeString();

            return (
              <div
                key={entry.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: entry.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : entry.level === 'warn' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  borderLeft: entry.level === 'error' ? '3px solid var(--accent-red)' : entry.level === 'warn' ? '3px solid var(--accent-amber)' : '3px solid var(--accent-blue)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>[{time}]</span>
                  {getLevelBadge(entry.level)}
                  <span className="badge badge-purple">[{entry.source}]</span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{entry.message}</span>
                </div>
                {entry.details && (
                  <pre style={{ margin: '6px 0 0 0', color: 'var(--accent-red)', fontSize: '0.75rem', whiteSpace: 'pre-wrap', background: 'rgba(0, 0, 0, 0.3)', padding: '6px', borderRadius: '4px' }}>
                    {entry.details}
                  </pre>
                )}
              </div>
            );
          })
        )}
        {filteredLogs.length > visibleCount && (
          <button className="btn-secondary" onClick={() => setVisibleCount((count) => count + 250)}>
            Mostrar 250 registros más ({filteredLogs.length - visibleCount} restantes)
          </button>
        )}
      </div>
    </div>
  );
};
