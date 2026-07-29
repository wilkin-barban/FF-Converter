import { spawn } from 'child_process';
import os from 'os';
import { HardwareEncoderSupport, SystemCapabilities } from '@ff-converter/shared-types';

export class HardwareInspector {
  constructor(private ffmpegPath: string = 'ffmpeg', private ffprobePath: string = 'ffprobe') {}

  public async detectCapabilities(): Promise<SystemCapabilities> {
    const ffmpegVersion = await this.getFFmpegVersion();
    const availableEncoders = await this.getAvailableFFmpegEncoders();
    
    const candidates: { id: string; name: string; type: HardwareEncoderSupport['type'] }[] = [
      { id: 'h264_nvenc', name: 'NVIDIA NVENC H.264', type: 'nvenc' },
      { id: 'hevc_nvenc', name: 'NVIDIA NVENC HEVC', type: 'nvenc' },
      { id: 'av1_nvenc', name: 'NVIDIA NVENC AV1', type: 'nvenc' },
      { id: 'h264_qsv', name: 'Intel Quick Sync H.264', type: 'qsv' },
      { id: 'hevc_qsv', name: 'Intel Quick Sync HEVC', type: 'qsv' },
      { id: 'av1_qsv', name: 'Intel Quick Sync AV1', type: 'qsv' },
      { id: 'h264_amf', name: 'AMD AMF H.264', type: 'amf' },
      { id: 'hevc_amf', name: 'AMD AMF HEVC', type: 'amf' },
      { id: 'av1_amf', name: 'AMD AMF AV1', type: 'amf' },
      { id: 'h264_vaapi', name: 'VAAPI H.264 (Linux)', type: 'vaapi' },
      { id: 'libx264', name: 'CPU x264 (Software)', type: 'cpu' },
      { id: 'libx265', name: 'CPU x265 (Software)', type: 'cpu' },
    ];

    const hardwareEncoders: HardwareEncoderSupport[] = [];

    for (const item of candidates) {
      if (!availableEncoders.has(item.id)) {
        hardwareEncoders.push({
          id: item.id,
          name: item.name,
          type: item.type,
          available: false,
          tested: false,
          errorDetails: 'Encoder binary not present in FFmpeg build'
        });
        continue;
      }

      if (item.type === 'cpu') {
        hardwareEncoders.push({
          id: item.id,
          name: item.name,
          type: item.type,
          available: true,
          tested: true
        });
        continue;
      }

      const testResult = await this.testEncoder(item.id);
      hardwareEncoders.push({
        id: item.id,
        name: item.name,
        type: item.type,
        available: testResult.success,
        tested: true,
        errorDetails: testResult.error
      });
    }

    return {
      ffmpegPath: this.ffmpegPath,
      ffprobePath: this.ffprobePath,
      ffmpegVersion,
      hardwareEncoders,
      availableCpuCores: os.cpus().length,
      platform: process.platform as 'win32' | 'linux' | 'darwin'
    };
  }

  private async getFFmpegVersion(): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn(this.ffmpegPath, ['-version']);
      let stdout = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.on('close', () => {
        const firstLine = stdout.split('\n')[0] || 'FFmpeg unknown version';
        resolve(firstLine.trim());
      });
      child.on('error', () => resolve('FFmpeg not found'));
    });
  }

  private async getAvailableFFmpegEncoders(): Promise<Set<string>> {
    return new Promise((resolve) => {
      const child = spawn(this.ffmpegPath, ['-encoders']);
      let stdout = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.on('close', () => {
        const set = new Set<string>();
        const lines = stdout.split('\n');
        lines.forEach((line) => {
          const match = line.match(/^\s*V[A-Za-z.]{5}\s+([a-zA-Z0-9_-]+)/);
          if (match) {
            set.add(match[1]);
          }
        });
        resolve(set);
      });
      child.on('error', () => resolve(new Set()));
    });
  }

  private async testEncoder(encoderName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Create a 1-second dummy color test video stream with yuv420p format for GPU hardware testing
      const args = [
        '-f', 'lavfi',
        '-i', 'color=c=black:s=640x360:r=24:d=0.5',
        '-pix_fmt', 'yuv420p',
        '-c:v', encoderName,
        '-f', 'null',
        '-'
      ];

      const child = spawn(this.ffmpegPath, args);
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr.slice(-300) });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }
}
