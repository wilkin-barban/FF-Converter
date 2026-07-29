import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DiskSpaceInspector,
  OutputPathResolver,
  OutputValidator
} from '../packages/media-core/src';
import {
  EffectiveConversionPlan,
  MediaSnapshot
} from '../packages/shared-types/src';
import { MediaInspector } from '../packages/media-core/src/inspection/inspector';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-converter-output-'));
  temporaryDirectories.push(directory);
  return directory;
}

function snapshot(filePath: string, overrides: Partial<MediaSnapshot> = {}): MediaSnapshot {
  return {
    filePath,
    container: 'mp4',
    durationSeconds: 60,
    totalBitrate: 1_000_000,
    fileSizeBytes: 1024,
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
    audioStreams: [{
      index: 1,
      codec: 'aac',
      channels: 2,
      sampleRate: 48000
    }],
    subtitleStreams: [],
    metadata: {},
    analyzedAt: new Date().toISOString(),
    ...overrides
  };
}

function conversionPlan(): EffectiveConversionPlan {
  return {
    container: 'mp4',
    video: { action: 'transcode', encoder: 'libx264', maxWidth: 1920, maxHeight: 1080 },
    audio: { action: 'transcode', encoder: 'aac' },
    subtitles: { action: 'remove' }
  };
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

describe('OutputPathResolver', () => {
  it('implements skip, overwrite and suffix without ambiguous behavior', async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, 'movie.mkv');
    const existingOutput = path.join(directory, 'movie.mp4');
    await fs.writeFile(inputPath, 'input');
    await fs.writeFile(existingOutput, 'original');
    const resolver = new OutputPathResolver();

    const skipped = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'skip',
      jobId: 'job-skip'
    });
    expect(skipped.action).toBe('skip');
    expect(skipped.tempPath).toBeUndefined();

    const overwritten = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'overwrite',
      jobId: 'job-overwrite'
    });
    expect(overwritten.action).toBe('convert');
    expect(overwritten.overwriteExisting).toBe(true);

    const suffixed = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'suffix',
      jobId: 'job-suffix'
    });
    expect(suffixed.finalPath).toBe(path.join(directory, 'movie-1.mp4'));
    expect(suffixed.overwriteExisting).toBe(false);
  });

  it('avoids active reservations and creates job-unique temporary names', async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, 'movie.mkv');
    const initialOutput = path.join(directory, 'movie.mp4');
    const resolver = new OutputPathResolver();

    const first = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'overwrite',
      jobId: 'job-first',
      isReserved: (candidate) => candidate === initialOutput
    });
    const second = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'suffix',
      jobId: 'job-second'
    });

    expect(first.finalPath).toBe(path.join(directory, 'movie-1.mp4'));
    expect(first.overwriteExisting).toBe(false);
    expect(first.tempPath).toContain('job-first');
    expect(second.tempPath).toContain('job-second');
    expect(first.tempPath).not.toBe(second.tempPath);
  });

  it('never overwrites the input when output folder and container are unchanged', async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(inputPath, 'original input');
    const resolver = new OutputPathResolver();

    const resolution = await resolver.resolve({
      inputPath,
      outputFolder: directory,
      targetContainer: 'mp4',
      duplicatePolicy: 'overwrite',
      jobId: 'job-same-path'
    });

    expect(resolution.finalPath).toBe(path.join(directory, 'movie-1.mp4'));
    expect(resolution.overwriteExisting).toBe(false);
    expect(await fs.readFile(inputPath, 'utf8')).toBe('original input');
  });
});

describe('OutputValidator', () => {
  it('finalizes a validated temporary output without deleting an unrelated destination', async () => {
    const directory = await temporaryDirectory();
    const tempPath = path.join(directory, '.movie.partial.mp4');
    const finalPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(tempPath, 'validated output');

    const outputSnapshot = snapshot(tempPath);
    const inspector = { inspect: async () => outputSnapshot } as MediaInspector;
    const validator = new OutputValidator(inspector);
    const result = await validator.validateAndFinalize(tempPath, finalPath, {
      expectedDurationSeconds: 60,
      sourceSnapshot: snapshot('input.mkv'),
      plan: conversionPlan(),
      overwriteExisting: false
    });

    expect(result.success).toBe(true);
    expect(await fs.readFile(finalPath, 'utf8')).toBe('validated output');
  });

  it('preserves the old destination when validation fails', async () => {
    const directory = await temporaryDirectory();
    const tempPath = path.join(directory, '.movie.partial.mp4');
    const finalPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(tempPath, 'invalid output');
    await fs.writeFile(finalPath, 'original destination');

    const inspector = {
      inspect: async () => snapshot(tempPath, { durationSeconds: 10 })
    } as MediaInspector;
    const validator = new OutputValidator(inspector);
    const result = await validator.validateAndFinalize(tempPath, finalPath, {
      expectedDurationSeconds: 60,
      sourceSnapshot: snapshot('input.mkv'),
      plan: conversionPlan(),
      overwriteExisting: true
    });

    expect(result.success).toBe(false);
    expect(await fs.readFile(finalPath, 'utf8')).toBe('original destination');
    expect(await fs.readFile(tempPath, 'utf8')).toBe('invalid output');
  });

  it('replaces an existing destination only after successful validation', async () => {
    const directory = await temporaryDirectory();
    const tempPath = path.join(directory, '.movie.partial.mp4');
    const finalPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(tempPath, 'new validated output');
    await fs.writeFile(finalPath, 'old destination');

    const inspector = { inspect: async () => snapshot(tempPath) } as MediaInspector;
    const validator = new OutputValidator(inspector);
    const result = await validator.validateAndFinalize(tempPath, finalPath, {
      expectedDurationSeconds: 60,
      sourceSnapshot: snapshot('input.mkv'),
      plan: conversionPlan(),
      overwriteExisting: true
    });

    expect(result.success).toBe(true);
    expect(await fs.readFile(finalPath, 'utf8')).toBe('new validated output');
    const remainingFiles = await fs.readdir(directory);
    expect(remainingFiles.some((name) => name.includes('.ffconverter.backup-'))).toBe(false);
  });

  it('refuses a destination that appears during conversion when overwrite is disabled', async () => {
    const directory = await temporaryDirectory();
    const tempPath = path.join(directory, '.movie.partial.mp4');
    const finalPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(tempPath, 'new output');
    await fs.writeFile(finalPath, 'late destination');

    const inspector = { inspect: async () => snapshot(tempPath) } as MediaInspector;
    const validator = new OutputValidator(inspector);
    const result = await validator.validateAndFinalize(tempPath, finalPath, {
      expectedDurationSeconds: 60,
      sourceSnapshot: snapshot('input.mkv'),
      plan: conversionPlan(),
      overwriteExisting: false
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('overwrite is disabled');
    expect(await fs.readFile(finalPath, 'utf8')).toBe('late destination');
    expect(await fs.readFile(tempPath, 'utf8')).toBe('new output');
  });

  it('rejects missing streams, wrong codecs and oversized video', async () => {
    const directory = await temporaryDirectory();
    const tempPath = path.join(directory, '.movie.partial.mp4');
    const finalPath = path.join(directory, 'movie.mp4');
    await fs.writeFile(tempPath, 'invalid');

    const invalidSnapshot = snapshot(tempPath, {
      videoStreams: [{
        index: 0,
        codec: 'hevc',
        width: 3840,
        height: 2160,
        framerate: 30,
        pixelFormat: 'yuv420p',
        bitDepth: 8,
        isHdr: false
      }],
      audioStreams: []
    });
    const inspector = { inspect: async () => invalidSnapshot } as MediaInspector;
    const validator = new OutputValidator(inspector);
    const result = await validator.validateAndFinalize(tempPath, finalPath, {
      expectedDurationSeconds: 60,
      sourceSnapshot: snapshot('input.mkv'),
      plan: conversionPlan(),
      overwriteExisting: false
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/audio stream|width|codec/i);
  });
});

describe('DiskSpaceInspector', () => {
  it('uses a conversion estimate plus a safety reserve', () => {
    const inspector = new DiskSpaceInspector();
    expect(inspector.estimateRequiredBytes(0)).toBe(320 * 1024 * 1024);
    expect(inspector.estimateRequiredBytes(1024 * 1024 * 1024)).toBe(
      Math.ceil(1.25 * 1024 * 1024 * 1024) + 256 * 1024 * 1024
    );
  });

  it('reports insufficient capacity before a conversion starts', async () => {
    const inspector = new DiskSpaceInspector(async () => ({
      bavail: 10,
      bsize: 1024
    }));
    const result = await inspector.check('unused-in-test', 1024 * 1024 * 1024);

    expect(result.sufficient).toBe(false);
    expect(result.availableBytes).toBe(10 * 1024);
    expect(result.requiredBytes).toBeGreaterThan(result.availableBytes);
  });
});
