import { describe, it, expect } from 'vitest';
import { PresetResolver } from '../packages/media-core/src/presets/preset-resolver';
import { Preset, MediaSnapshot, SystemCapabilities } from '../packages/shared-types/src/index';

describe('PresetResolver Unit Tests', () => {
  const dummyCapabilities: SystemCapabilities = {
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    ffmpegVersion: '8.1',
    availableCpuCores: 8,
    platform: 'win32',
    hardwareEncoders: [
      { id: 'h264_nvenc', name: 'NVENC H264', type: 'nvenc', available: true, tested: true },
      { id: 'hevc_nvenc', name: 'NVENC HEVC', type: 'nvenc', available: true, tested: true },
      { id: 'libx264', name: 'CPU x264', type: 'cpu', available: true, tested: true }
    ]
  };

  const dummySnapshot: MediaSnapshot = {
    filePath: 'test.mkv',
    container: 'matroska',
    durationSeconds: 120,
    totalBitrate: 5000000,
    fileSizeBytes: 50000000,
    videoStreams: [
      {
        index: 0,
        codec: 'hevc',
        width: 3840,
        height: 2160,
        framerate: 60,
        pixelFormat: 'yuv420p',
        bitDepth: 8,
        isHdr: false
      }
    ],
    audioStreams: [
      {
        index: 1,
        codec: 'dts',
        channels: 6,
        sampleRate: 48000
      }
    ],
    subtitleStreams: [],
    metadata: {},
    analyzedAt: new Date().toISOString()
  };

  it('should select h264_nvenc when NVENC hardware is available for Smart TV preset', () => {
    const preset: Preset = {
      id: 'system-smarttv-compat',
      name: 'Smart TV',
      description: 'Test',
      category: 'Smart TV',
      isSystem: true,
      targetContainer: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      maxWidth: 1920,
      maxHeight: 1080,
      hardwarePreference: 'auto'
    };

    const resolver = new PresetResolver();
    const plan = resolver.resolve(preset, dummySnapshot, dummyCapabilities);

    expect(plan.container).toBe('mp4');
    expect(plan.video.encoder).toBe('h264_nvenc');
    expect(plan.video.maxWidth).toBe(1920);
    expect(plan.audio.encoder).toBe('aac');
  });

  it('should fallback to libx264 if hardware preference is cpu', () => {
    const preset: Preset = {
      id: 'system-smarttv-compat',
      name: 'Smart TV',
      description: 'Test',
      category: 'Smart TV',
      isSystem: true,
      targetContainer: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      hardwarePreference: 'cpu'
    };

    const resolver = new PresetResolver();
    const plan = resolver.resolve(preset, dummySnapshot, dummyCapabilities);

    expect(plan.video.encoder).toBe('libx264');
  });
});
