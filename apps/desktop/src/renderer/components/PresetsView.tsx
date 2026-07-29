import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Sliders, Plus, Check, ShieldCheck, Cpu } from 'lucide-react';
import { Preset } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

export const PresetsView: React.FC = () => {
  const { presets, setPresets, showNotice } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personalizados');
  const [targetContainer, setTargetContainer] = useState('mp4');
  const [videoCodec, setVideoCodec] = useState('h264');
  const [audioCodec, setAudioCodec] = useState('aac');
  const [videoQuality, setVideoQuality] = useState(21);
  const [audioBitrate, setAudioBitrate] = useState('192k');
  const [subtitlePolicy, setSubtitlePolicy] = useState<'preserve-compatible' | 'convert-compatible' | 'remove' | 'burn-in'>('convert-compatible');
  const [hdrPolicy, setHdrPolicy] = useState<'preserve' | 'tone-map-sdr'>('tone-map-sdr');
  const [preferredAudioLanguage, setPreferredAudioLanguage] = useState('');
  const [normalizeAudio, setNormalizeAudio] = useState(false);

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSaving(true);
    try {
    await window.ffConverter.presets.save({
      name,
      description,
      category,
      isSystem: false,
      targetContainer,
      videoCodec,
      audioCodec,
      videoQuality,
      audioBitrate,
      hardwarePreference: 'auto',
      fastStart: true,
      preserveMetadata: true,
      preserveSubtitles: subtitlePolicy !== 'remove',
      subtitlePolicy,
      hdrPolicy,
      preferredAudioLanguage: preferredAudioLanguage || undefined,
      normalizeAudio
    });

    const updated = await window.ffConverter.presets.list();
    setPresets(updated);
    setShowAdd(false);
    setName('');
    setDescription('');
    showNotice({ kind: 'success', message: 'Perfil personalizado guardado.' });
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible guardar el perfil: ${getErrorMessage(error)}` });
    } finally { setIsSaving(false); }
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Catálogo de Perfiles</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Perfiles preconfigurados para televisores, dispositivos, redes sociales y bibliotecas de audio.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={16} /> Crear Perfil Personalizado
        </button>
      </header>

      {/* Add Custom Preset Form */}
      {showAdd && (
        <form onSubmit={handleSavePreset} className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>Nuevo Perfil Personalizado</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contenedor</label>
              <select value={targetContainer} onChange={(e) => setTargetContainer(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}>
                <option value="mp4">MP4</option>
                <option value="mkv">MKV</option>
                <option value="webm">WebM</option>
                <option value="mp3">MP3 (Audio)</option>
                <option value="flac">FLAC (Audio)</option>
                <option value="m4a">M4A (Apple Music)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Política HDR</label>
              <select value={hdrPolicy} onChange={(e) => setHdrPolicy(e.target.value as Preset['hdrPolicy'] & ('preserve' | 'tone-map-sdr'))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}>
                <option value="preserve">Preservar HDR</option>
                <option value="tone-map-sdr">Convertir a SDR</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Subtítulos</label>
              <select value={subtitlePolicy} onChange={(e) => setSubtitlePolicy(e.target.value as NonNullable<Preset['subtitlePolicy']>)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}>
                <option value="preserve-compatible">Preservar compatibles</option>
                <option value="convert-compatible">Convertir compatibles</option>
                <option value="burn-in">Incrustar</option>
                <option value="remove">Eliminar</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Idioma de audio preferido</label>
              <input value={preferredAudioLanguage} onChange={(e) => setPreferredAudioLanguage(e.target.value)} placeholder="spa, eng..." style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <input type="checkbox" checked={normalizeAudio} onChange={(e) => setNormalizeAudio(e.target.checked)} />
              Normalizar volumen
            </label>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Descripción</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Video Codec</label>
              <select value={videoCodec} onChange={(e) => setVideoCodec(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}>
                <option value="h264">H.264</option>
                <option value="h265">H.265 / HEVC</option>
                <option value="av1">AV1</option>
                <option value="copy">Direct Copy</option>
                <option value="none">None (Audio only)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Calidad (CRF)</label>
              <input type="number" value={videoQuality} onChange={(e) => setVideoQuality(Number(e.target.value))} min={14} max={35} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Audio Codec</label>
              <select value={audioCodec} onChange={(e) => setAudioCodec(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }}>
                <option value="aac">AAC</option>
                <option value="ac3">AC3</option>
                <option value="mp3">MP3</option>
                <option value="flac">FLAC</option>
                <option value="copy">Direct Copy</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bitrate Audio</label>
              <input type="text" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(9, 13, 22, 0.9)', border: '1px solid var(--border-color)', color: '#fff' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar Perfil'}</button>
          </div>
        </form>
      )}

      {/* Grid of Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {presets.map((p) => (
          <div key={p.id} className="glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-purple">{p.category}</span>
                {p.isSystem && <span className="badge badge-blue">Sistema</span>}
              </div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff' }}>{p.name}</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>{p.description}</p>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge badge-cyan">{p.targetContainer.toUpperCase()}</span>
              <span className="badge badge-amber">V: {p.videoCodec.toUpperCase()}</span>
              <span className="badge badge-green">A: {p.audioCodec.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
