import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { UploadCloud, Folder, FileVideo, CheckCircle2, Play, Trash2, ShieldCheck } from 'lucide-react';
import { EffectiveConversionPlan } from '@ff-converter/shared-types';
import { getErrorMessage } from '../utils/errors';

export const ConvertView: React.FC = () => {
  const {
    selectedFilePaths,
    setSelectedFilePaths,
    inspections,
    setInspections,
    selectedPresetId,
    setSelectedPresetId,
    outputFolder,
    setOutputFolder,
    isInspecting,
    setIsInspecting,
    presets,
    setActiveTab,
    showNotice
  } = useAppStore();

  const [isHovered, setIsHovered] = useState(false);
  const [planPreviews, setPlanPreviews] = useState<Array<{ filePath: string; plan: EffectiveConversionPlan }>>([]);

  useEffect(() => {
    let cancelled = false;
    const inspectedPaths = inspections.map(snapshot => snapshot.filePath);
    if (inspectedPaths.length === 0) {
      setPlanPreviews([]);
      return;
    }
    window.ffConverter.media.resolvePlans(inspectedPaths, selectedPresetId)
      .then((plans: Array<{ filePath: string; plan: EffectiveConversionPlan }>) => {
        if (!cancelled) setPlanPreviews(plans);
      })
      .catch((error: unknown) => {
        if (!cancelled) setPlanPreviews([]);
        showNotice({ kind: 'error', message: `No fue posible calcular el plan: ${getErrorMessage(error)}` });
      });
    return () => { cancelled = true; };
  }, [selectedFilePaths, inspections, selectedPresetId]);

  const handleSelectFiles = async () => {
    if (!window.ffConverter) return;
    try {
    const files = await window.ffConverter.media.selectFiles();
    if (files && files.length > 0) {
      const expanded = await window.ffConverter.media.expandPaths(files);
      if (expanded && expanded.length > 0) {
        addFiles(expanded);
      }
    }
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  const addFiles = async (paths: string[]) => {
    const updated = Array.from(new Set([...selectedFilePaths, ...paths]));
    setSelectedFilePaths(updated);

    if (!outputFolder && paths.length > 0) {
      // Default to parent folder of first file
      const firstPath = paths[0];
      const folder = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));
      setOutputFolder(folder);
    }

    setIsInspecting(true);
    try {
      const results = await window.ffConverter.media.inspect(updated);
      setInspections(results);
      const rejected = updated.length - results.length;
      if (rejected > 0) {
        showNotice({ kind: 'info', message: `${results.length} archivo(s) válidos; ${rejected} no pudieron analizarse y no se convertirán.` });
      }
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible analizar los archivos: ${getErrorMessage(error)}` });
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSelectFolderForInput = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.ffConverter) return;
    const folder = await window.ffConverter.media.selectFolder();
    if (folder) {
      const expanded = await window.ffConverter.media.expandPaths([folder]);
      if (expanded && expanded.length > 0) {
        addFiles(expanded);
      }
    }
  };

  const handleSelectFolder = async () => {
    const folder = await window.ffConverter.media.selectFolder();
    if (folder) setOutputFolder(folder);
  };

  const handleStartConversion = async () => {
    const eligiblePaths = inspections.map(snapshot => snapshot.filePath);
    if (eligiblePaths.length === 0 || !outputFolder) {
      showNotice({ kind: 'info', message: 'No hay archivos analizados listos para convertir.' });
      return;
    }

    try {
    await window.ffConverter.jobs.create({
      inputPaths: eligiblePaths,
      outputFolder,
      presetId: selectedPresetId
    });

    // Clear selection and switch to queue tab
    setSelectedFilePaths([]);
    setInspections([]);
    setActiveTab('queue');
    } catch (error: unknown) {
      showNotice({ kind: 'error', message: `No fue posible iniciar la conversión: ${getErrorMessage(error)}` });
    }
  };

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Convertir Medios</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Arrastrá archivos multimedia o carpetas completas, seleccioná un perfil optimizado y comenzá el procesamiento por lotes.
        </p>
      </header>

      {/* Dropzone */}
      <div
        onClick={handleSelectFiles}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setIsHovered(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setIsHovered(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsHovered(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsHovered(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const rawFiles = Array.from(e.dataTransfer.files);
            const rawPaths: string[] = [];
            for (const file of rawFiles) {
              let p = '';
              try {
                if (window.ffConverter?.getPathForFile) {
                  p = await window.ffConverter.getPathForFile(file);
                }
              } catch (_) {}
              if (p) rawPaths.push(p);
            }
            if (rawPaths.length > 0) {
              const expanded = await window.ffConverter.media.expandPaths(rawPaths);
              if (expanded && expanded.length > 0) {
                await addFiles(expanded);
                showNotice({ kind: 'success', message: `${expanded.length} archivo(s) encontrados. Revisa el plan y pulsa Convertir.` });
              } else {
                showNotice({ kind: 'info', message: 'La carpeta no contiene formatos multimedia compatibles.' });
              }
            }
          }
        }}
        style={{
          border: isHovered ? '2px dashed var(--accent-blue)' : '2px dashed var(--border-color)',
          background: isHovered ? 'rgba(59, 130, 246, 0.08)' : 'rgba(18, 26, 44, 0.4)',
          borderRadius: '16px',
          padding: '32px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}
      >
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-blue)'
        }}>
          <UploadCloud size={28} />
        </div>
        <div>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
            Hacé clic o arrastrá tus archivos o carpetas de video aquí
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '4px' }}>
            Soporta MP4, MKV, AVI, MOV, FLAC, MP3, WAV, etc.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button type="button" className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleSelectFiles(); }}>
            <FileVideo size={15} /> Seleccionar Archivos
          </button>
          <button type="button" className="btn-secondary" onClick={handleSelectFolderForInput}>
            <Folder size={15} /> Seleccionar Carpeta Completa
          </button>
        </div>
      </div>

      {/* Inspected Files List */}
      {selectedFilePaths.length > 0 && (
        <div className="glass" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
              Archivos Seleccionados ({selectedFilePaths.length})
            </span>
            {isInspecting && <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Analizando mediante FFprobe...</span>}
            <button
              onClick={() => { setSelectedFilePaths([]); setInspections([]); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            >
              <Trash2 size={14} /> Limpiar lista
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {selectedFilePaths.map((fp) => {
              const snap = inspections.find((i) => i.filePath === fp);
              const filename = fp.substring(Math.max(fp.lastIndexOf('\\'), fp.lastIndexOf('/')) + 1);
              const video = snap?.videoStreams[0];
              const audio = snap?.audioStreams[0];

              return (
                <div key={fp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileVideo size={18} color="var(--accent-cyan)" />
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{filename}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{fp}</div>
                    </div>
                  </div>

                  {snap ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {video && <span className="badge badge-blue">{video.codec.toUpperCase()} {video.width}x{video.height}</span>}
                      {video?.isHdr && <span className="badge badge-purple">HDR10</span>}
                      {audio && <span className="badge badge-amber">{audio.codec.toUpperCase()}</span>}
                      <span className="badge badge-green">{Math.round(snap.durationSeconds)}s</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Pendiente de análisis</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preset & Output Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Preset Selector */}
        <div className="glass" style={{ padding: '16px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '8px' }}>
            Perfil de Conversión
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(9, 13, 22, 0.9)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              outline: 'none',
              fontSize: '0.9rem'
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.name}
              </option>
            ))}
          </select>
          {selectedPreset && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
              {selectedPreset.description}
            </p>
          )}
        </div>

        {/* Target Folder Selector */}
        <div className="glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '8px' }}>
              Carpeta de Destino
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="Seleccionar carpeta de destino..."
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(9, 13, 22, 0.9)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button className="btn-secondary" onClick={handleSelectFolder}>
                <Folder size={16} /> Explorar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--accent-green)', marginTop: '12px' }}>
            <ShieldCheck size={14} /> Escritura temporal atómica con validación FFprobe previa
          </div>
        </div>
      </div>

      {planPreviews.length > 0 && (
        <div className="glass" style={{ padding: '16px' }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Plan efectivo antes de encolar</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className="badge badge-blue">Vídeo: {planPreviews[0].plan.video.action} / {planPreviews[0].plan.video.encoder}</span>
            <span className="badge badge-amber">Audio: {planPreviews[0].plan.audio.action} / {planPreviews[0].plan.audio.encoder}</span>
            <span className="badge badge-purple">Subtítulos: {planPreviews[0].plan.subtitles.action}</span>
            {planPreviews[0].plan.video.hdrAction === 'tone-map-sdr' && <span className="badge badge-red">HDR → SDR</span>}
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>
            {(planPreviews[0].plan.reasoning || []).map((reason, index) => <li key={index}>{reason}</li>)}
          </ul>
          {planPreviews.length > 1 && (
            <div style={{ marginTop: '8px', color: 'var(--text-sub)', fontSize: '0.72rem' }}>
              Vista del primer archivo; se resolverá un plan independiente para cada uno de los {planPreviews.length} archivos.
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
        <button
          className="btn-primary"
          onClick={handleStartConversion}
          disabled={selectedFilePaths.length === 0 || !outputFolder}
          style={{
            opacity: selectedFilePaths.length === 0 || !outputFolder ? 0.5 : 1,
            cursor: selectedFilePaths.length === 0 || !outputFolder ? 'not-allowed' : 'pointer'
          }}
        >
          <Play size={18} /> Añadir e Iniciar Conversión ({selectedFilePaths.length})
        </button>
      </div>
    </div>
  );
};
