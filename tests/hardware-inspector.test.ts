import { describe, it, expect, vi } from 'vitest';
import { HardwareInspector } from '../packages/media-core/src/hardware/hardware-inspector';

describe('HardwareInspector Unit Tests', () => {
  it('maps detected FFmpeg encoders into stable system capabilities', async () => {
    const inspector = new HardwareInspector('ffmpeg-test', 'ffprobe-test');
    vi.spyOn(inspector as any, 'getFFmpegVersion').mockResolvedValue('ffmpeg version test');
    vi.spyOn(inspector as any, 'getAvailableFFmpegEncoders').mockResolvedValue(new Set(['libx264']));

    const caps = await inspector.detectCapabilities();

    expect(caps.ffmpegVersion).toBe('ffmpeg version test');
    expect(caps.availableCpuCores).toBeGreaterThan(0);
    expect(caps.ffmpegPath).toBe('ffmpeg-test');

    expect(caps.hardwareEncoders.find((encoder) => encoder.id === 'libx264')).toMatchObject({
      available: true,
      tested: true,
      type: 'cpu'
    });
    expect(caps.hardwareEncoders.find((encoder) => encoder.id === 'h264_nvenc')).toMatchObject({
      available: false,
      tested: false
    });
  });
});
