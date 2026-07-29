import { describe, it, expect } from 'vitest';
import { CommandBuilder } from '../packages/media-core/src/command-builder/command-builder';
import { EffectiveConversionPlan } from '../packages/shared-types/src/index';

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
});
