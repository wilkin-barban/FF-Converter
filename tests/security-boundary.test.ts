import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  CreateJobSchema,
  EntityIdSchema,
  PathListSchema,
  PresetSchema
} from '../packages/shared-contracts/src';
import { PathAccessRegistry } from '../apps/desktop/src/main/security/path-access';
import { isTrustedRendererUrl } from '../apps/desktop/src/main/security/ipc-security';

describe('IPC security schemas', () => {
  it('rejects malformed identifiers and oversized path payloads', () => {
    expect(() => EntityIdSchema.parse('../job')).toThrow();
    expect(() => EntityIdSchema.parse('job valid with spaces')).toThrow();
    expect(() => PathListSchema.parse([])).toThrow();
    expect(() => PathListSchema.parse(Array.from({ length: 1001 }, () => 'C:\\media\\file.mp4'))).toThrow();
    expect(() => PathListSchema.parse(['C:\\media\\bad\0name.mp4'])).toThrow();
  });

  it('accepts only packaged files and loopback development origins', () => {
    expect(isTrustedRendererUrl('file:///C:/app/dist/renderer/index.html')).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173/')).toBe(true);
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/')).toBe(true);
    expect(isTrustedRendererUrl('https://localhost:5173/')).toBe(false);
    expect(isTrustedRendererUrl('http://localhost.example.com:5173/')).toBe(false);
    expect(isTrustedRendererUrl('https://evil.example/')).toBe(false);
  });

  it('rejects unsafe custom FFmpeg arguments', () => {
    const basePreset = {
      name: 'Safe preset',
      description: '',
      category: 'Custom',
      isSystem: false,
      targetContainer: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac'
    };

    expect(() => PresetSchema.parse({ ...basePreset, customFFmpegFlags: ['-i', 'other.mp4'] })).toThrow();
    expect(() => PresetSchema.parse({ ...basePreset, customFFmpegFlags: ['https://example.test/input'] })).toThrow();
    expect(PresetSchema.parse({ ...basePreset, customFFmpegFlags: ['-tune', 'film'] })).toBeTruthy();
  });

  it('bounds job priority and number of inputs', () => {
    const valid = {
      inputPaths: ['C:\\media\\input.mp4'],
      outputFolder: 'C:\\media',
      presetId: 'system-smarttv-compat'
    };

    expect(CreateJobSchema.parse(valid).priority).toBe(0);
    expect(() => CreateJobSchema.parse({ ...valid, priority: 1001 })).toThrow();
  });
});

describe('PathAccessRegistry', () => {
  it('authorizes exact files and descendants of explicitly selected directories', () => {
    const registry = new PathAccessRegistry();
    const selectedFile = path.resolve('fixtures', 'selected.mp4');
    const selectedDirectory = path.resolve('fixtures', 'library');
    const child = path.join(selectedDirectory, 'nested', 'movie.mkv');
    const unicodeChild = path.join(selectedDirectory, 'películas', 'acción 🎬.mkv');

    registry.authorizeFile(selectedFile);
    registry.authorizeDirectory(selectedDirectory);

    expect(registry.assertReadable(selectedFile)).toBeTruthy();
    expect(registry.assertReadable(child)).toBeTruthy();
    expect(registry.assertReadable(unicodeChild)).toBeTruthy();
    expect(() => registry.assertReadable(path.resolve('fixtures', 'other.mp4'))).toThrow();
  });

  it('does not grant read access when only an output directory is authorized', () => {
    const registry = new PathAccessRegistry();
    const outputDirectory = path.resolve('outputs');
    registry.authorizeOutputDirectory(outputDirectory);

    expect(registry.assertDirectory(outputDirectory)).toBeTruthy();
    expect(() => registry.assertReadable(path.join(outputDirectory, 'untrusted.mp4'))).toThrow();
    expect(() => registry.assertDirectory(path.resolve('other-output'))).toThrow();
  });

  it('rejects relative paths', () => {
    const registry = new PathAccessRegistry();
    expect(() => registry.authorizeFile('relative/file.mp4')).toThrow();
  });
});
