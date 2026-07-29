import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { FolderSync, Plus, Trash2, Folder, CheckCircle, ShieldAlert } from 'lucide-react';
import { WatcherRule } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

export const WatchersView: React.FC = () => {
  const { watchers, setWatchers, presets, showNotice } = useAppStore();
  const [isWorking, setIsWorking] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [watchPath, setWatchPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [presetId, setPresetId] = useState(presets[0]?.id || 'system-smarttv-compat');
  const [stabilizationSeconds, setStabilizationSeconds] = useState(5);
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [processExisting, setProcessExisting] = useState(false);
  const [allowedExtensions, setAllowedExtensions] = useState('.mp4,.mkv,.avi,.mov,.mp3,.flac,.wav,.m4a,.webm');
  const [postAction, setPostAction] = useState<'keep' | 'delete' | 'move'>('keep');
  const [moveDestination, setMoveDestination] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'suffix' | 'skip' | 'overwrite'>('suffix');

  const handleSelectWatchPath = async () => {
    try {
    const folder = await window.ffConverter.media.selectFolder();
    if (folder) setWatchPath(folder);
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const handleSelectOutputPath = async () => {
    try {
    const folder = await window.ffConverter.media.selectFolder();
    if (folder) setOutputPath(folder);
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const handleSelectMovePath = async () => {
    try {
    const folder = await window.ffConverter.media.selectFolder();
    if (folder) setMoveDestination(folder);
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchPath || !outputPath || !ruleName) return;
    setIsWorking(true);
    try {
    const newRule = await window.ffConverter.watchers.save({
      name: ruleName,
      watchPath,
      outputPath,
      presetId,
      stabilizationSeconds,
      includeSubfolders,
      processExisting,
      allowedExtensions: allowedExtensions.split(',').map(value => value.trim()).filter(Boolean),
      postAction,
      moveDestination: postAction === 'move' ? moveDestination : undefined,
      duplicatePolicy,
      enabled: true
    });

    const updated = await window.ffConverter.watchers.list();
    setWatchers(updated);

    setShowAddForm(false);
    setRuleName('');
    setWatchPath('');
    setOutputPath('');
    showNotice({ kind: 'success', message: 'Regla de vigilancia guardada.' });
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible guardar la regla: ${getErrorMessage(error)}` });
    } finally { setIsWorking(false); }
  };

  const handleToggle = async (rule: WatcherRule) => {
    try {
    await window.ffConverter.watchers.save({
      ...rule,
      enabled: !rule.enabled
    });
    const updated = await window.ffConverter.watchers.list();
    setWatchers(updated);
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta regla de vigilancia?')) return;
    try {
      await window.ffConverter.watchers.remove(id);
      setWatchers(await window.ffConverter.watchers.list());
    } catch (error: unknown) { showNotice({ kind: 'error', message: getErrorMessage(error) }); }
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Carpetas Vigiladas</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Supervisión en segundo plano: procesa automáticamente archivos nuevos apenas completan la escritura.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={16} /> Nueva Regla Vigilada
        </button>
      </header>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleCreateRule} className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>Nueva Regla de Vigilancia</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre de la Regla</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Ej. Descargas SmartTV"
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Perfil de Conversión</label>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff', marginTop: '4px' }}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extensiones permitidas</label>
              <input value={allowedExtensions} onChange={(e) => setAllowedExtensions(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff', marginTop: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Acción después del éxito</label>
              <select value={postAction} onChange={(e) => setPostAction(e.target.value as WatcherRule['postAction'])} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff', marginTop: '4px' }}>
                <option value="keep">Conservar original</option>
                <option value="move">Mover original</option>
                <option value="delete">Eliminar original</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duplicados</label>
              <select value={duplicatePolicy} onChange={(e) => setDuplicatePolicy(e.target.value as WatcherRule['duplicatePolicy'])} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff', marginTop: '4px' }}>
                <option value="suffix">Añadir sufijo</option>
                <option value="skip">Omitir</option>
                <option value="overwrite">Sobrescribir</option>
              </select>
            </div>
          </div>

          {postAction === 'move' && (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Destino para mover el original</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input value={moveDestination} onChange={(e) => setMoveDestination(e.target.value)} required style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
                <button type="button" className="btn-secondary" onClick={handleSelectMovePath}><Folder size={14} /></button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '18px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <label><input type="checkbox" checked={includeSubfolders} onChange={(e) => setIncludeSubfolders(e.target.checked)} /> Incluir subcarpetas</label>
            <label><input type="checkbox" checked={processExisting} onChange={(e) => setProcessExisting(e.target.checked)} /> Procesar archivos existentes al activar</label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Carpeta de Origen (Vigilada)</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  value={watchPath}
                  onChange={(e) => setWatchPath(e.target.value)}
                  placeholder="Carpeta de origen..."
                  required
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}
                />
                <button type="button" className="btn-secondary" onClick={handleSelectWatchPath}><Folder size={14} /></button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Carpeta de Destino (Resultado)</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                  placeholder="Carpeta de destino..."
                  required
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}
                />
                <button type="button" className="btn-secondary" onClick={handleSelectOutputPath}><Folder size={14} /></button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Tiempo de estabilización:</span>
              <input
                type="number"
                value={stabilizationSeconds}
                onChange={(e) => setStabilizationSeconds(Number(e.target.value))}
                min={2}
                max={60}
                style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}
              />
              <span>segundos</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={isWorking}>{isWorking ? 'Guardando…' : 'Guardar Regla'}</button>
            </div>
          </div>
        </form>
      )}

      {/* Watchers List */}
      {watchers.length === 0 ? (
        <div className="glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          No hay reglas de vigilancia configuradas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {watchers.map((w) => {
            const preset = presets.find((p) => p.id === w.presetId);
            return (
              <div key={w.id} className="glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <FolderSync size={24} color={w.enabled ? 'var(--accent-green)' : 'var(--text-sub)'} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{w.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                      Origen: {w.watchPath} ➔ Destino: {w.outputPath}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <span className="badge badge-purple">Perfil: {preset?.name || w.presetId}</span>
                      <span className="badge badge-blue">Estabilización: {w.stabilizationSeconds}s</span>
                      <span className="badge badge-amber">Original: {w.postAction}</span>
                      {w.processExisting && <span className="badge badge-red">Incluye existentes</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => handleToggle(w)}
                    className="btn-secondary"
                    style={{ color: w.enabled ? 'var(--accent-green)' : 'var(--text-sub)' }}
                  >
                    {w.enabled ? 'Activa' : 'Pausada'}
                  </button>
                  <button onClick={() => handleDelete(w.id)} className="btn-secondary" style={{ color: 'var(--accent-red)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
