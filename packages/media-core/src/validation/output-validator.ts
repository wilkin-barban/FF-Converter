import fs from 'fs/promises';
import { MediaInspector } from '../inspection/inspector';
import { EffectiveConversionPlan, MediaSnapshot } from '@ff-converter/shared-types';

export interface OutputValidationOptions {
  expectedDurationSeconds: number;
  sourceSnapshot: MediaSnapshot;
  plan: EffectiveConversionPlan;
  overwriteExisting: boolean;
}

export class OutputValidator {
  constructor(private inspector: MediaInspector) {}

  public async validateAndFinalize(
    tempPath: string,
    finalPath: string,
    options: OutputValidationOptions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Check file exists and has size > 0
      const stat = await fs.stat(tempPath);
      if (stat.size === 0) {
        return { success: false, error: 'Output file is 0 bytes' };
      }

      // 2. Inspect with ffprobe
      const snapshot = await this.inspector.inspect(tempPath);
      if (snapshot.durationSeconds <= 0 && options.expectedDurationSeconds > 1) {
        return { success: false, error: 'Output file duration is 0 seconds' };
      }

      const durationTolerance = Math.max(2, options.expectedDurationSeconds * 0.03);
      if (
        options.expectedDurationSeconds > 1 &&
        Math.abs(snapshot.durationSeconds - options.expectedDurationSeconds) > durationTolerance
      ) {
        return {
          success: false,
          error: `Output duration ${snapshot.durationSeconds}s differs from expected ${options.expectedDurationSeconds}s`
        };
      }

      if (options.plan.video.action !== 'remove' && snapshot.videoStreams.length === 0) {
        return { success: false, error: 'Expected video stream is missing from output' };
      }
      if (options.plan.audio.action !== 'remove' && options.sourceSnapshot.audioStreams.length > 0 && snapshot.audioStreams.length === 0) {
        return { success: false, error: 'Expected audio stream is missing from output' };
      }

      const outputVideo = snapshot.videoStreams[0];
      if (outputVideo && options.plan.video.maxWidth && outputVideo.width > options.plan.video.maxWidth) {
        return { success: false, error: `Output width ${outputVideo.width} exceeds ${options.plan.video.maxWidth}` };
      }
      if (outputVideo && options.plan.video.maxHeight && outputVideo.height > options.plan.video.maxHeight) {
        return { success: false, error: `Output height ${outputVideo.height} exceeds ${options.plan.video.maxHeight}` };
      }

      if (options.plan.video.action === 'transcode' && outputVideo) {
        const expectedCodec = this.videoCodecForEncoder(options.plan.video.encoder);
        if (expectedCodec && outputVideo.codec !== expectedCodec) {
          return { success: false, error: `Output video codec ${outputVideo.codec} does not match ${expectedCodec}` };
        }
      }
      if (options.plan.audio.action === 'transcode' && snapshot.audioStreams[0]) {
        const expectedCodec = this.audioCodecForEncoder(options.plan.audio.encoder);
        if (expectedCodec && snapshot.audioStreams[0].codec !== expectedCodec) {
          return { success: false, error: `Output audio codec ${snapshot.audioStreams[0].codec} does not match ${expectedCodec}` };
        }
      }

      await this.finalizeSafely(tempPath, finalPath, options.overwriteExisting);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Output validation failed: ${err.message}` };
    }
  }

  private async finalizeSafely(tempPath: string, finalPath: string, overwriteExisting: boolean): Promise<void> {
    const finalExists = await this.exists(finalPath);
    if (finalExists && !overwriteExisting) {
      throw new Error('Destination appeared during conversion and overwrite is disabled');
    }
    if (!finalExists) {
      await fs.rename(tempPath, finalPath);
      return;
    }

    const backupPath = `${finalPath}.ffconverter.backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await fs.rename(finalPath, backupPath);
    try {
      await fs.rename(tempPath, finalPath);
    } catch (error) {
      try {
        if (await this.exists(finalPath)) await fs.unlink(finalPath);
        await fs.rename(backupPath, finalPath);
      } catch {
        // Preserve the original error; the backup remains recoverable if restoration also fails.
      }
      throw error;
    }
    try {
      await fs.unlink(backupPath);
    } catch {
      // The validated output is already final. A leftover backup is safer than rolling it back.
    }
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  private videoCodecForEncoder(encoder: string): string | null {
    const normalized = encoder.toLowerCase();
    if (normalized.includes('264')) return 'h264';
    if (normalized.includes('265') || normalized.includes('hevc')) return 'hevc';
    if (normalized.includes('av1')) return 'av1';
    if (normalized.includes('vp9')) return 'vp9';
    return null;
  }

  private audioCodecForEncoder(encoder: string): string | null {
    const normalized = encoder.toLowerCase();
    if (normalized === 'libmp3lame') return 'mp3';
    if (normalized === 'pcm_s16le') return 'pcm_s16le';
    if (normalized === 'libopus') return 'opus';
    if (normalized === 'libvorbis') return 'vorbis';
    if (['aac', 'flac', 'ac3', 'alac'].includes(normalized)) return normalized;
    return null;
  }
}
