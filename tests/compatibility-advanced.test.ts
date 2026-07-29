import { describe, expect, it } from 'vitest';
import { CommandBuilder, CompatibilityEngine, PresetResolver } from '../packages/media-core/src';
import { MediaSnapshot, Preset, SystemCapabilities } from '../packages/shared-types/src';

const capabilities: SystemCapabilities = {
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  ffmpegVersion: '8.1',
  availableCpuCores: 8,
  platform: 'win32',
  hardwareEncoders: [
    { id: 'h264_nvenc', name: 'NVENC H264', type: 'nvenc', available: true, tested: true },
    { id: 'hevc_nvenc', name: 'NVENC HEVC', type: 'nvenc', available: true, tested: true },
    { id: 'av1_nvenc', name: 'NVENC AV1', type: 'nvenc', available: true, tested: true }
  ]
};

function mediaSnapshot(overrides: Partial<MediaSnapshot> = {}): MediaSnapshot {
  return {
    filePath: 'C:\\media\\movie.mkv',
    container: 'matroska',
    durationSeconds: 120,
    totalBitrate: 5_000_000,
    fileSizeBytes: 50_000_000,
    videoStreams: [{
      index: 0,
      codec: 'h264',
      width: 1920,
      height: 1080,
      framerate: 30,
      pixelFormat: 'yuv420p',
      bitDepth: 8,
      isHdr: false
    }],
    audioStreams: [
      { index: 1, codec: 'dts', channels: 6, sampleRate: 48000, language: 'eng', isDefault: true },
      { index: 2, codec: 'aac', channels: 2, sampleRate: 48000, language: 'spa' }
    ],
    subtitleStreams: [
      { index: 3, codec: 'subrip', language: 'spa', type: 'text' }
    ],
    metadata: {},
    analyzedAt: new Date().toISOString(),
    ...overrides
  };
}

function preset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: 'test-preset',
    name: 'Test',
    description: '',
    category: 'Test',
    isSystem: false,
    targetContainer: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    hardwarePreference: 'auto',
    preserveSubtitles: true,
    subtitlePolicy: 'convert-compatible',
    ...overrides
  };
}

describe('advanced compatibility', () => {
  it('evaluates video, audio and subtitles independently for MP4', () => {
    const decision = new CompatibilityEngine().evaluate(mediaSnapshot(), preset());

    expect(decision.videoAction).toBe('copy');
    expect(decision.audioAction).toBe('transcode');
    expect(decision.subtitleAction).toBe('transcode');
    expect(decision.subtitleEncoder).toBe('mov_text');
  });

  it('selects audio by preferred language or explicit stream index', () => {
    const engine = new CompatibilityEngine();
    const byLanguage = engine.evaluate(mediaSnapshot(), preset({ preferredAudioLanguage: 'spa' }));
    const byIndex = engine.evaluate(mediaSnapshot(), preset({ audioStreamIndex: 2 }));

    expect(byLanguage.selectedAudio?.index).toBe(2);
    expect(byLanguage.audioAction).toBe('copy');
    expect(byIndex.selectedAudio?.language).toBe('spa');
  });

  it('removes incompatible bitmap subtitles instead of copying them to MP4', () => {
    const snapshot = mediaSnapshot({
      subtitleStreams: [{ index: 3, codec: 'hdmv_pgs_subtitle', type: 'bitmap' }]
    });
    const decision = new CompatibilityEngine().evaluate(snapshot, preset());

    expect(decision.subtitleAction).toBe('remove');
  });

  it('forces transcoding and tone mapping for HDR to SDR', () => {
    const snapshot = mediaSnapshot({
      videoStreams: [{
        index: 0,
        codec: 'hevc',
        width: 3840,
        height: 2160,
        framerate: 60,
        pixelFormat: 'yuv420p10le',
        bitDepth: 10,
        isHdr: true
      }]
    });
    const plan = new PresetResolver().resolve(
      preset({
        videoCodec: 'h265',
        hdrPolicy: 'tone-map-sdr',
        maxWidth: 1920,
        maxHeight: 1080,
        pixelFormat: 'yuv420p'
      }),
      snapshot,
      capabilities
    );
    const args = new CommandBuilder().buildFFmpegArgs(snapshot.filePath, 'output.mp4', plan);
    const filter = args[args.indexOf('-vf') + 1];

    expect(plan.video.action).toBe('transcode');
    expect(plan.video.hdrAction).toBe('tone-map-sdr');
    expect(filter).toContain('tonemap=tonemap=hable');
    expect(filter).toContain('scale=');
  });

  it('maps selected streams and converts subtitle codec', () => {
    const snapshot = mediaSnapshot();
    const plan = new PresetResolver().resolve(preset({ preferredAudioLanguage: 'spa' }), snapshot, capabilities);
    const args = new CommandBuilder().buildFFmpegArgs(snapshot.filePath, 'output.mp4', plan);

    expect(args).toContain('0:0');
    expect(args).toContain('0:2');
    expect(args).toContain('0:3');
    expect(args).toContain('mov_text');
  });

  it('forces video transcoding when subtitles are burned in', () => {
    const snapshot = mediaSnapshot();
    const plan = new PresetResolver().resolve(preset({ subtitlePolicy: 'burn-in' }), snapshot, capabilities);
    const args = new CommandBuilder().buildFFmpegArgs(snapshot.filePath, 'output.mp4', plan);
    const filter = args[args.indexOf('-vf') + 1];

    expect(plan.video.action).toBe('transcode');
    expect(plan.subtitles.action).toBe('burn-in');
    expect(filter).toContain('subtitles=');
    expect(args).toContain('-sn');
  });

  it('builds audio-only extraction with normalization and selected language', () => {
    const snapshot = mediaSnapshot();
    const plan = new PresetResolver().resolve(
      preset({
        targetContainer: 'm4a',
        videoCodec: 'none',
        audioCodec: 'aac',
        preferredAudioLanguage: 'spa',
        normalizeAudio: true
      }),
      snapshot,
      capabilities
    );
    const args = new CommandBuilder().buildFFmpegArgs(snapshot.filePath, 'output.m4a', plan);

    expect(plan.video.action).toBe('remove');
    expect(plan.audio.streamIndex).toBe(2);
    expect(args).toContain('-vn');
    expect(args).toContain('loudnorm');
  });

  it('preserves broad subtitle compatibility in MKV', () => {
    const decision = new CompatibilityEngine().evaluate(
      mediaSnapshot(),
      preset({ targetContainer: 'mkv', subtitlePolicy: 'preserve-compatible' })
    );
    expect(decision.subtitleAction).toBe('copy');
  });

  it('uses safe codecs when copy is incompatible with WebM', () => {
    const plan = new PresetResolver().resolve(
      preset({
        targetContainer: 'webm',
        videoCodec: 'copy',
        audioCodec: 'copy',
        subtitlePolicy: 'remove'
      }),
      mediaSnapshot(),
      capabilities
    );

    expect(plan.video.action).toBe('transcode');
    expect(plan.video.encoder).toBe('libvpx-vp9');
    expect(plan.audio.action).toBe('transcode');
    expect(plan.audio.encoder).toBe('libopus');
  });
});
