import { Preset, MediaSnapshot, SystemCapabilities, AppSettings, EffectiveConversionPlan, EffectiveVideoPlan, EffectiveAudioPlan, EffectiveSubtitlePlan } from '@ff-converter/shared-types';
import { CompatibilityEngine } from '../compatibility/compatibility-engine';

export class PresetResolver {
  private compatibilityEngine = new CompatibilityEngine();

  public resolve(
    preset: Preset,
    snapshot: MediaSnapshot,
    capabilities: SystemCapabilities,
    settings?: AppSettings
  ): EffectiveConversionPlan {
    const decision = this.compatibilityEngine.evaluate(snapshot, preset);
    const prefHardware = settings?.preferredHardware || preset.hardwarePreference || 'auto';

    // Determine Video Encoder
    const effectiveVideoCodec = preset.videoCodec === 'copy'
      ? (decision.videoAction === 'copy'
          ? (decision.selectedVideo?.codec || 'h264')
          : this.safeVideoCodecForContainer(preset.targetContainer))
      : preset.videoCodec;
    const effectiveAudioCodec = preset.audioCodec === 'copy'
      ? (decision.audioAction === 'copy'
          ? (decision.selectedAudio?.codec || 'aac')
          : this.safeAudioCodecForContainer(preset.targetContainer))
      : preset.audioCodec;
    const videoEncoder = decision.videoAction === 'copy'
      ? 'copy'
      : this.selectVideoEncoder(effectiveVideoCodec, prefHardware, capabilities);
    const audioEncoder = decision.audioAction === 'copy' ? 'copy' : this.selectAudioEncoder(effectiveAudioCodec);

    const firstVideo = decision.selectedVideo;
    let targetWidth: number | undefined = undefined;
    let targetHeight: number | undefined = undefined;

    if (firstVideo && decision.videoAction === 'transcode') {
      if (preset.maxWidth && firstVideo.width > preset.maxWidth) {
        targetWidth = preset.maxWidth;
      }
      if (preset.maxHeight && firstVideo.height > preset.maxHeight) {
        targetHeight = preset.maxHeight;
      }
    }

    const videoPlan: EffectiveVideoPlan = {
      action: decision.videoAction,
      encoder: videoEncoder,
      streamIndex: firstVideo?.index,
      qualityMode: videoEncoder.includes('nvenc') ? 'cq' : 'crf',
      quality: preset.videoQuality || 21,
      maxWidth: targetWidth,
      maxHeight: targetHeight,
      framerate: preset.maxFramerate,
      pixelFormat: decision.hdrAction === 'tone-map-sdr'
        ? 'yuv420p'
        : (preset.pixelFormat || firstVideo?.pixelFormat || 'yuv420p'),
      profile: preset.videoProfile,
      level: preset.videoLevel,
      hdrAction: decision.hdrAction,
      customArgs: preset.customFFmpegFlags || []
    };

    const audioPlan: EffectiveAudioPlan = {
      action: decision.audioAction,
      encoder: audioEncoder,
      streamIndex: decision.selectedAudio?.index,
      bitrate: preset.audioBitrate || '192k',
      channels: preset.audioChannels || decision.selectedAudio?.channels || 2,
      normalizeVolume: preset.normalizeAudio,
    };

    const subtitlePlan: EffectiveSubtitlePlan = {
      action: decision.subtitleAction
      ,
      streamIndex: decision.selectedSubtitle?.index,
      streamTypeIndex: decision.selectedSubtitle
        ? snapshot.subtitleStreams.findIndex(stream => stream.index === decision.selectedSubtitle?.index)
        : undefined,
      format: decision.selectedSubtitle?.codec,
      encoder: decision.subtitleEncoder
    };

    return {
      container: preset.targetContainer.toLowerCase(),
      video: videoPlan,
      audio: audioPlan,
      subtitles: subtitlePlan,
      fastStart: preset.fastStart ?? true,
      metadataHandling: preset.preserveMetadata ? 'preserve' : 'strip',
      reasoning: decision.reasoning
    };
  }

  private selectVideoEncoder(
    targetCodec: string,
    pref: string,
    caps: SystemCapabilities
  ): string {
    if (targetCodec === 'none') return 'none';
    if (targetCodec === 'copy') return 'copy';

    const codec = targetCodec.toLowerCase();
    const available = new Set(caps.hardwareEncoders.filter(e => e.available).map(e => e.id));

    if (pref === 'nvenc' || pref === 'auto') {
      if (codec === 'h264' && available.has('h264_nvenc')) return 'h264_nvenc';
      if ((codec === 'h265' || codec === 'hevc') && available.has('hevc_nvenc')) return 'hevc_nvenc';
      if (codec === 'av1' && available.has('av1_nvenc')) return 'av1_nvenc';
    }

    if (pref === 'qsv' || pref === 'auto') {
      if (codec === 'h264' && available.has('h264_qsv')) return 'h264_qsv';
      if ((codec === 'h265' || codec === 'hevc') && available.has('hevc_qsv')) return 'hevc_qsv';
      if (codec === 'av1' && available.has('av1_qsv')) return 'av1_qsv';
    }

    if (pref === 'amf' || pref === 'auto') {
      if (codec === 'h264' && available.has('h264_amf')) return 'h264_amf';
      if ((codec === 'h265' || codec === 'hevc') && available.has('hevc_amf')) return 'hevc_amf';
      if (codec === 'av1' && available.has('av1_amf')) return 'av1_amf';
    }

    if (pref === 'vaapi' || pref === 'auto') {
      if (codec === 'h264' && available.has('h264_vaapi')) return 'h264_vaapi';
      if ((codec === 'h265' || codec === 'hevc') && available.has('hevc_vaapi')) return 'hevc_vaapi';
    }

    // CPU fallbacks
    if (codec === 'h264') return 'libx264';
    if (codec === 'h265' || codec === 'hevc') return 'libx265';
    if (codec === 'av1') return 'libsvtav1';
    if (codec === 'vp9') return 'libvpx-vp9';

    return 'libx264';
  }

  private selectAudioEncoder(targetCodec: string): string {
    if (targetCodec === 'none') return 'none';
    if (targetCodec === 'copy') return 'copy';

    const codec = targetCodec.toLowerCase();
    if (codec === 'aac') return 'aac';
    if (codec === 'mp3') return 'libmp3lame';
    if (codec === 'flac') return 'flac';
    if (codec === 'ac3') return 'ac3';
    if (codec === 'alac') return 'alac';
    if (codec === 'wav') return 'pcm_s16le';
    if (codec === 'opus') return 'libopus';
    if (codec === 'vorbis') return 'libvorbis';

    return 'aac';
  }

  private safeVideoCodecForContainer(container: string): string {
    return container.toLowerCase() === 'webm' ? 'vp9' : 'h264';
  }

  private safeAudioCodecForContainer(container: string): string {
    const normalized = container.toLowerCase();
    if (normalized === 'webm') return 'opus';
    if (normalized === 'wav') return 'wav';
    if (normalized === 'flac') return 'flac';
    if (normalized === 'mp3') return 'mp3';
    return 'aac';
  }
}
