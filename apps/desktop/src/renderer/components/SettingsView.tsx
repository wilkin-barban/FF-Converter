import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Save, ShieldCheck } from 'lucide-react';
import { AppSettings } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

type SelectChange = React.ChangeEvent<HTMLSelectElement>;

export const SettingsView: React.FC = () => {
  const { settings, setSettings, showNotice } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);

  const save = async (updated: AppSettings) => {
    setIsSaving(true);
    try {
      const saved = await window.ffConverter.settings.save(updated);
      setSettings(saved);
      showNotice({ kind: 'success', message: 'Ajustes guardados correctamente.' });
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible guardar los ajustes: ${getErrorMessage(error)}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return <div className="empty-state" role="status">Cargando ajustes…</div>;
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="view-container">
      <header>
        <h2>Ajustes del sistema</h2>
        <p className="muted">Configuración global de rendimiento, apariencia, FFmpeg y archivos temporales.</p>
      </header>

      <form className="glass settings-grid" onSubmit={(event) => { event.preventDefault(); void save(settings); }}>
        <label>
          Apariencia
          <select value={settings.theme} onChange={(e: SelectChange) => update('theme', e.target.value as AppSettings['theme'])}>
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
            <option value="system">Usar configuración del sistema</option>
          </select>
        </label>

        <label>
          Idioma
          <select value={settings.language} onChange={(e: SelectChange) => update('language', e.target.value as AppSettings['language'])}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>

        <label>
          Origen de FFmpeg y FFprobe
          <select value={settings.ffmpegPathMode} onChange={(e: SelectChange) => update('ffmpegPathMode', e.target.value as AppSettings['ffmpegPathMode'])}>
            <option value="bundled">Integrado con la aplicación</option>
            <option value="system">Instalado en el sistema (PATH)</option>
            <option value="custom">Rutas personalizadas</option>
          </select>
          <small className="setting-help">
            {settings.ffmpegPathMode === 'bundled'
              ? 'Recomendado: usa FFmpeg 8.1.2 incluido. Si falta, se intenta la instalación del sistema.'
              : settings.ffmpegPathMode === 'system'
                ? 'Requiere que FFmpeg y FFprobe estén disponibles en PATH.'
                : 'Usa ejecutables específicos mediante dos rutas absolutas.'}
          </small>
        </label>

        <label>
          Acelerador preferido
          <select value={settings.preferredHardware} onChange={(e: SelectChange) => update('preferredHardware', e.target.value as AppSettings['preferredHardware'])}>
            <option value="auto">Automático</option>
            <option value="nvenc">NVIDIA NVENC</option>
            <option value="qsv">Intel QuickSync</option>
            <option value="amf">AMD AMF</option>
            <option value="cpu">Solo CPU</option>
          </select>
        </label>

        {settings.ffmpegPathMode === 'custom' && (
          <>
            <label>
              Ruta absoluta de FFmpeg
              <input value={settings.customFFmpegPath || ''} onChange={(e) => update('customFFmpegPath', e.target.value)} required />
            </label>
            <label>
              Ruta absoluta de FFprobe
              <input value={settings.customFFprobePath || ''} onChange={(e) => update('customFFprobePath', e.target.value)} required />
            </label>
          </>
        )}

        <label>
          Límite máximo de trabajos simultáneos
          <input type="number" min={1} max={16} value={settings.maxConcurrentJobs}
            onChange={(e) => update('maxConcurrentJobs', Number(e.target.value))} />
          <small className="setting-help">
            {settings.autoConcurrency
              ? `El modo automático puede usar menos recursos, pero nunca superará ${settings.maxConcurrentJobs}.`
              : `La cola podrá ejecutar hasta ${settings.maxConcurrentJobs} trabajo(s) a la vez.`}
          </small>
        </label>

        <label>
          Política de archivos duplicados
          <select value={settings.duplicatePolicy} onChange={(e: SelectChange) => update('duplicatePolicy', e.target.value as AppSettings['duplicatePolicy'])}>
            <option value="suffix">Añadir sufijo numerado</option>
            <option value="skip">Omitir si existe</option>
            <option value="overwrite">Sobrescribir destino</option>
          </select>
        </label>

        <fieldset>
          <legend>Automatización y temporales</legend>
          <label className="check-row"><input type="checkbox" checked={settings.autoConcurrency} onChange={(e) => update('autoConcurrency', e.target.checked)} /> Concurrencia automática</label>
          <label className="check-row"><input type="checkbox" checked={settings.autoStartWatchers} onChange={(e) => update('autoStartWatchers', e.target.checked)} /> Iniciar watchers automáticamente</label>
          <label className="check-row"><input type="checkbox" checked={settings.keepTempFilesOnFailure} onChange={(e) => update('keepTempFilesOnFailure', e.target.checked)} /> Conservar temporales si falla una conversión</label>
          <label className="check-row"><input type="checkbox" checked={settings.desktopNotifications} onChange={(e) => update('desktopNotifications', e.target.checked)} /> Mostrar notificaciones del escritorio al terminar</label>
        </fieldset>

        <div className="settings-actions">
          <span className="muted"><ShieldCheck size={15} /> Los cambios se validan antes de persistirse.</span>
          <button className="btn-primary" type="submit" disabled={isSaving}>
            <Save size={16} /> {isSaving ? 'Guardando…' : 'Guardar ajustes'}
          </button>
        </div>
      </form>
    </div>
  );
};
