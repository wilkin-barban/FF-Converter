import React from 'react';

export type UpdateDialogState = {
  version: string;
  action: 'download' | 'open-release';
  phase: 'available' | 'downloading' | 'downloaded' | 'error';
  percent?: number;
};

export function UpdateDialog({ state, onConfirm, onDismiss, onRestart }: {
  state: UpdateDialogState;
  onConfirm: () => void;
  onDismiss: () => void;
  onRestart: () => void;
}) {
  const title = state.phase === 'downloaded' ? 'Actualización lista' : 'Hay una actualización disponible';
  const actionLabel = state.action === 'open-release' ? 'Abrir página de descarga' : 'Descargar actualización';
  return <div role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" className="update-dialog-overlay">
    <section className="update-dialog">
      <h2 id="update-dialog-title">{title}</h2>
      <p>FF-Converter {state.version} está disponible.</p>
      {state.phase === 'downloading' && <><p>Descargando actualización… {state.percent ?? 0}%</p><progress value={state.percent ?? 0} max="100" aria-label="Progreso de descarga" /></>}
      {state.phase === 'error' && <p role="status">No fue posible descargar la actualización. Podés intentarlo más tarde.</p>}
      <div className="update-dialog-actions">
        {state.phase === 'available' && <button onClick={onConfirm}>{actionLabel}</button>}
        {state.phase === 'downloaded' && <button onClick={onRestart}>Reiniciar ahora</button>}
        <button onClick={onDismiss}>{state.phase === 'downloaded' ? 'Más tarde' : 'Ahora no'}</button>
      </div>
    </section>
  </div>;
}
