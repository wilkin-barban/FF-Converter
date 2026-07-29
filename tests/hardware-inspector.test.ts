import { describe, it, expect } from 'vitest';
import { HardwareInspector } from '../packages/media-core/src/hardware/hardware-inspector';

describe('HardwareInspector Unit Tests', () => {
  it('should detect system capabilities and test available hardware encoders', async () => {
    const inspector = new HardwareInspector('ffmpeg', 'ffprobe');
    const caps = await inspector.detectCapabilities();

    expect(caps.ffmpegVersion).toBeDefined();
    expect(caps.availableCpuCores).toBeGreaterThan(0);
    expect(caps.hardwareEncoders.length).toBeGreaterThan(0);

    const cpuEncoder = caps.hardwareEncoders.find(e => e.id === 'libx264');
    expect(cpuEncoder).toBeDefined();
    expect(cpuEncoder?.available).toBe(true);
  });
});
