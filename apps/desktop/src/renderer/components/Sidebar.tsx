import React from 'react';
import { useAppStore, TabId } from '../stores/appStore';
import {
  RefreshCw,
  ListVideo,
  FolderSync,
  History,
  Sliders,
  Activity,
  Terminal,
  Settings,
  Cpu
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, jobs, capabilities, unreadErrorCount, settings } = useAppStore();
  const english = settings?.language === 'en';

  const activeQueueCount = jobs.filter((j) => ['QUEUED', 'RUNNING', 'ANALYZING', 'VALIDATING_OUTPUT', 'WAITING_FOR_SPACE'].includes(j.status)).length;
  const hasGpu = capabilities?.hardwareEncoders.some(e => e.available && e.type !== 'cpu');

  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'convert', label: english ? 'Convert' : 'Convertir', icon: <RefreshCw size={18} /> },
    { id: 'queue', label: english ? 'Queue' : 'Cola', icon: <ListVideo size={18} />, badge: activeQueueCount },
    { id: 'watchers', label: english ? 'Watched folders' : 'Vigiladas', icon: <FolderSync size={18} /> },
    { id: 'history', label: english ? 'History' : 'Historial', icon: <History size={18} /> },
    { id: 'presets', label: english ? 'Presets' : 'Perfiles', icon: <Sliders size={18} /> },
    { id: 'diagnostics', label: english ? 'Diagnostics' : 'Diagnóstico', icon: <Activity size={18} /> },
    { id: 'logs', label: english ? 'Log console' : 'Consola Logs', icon: <Terminal size={18} />, badge: unreadErrorCount, badgeColor: 'badge-red' },
    { id: 'settings', label: english ? 'Settings' : 'Ajustes', icon: <Settings size={18} /> },
  ];

  return (
    <aside style={{
      width: '240px',
      height: '100%',
      maxHeight: '100vh',
      boxSizing: 'border-box',
      background: 'rgba(15, 23, 42, 0.95)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 14px',
      flexShrink: 0
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', padding: '0 8px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(6, 182, 212, 0.4)'
        }}>
          <img src="./icon.png" alt="" width={36} height={36} style={{ borderRadius: '10px', display: 'block' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>FF-Converter</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 500 }}>v1.0 Pro Architect</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.18), rgba(139, 92, 246, 0.08))' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`badge ${item.badgeColor || 'badge-blue'}`}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Hardware Status Footer */}
      <div className="glass" style={{ padding: '12px', marginTop: 'auto', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Cpu size={14} color={hasGpu ? 'var(--accent-green)' : 'var(--accent-amber)'} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
            {hasGpu ? (english ? 'GPU acceleration active' : 'Aceleración GPU Activa') : (english ? 'Software CPU mode' : 'Modo CPU Software')}
          </span>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)' }}>
          {capabilities ? `${capabilities.availableCpuCores} ${english ? 'cores' : 'núcleos'} | ${capabilities.platform}` : (english ? 'Detecting hardware…' : 'Detectando hardware...')}
        </div>
      </div>
    </aside>
  );
};
