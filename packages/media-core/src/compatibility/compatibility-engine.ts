import {
  AudioStreamInfo,
  CodecAction,
  MediaSnapshot,
  Preset,
  SubtitleStreamInfo,
  VideoStreamInfo
} from '@ff-converter/shared-types';

export interface CompatibilityDecision {
  videoAction: CodecAction;
  audioAction: CodecAction;
  subtitleAction: CodecAction;
  selectedVideo?: VideoStreamInfo;
  selectedAudio?: AudioStreamInfo;
  selectedSubtitle?: SubtitleStreamInfo;
  subtitleEncoder?: string;
  hdrAction: 'preserve' | 'tone-map-sdr';
  reasoning: string[];
}

const VIDEO_CODECS: Record<string, Set<string>> = {
  mp4: new Set(['h264', 'hevc', 'av1', 'mpeg4']),
  mov: new Set(['h264', 'hevc', 'mpeg4', 'prores']),
  mkv: new Set(['h264', 'hevc', 'av1', 'vp9', 'mpeg4', 'mpeg2video']),
  webm: new Set(['vp8', 'vp9', 'av1'])
};

const AUDIO_CODECS: Record<string, Set<string>> = {
  mp4: new Set(['aac', 'ac3', 'eac3', 'mp3', 'alac']),
  mov: new Set(['aac', 'ac3', 'alac', 'pcm_s16le']),
  mkv: new Set(['aac', 'ac3', 'eac3', 'dts', 'truehd', 'flac', 'opus', 'vorbis', 'mp3']),
  webm: new Set(['opus', 'vorbis']),
  m4a: new Set(['aac', 'alac']),
  mp3: new Set(['mp3']),
  flac: new Set(['flac']),
  wav: new Set(['pcm_s16le', 'pcm_s24le', 'pcm_s32le'])
};

export class CompatibilityEngine {
  public evaluate(snapshot: MediaSnapshot, preset: Preset): CompatibilityDecision {
    const reasoning: string[] = [];
    const container = this.normalizeContainer(preset.targetContainer);
    const selectedVideo = snapshot.videoStreams[0];
    const selectedAudio = this.selectAudio(snapshot, preset);
    const selectedSubtitle = snapshot.subtitleStreams.find(stream => stream.isForced) ||
      snapshot.subtitleStreams.find(stream => stream.isDefault) ||
      snapshot.subtitleStreams[0];
    const audioOnly = ['mp3', 'flac', 'm4a', 'wav'].includes(container);
    const hdrAction = selectedVideo?.isHdr && preset.hdrPolicy === 'tone-map-sdr'
      ? 'tone-map-sdr'
      : 'preserve';

    let videoAction: CodecAction;
    if (audioOnly || !selectedVideo || preset.videoCodec === 'none') {
      videoAction = 'remove';
      reasoning.push(audioOnly ? `El contenedor ${container} es solo audio.` : 'No hay un stream de vídeo utilizable.');
    } else {
      const sourceCodec = this.normalizeCodec(selectedVideo.codec);
      const targetCodec = preset.videoCodec === 'copy' ? sourceCodec : this.normalizeCodec(preset.videoCodec);
      const codecMatches = sourceCodec === targetCodec;
      const containerSupportsCodec = this.supportsVideo(container, sourceCodec);
      const dimensionsFit = (!preset.maxWidth || selectedVideo.width <= preset.maxWidth) &&
        (!preset.maxHeight || selectedVideo.height <= preset.maxHeight);
      const framerateFits = !preset.maxFramerate || selectedVideo.framerate <= preset.maxFramerate;
      const bitDepthFits = !preset.maxBitDepth || selectedVideo.bitDepth <= preset.maxBitDepth;
      const pixelFormatFits = !preset.pixelFormat || selectedVideo.pixelFormat === preset.pixelFormat;

      if (
        codecMatches &&
        containerSupportsCodec &&
        dimensionsFit &&
        framerateFits &&
        bitDepthFits &&
        pixelFormatFits &&
        hdrAction === 'preserve'
      ) {
        videoAction = 'copy';
        reasoning.push(`Vídeo ${sourceCodec} compatible: se copiará sin pérdida.`);
      } else {
        videoAction = 'transcode';
        const causes = [
          !codecMatches && `codec ${sourceCodec} → ${targetCodec}`,
          !containerSupportsCodec && `${sourceCodec} no compatible con ${container}`,
          !dimensionsFit && 'resolución fuera del límite',
          !framerateFits && 'framerate fuera del límite',
          !bitDepthFits && 'profundidad de bits fuera del límite',
          !pixelFormatFits && 'pixel format incompatible',
          hdrAction === 'tone-map-sdr' && 'conversión HDR → SDR'
        ].filter(Boolean);
        reasoning.push(`El vídeo se recodificará: ${causes.join(', ')}.`);
      }
    }

    let audioAction: CodecAction;
    if (!selectedAudio || preset.audioCodec === 'none') {
      audioAction = 'remove';
      reasoning.push('No hay un stream de audio seleccionado.');
    } else {
      const sourceCodec = this.normalizeCodec(selectedAudio.codec);
      const targetCodec = preset.audioCodec === 'copy' ? sourceCodec : this.normalizeCodec(preset.audioCodec);
      const copyCompatible = sourceCodec === targetCodec && this.supportsAudio(container, sourceCodec);
      if (copyCompatible && !preset.normalizeAudio && (!preset.audioChannels || selectedAudio.channels <= preset.audioChannels)) {
        audioAction = 'copy';
        reasoning.push(`Audio ${sourceCodec} compatible: stream ${selectedAudio.index} se copiará.`);
      } else {
        audioAction = 'transcode';
        reasoning.push(`Audio stream ${selectedAudio.index} se convertirá a ${targetCodec}.`);
      }
    }

    const subtitleDecision = this.evaluateSubtitles(container, selectedSubtitle, preset);
    reasoning.push(...subtitleDecision.reasoning);
    if (subtitleDecision.action === 'burn-in' && videoAction === 'copy') {
      videoAction = 'transcode';
      reasoning.push('La incrustación de subtítulos requiere recodificar el vídeo.');
    }

    return {
      videoAction,
      audioAction,
      subtitleAction: subtitleDecision.action,
      selectedVideo,
      selectedAudio,
      selectedSubtitle,
      subtitleEncoder: subtitleDecision.encoder,
      hdrAction,
      reasoning
    };
  }

  private selectAudio(snapshot: MediaSnapshot, preset: Preset): AudioStreamInfo | undefined {
    if (preset.audioStreamIndex !== undefined) {
      const explicit = snapshot.audioStreams.find(stream => stream.index === preset.audioStreamIndex);
      if (explicit) return explicit;
    }
    if (preset.preferredAudioLanguage) {
      const language = preset.preferredAudioLanguage.toLowerCase();
      const preferred = snapshot.audioStreams.find(stream => stream.language?.toLowerCase() === language);
      if (preferred) return preferred;
    }
    return snapshot.audioStreams.find(stream => stream.isDefault) || snapshot.audioStreams[0];
  }

  private evaluateSubtitles(
    container: string,
    subtitle: SubtitleStreamInfo | undefined,
    preset: Preset
  ): { action: CodecAction; encoder?: string; reasoning: string[] } {
    const policy = preset.subtitlePolicy ?? (preset.preserveSubtitles ? 'preserve-compatible' : 'remove');
    if (!subtitle || policy === 'remove' || ['mp3', 'flac', 'm4a', 'wav'].includes(container)) {
      return { action: 'remove', reasoning: ['Los subtítulos se eliminarán.'] };
    }
    if (policy === 'burn-in') {
      if (subtitle.type === 'bitmap') {
        return {
          action: 'remove',
          reasoning: [`El subtítulo bitmap ${subtitle.codec} no puede incrustarse de forma segura con el filtro de texto y se eliminará.`]
        };
      }
      return { action: 'burn-in', reasoning: [`El subtítulo ${subtitle.codec} se incrustará en el vídeo.`] };
    }

    const codec = this.normalizeCodec(subtitle.codec);
    const canCopy = container === 'mkv' ||
      (container === 'mp4' && ['mov_text', 'tx3g'].includes(codec)) ||
      (container === 'webm' && codec === 'webvtt');
    if (canCopy) {
      return { action: 'copy', reasoning: [`Subtítulo ${codec} compatible: se copiará.`] };
    }
    if (policy === 'convert-compatible' && subtitle.type !== 'bitmap') {
      const encoder = container === 'mp4' ? 'mov_text' : container === 'webm' ? 'webvtt' : 'srt';
      return { action: 'transcode', encoder, reasoning: [`Subtítulo ${codec} se convertirá a ${encoder}.`] };
    }
    return { action: 'remove', reasoning: [`Subtítulo ${codec} incompatible con ${container}: se eliminará.`] };
  }

  private supportsVideo(container: string, codec: string): boolean {
    return VIDEO_CODECS[container]?.has(codec) ?? false;
  }

  private supportsAudio(container: string, codec: string): boolean {
    return AUDIO_CODECS[container]?.has(codec) ?? false;
  }

  private normalizeContainer(container: string): string {
    const normalized = container.toLowerCase();
    if (normalized === 'matroska') return 'mkv';
    return normalized;
  }

  private normalizeCodec(codec: string): string {
    const normalized = codec.toLowerCase();
    if (['h265', 'x265'].includes(normalized)) return 'hevc';
    if (normalized === 'h.264') return 'h264';
    if (normalized === 'subrip') return 'srt';
    return normalized;
  }
}
