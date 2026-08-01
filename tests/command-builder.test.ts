import { describe, it, expect } from 'vitest';
import { CommandBuilder } from '../packages/media-core/src/command-builder/command-builder';
import { EffectiveConversionPlan } from '../packages/shared-types/src/index';
import { PresetSchema } from '../packages/shared-contracts/src/index';

describe('CommandBuilder Unit Tests', () => {
  it('should build safe arguments array for ffmpeg without shell injection risks', () => {
    const plan: EffectiveConversionPlan = {
      container: 'mp4',
      video: {
        action: 'transcode',
        encoder: 'h264_nvenc',
        quality: 21,
        maxWidth: 1920,
        maxHeight: 1080
      },
      audio: {
        action: 'transcode',
        encoder: 'aac',
        bitrate: '192k',
        channels: 2
      },
      subtitles: {
        action: 'remove'
      },
      fastStart: true,
      metadataHandling: 'preserve'
    };

    const builder = new CommandBuilder();
    const args = builder.buildFFmpegArgs('input file with spaces.mkv', 'output.mp4', plan);

    expect(args).toContain('-progress');
    expect(args).toContain('pipe:1');
    expect(args).toContain('input file with spaces.mkv');
    expect(args).toContain('-c:v');
    expect(args).toContain('h264_nvenc');
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
    expect(args).toContain('-sn');
    expect(args).toContain('-movflags');
    expect(args).toContain('+faststart');
    expect(args[args.length - 1]).toBe('output.mp4');
  });

  it('rejects custom arguments outside the supported safe option pairs', () => {
    const preset = {
      name: 'Unsafe', description: 'Unsafe', category: 'test', targetContainer: 'mp4',
      videoCodec: 'libx264', audioCodec: 'aac'
    };

    for (const customFFmpegFlags of [
      ['extra-output.mp4'],
      ['-benchmark', 'C:\\outside\\victim.mp4'],
      ['-shortest', 'C:\\outside\\victim.mp4'],
      ['-tune:v', 'film'],
      ['-tune=film'],
      ['-hls_segment_filename', 'segment-%03d.ts'],
      ['-unknown-safe-looking-option', 'value'],
      ['film'],
      ['https://example.test/input'],
      ['-tune', 'https://example.test/input'],
      ['-tune', 'film\0']
    ]) {
      expect(PresetSchema.safeParse({ ...preset, customFFmpegFlags }).success).toBe(false);
    }
  });

  it('accepts only the supported safe custom FFmpeg option pairs', () => {
    const preset = {
      name: 'Safe', description: 'Safe', category: 'test', targetContainer: 'mp4',
      videoCodec: 'libx264', audioCodec: 'aac'
    };
    const safePairs = [
      ['-tune', 'film'], ['-tune', 'animation'], ['-tune', 'grain'],
      ['-tune', 'stillimage'], ['-tune', 'psnr'], ['-tune', 'ssim'],
      ['-tune', 'fastdecode'], ['-tune', 'zerolatency'],
      ['-movflags', '+faststart'],
      ['-movflags', '+frag_keyframe'], ['-movflags', '+empty_moov'],
      ['-movflags', '+default_base_moof']
    ];

    for (const customFFmpegFlags of safePairs) {
      expect(PresetSchema.safeParse({ ...preset, customFFmpegFlags }).success).toBe(true);
    }
  });
});
