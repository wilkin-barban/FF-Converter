import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { FFmpegLocator } from '../apps/desktop/src/main/services/ffmpeg-locator';
import { AppSettings } from '../packages/shared-types/src';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-converter-locator-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createExecutable(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'test binary');
  fs.chmodSync(filePath, 0o755);
}

function settings(mode: AppSettings['ffmpegPathMode'], overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    maxConcurrentJobs: 2,
    autoConcurrency: true,
    preferredHardware: 'auto',
    ffmpegPathMode: mode,
    duplicatePolicy: 'suffix',
    theme: 'dark',
    language: 'es',
    desktopNotifications: false,
    autoStartWatchers: true,
    keepTempFilesOnFailure: false,
    ...overrides
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('FFmpegLocator', () => {
  it('resolves bundled binaries from the development resource layout', () => {
    const root = createTemporaryDirectory();
    const appPath = path.join(root, 'apps', 'desktop');
    const binaryDirectory = path.join(root, 'resources', 'ffmpeg', 'win32-x64');
    createExecutable(path.join(binaryDirectory, 'ffmpeg.exe'));
    createExecutable(path.join(binaryDirectory, 'ffprobe.exe'));

    const locator = new FFmpegLocator({
      appPath,
      resourcesPath: path.join(root, 'packaged-resources'),
      isPackaged: false,
      platform: 'win32',
      architecture: 'x64',
      environmentPath: ''
    });

    const result = locator.resolve(settings('bundled'));
    expect(result.effectiveMode).toBe('bundled');
    expect(result.ffmpegPath.toLowerCase()).toBe(path.join(binaryDirectory, 'ffmpeg.exe').toLowerCase());
    expect(result.fallbackReason).toBeUndefined();
  });

  it('uses PATH in system mode', () => {
    const root = createTemporaryDirectory();
    createExecutable(path.join(root, 'ffmpeg.exe'));
    createExecutable(path.join(root, 'ffprobe.exe'));

    const locator = new FFmpegLocator({
      appPath: root,
      resourcesPath: root,
      isPackaged: false,
      platform: 'win32',
      architecture: 'x64',
      environmentPath: root,
      pathExtensions: '.EXE'
    });

    const result = locator.resolve(settings('system'));
    expect(result.requestedMode).toBe('system');
    expect(result.effectiveMode).toBe('system');
    expect(path.basename(result.ffmpegPath).toLowerCase()).toBe('ffmpeg.exe');
  });

  it('falls back to PATH when bundled binaries are absent', () => {
    const root = createTemporaryDirectory();
    const systemBin = path.join(root, 'system-bin');
    createExecutable(path.join(systemBin, 'ffmpeg.exe'));
    createExecutable(path.join(systemBin, 'ffprobe.exe'));

    const locator = new FFmpegLocator({
      appPath: path.join(root, 'apps', 'desktop'),
      resourcesPath: path.join(root, 'resources'),
      isPackaged: false,
      platform: 'win32',
      architecture: 'x64',
      environmentPath: systemBin,
      pathExtensions: '.EXE'
    });

    const result = locator.resolve(settings('bundled'));
    expect(result.requestedMode).toBe('bundled');
    expect(result.effectiveMode).toBe('system');
    expect(result.fallbackReason).toContain('Bundled FFmpeg binaries were not found');
  });

  it('requires both custom binaries to exist', () => {
    const root = createTemporaryDirectory();
    const ffmpegPath = path.join(root, 'ffmpeg.exe');
    const ffprobePath = path.join(root, 'ffprobe.exe');
    createExecutable(ffmpegPath);
    createExecutable(ffprobePath);

    const locator = new FFmpegLocator({
      appPath: root,
      resourcesPath: root,
      isPackaged: false,
      platform: 'win32',
      architecture: 'x64'
    });

    const result = locator.resolve(settings('custom', {
      customFFmpegPath: ffmpegPath,
      customFFprobePath: ffprobePath
    }));
    expect(result.effectiveMode).toBe('custom');
    expect(() => locator.resolve(settings('custom', { customFFmpegPath: ffmpegPath }))).toThrow();
  });

  it('fails clearly when neither bundled nor system binaries exist', () => {
    const root = createTemporaryDirectory();
    const locator = new FFmpegLocator({
      appPath: path.join(root, 'apps', 'desktop'),
      resourcesPath: root,
      isPackaged: false,
      platform: 'win32',
      architecture: 'x64',
      environmentPath: ''
    });

    expect(() => locator.resolve(settings('bundled'))).toThrow('FFmpeg and FFprobe were not found in PATH');
  });
});
