import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m2ts',
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.m4v', '.3gp'
]);

async function expandMediaPaths(inputPaths: string[]): Promise<string[]> {
  const result: string[] = [];

  async function scan(itemPath: string) {
    try {
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(itemPath);
        for (const entry of entries) {
          await scan(path.join(itemPath, entry));
        }
      } else if (stat.isFile()) {
        const ext = path.extname(itemPath).toLowerCase();
        if (MEDIA_EXTENSIONS.has(ext)) {
          result.push(itemPath);
        }
      }
    } catch (err) {
      console.error(`Error scanning path ${itemPath}:`, err);
    }
  }

  for (const p of inputPaths) {
    await scan(p);
  }

  return result;
}

describe('Folder & File Drag Drop Expansion Tests', () => {
  it('should recursively extract all valid video/audio files when a folder path is dropped', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffconv-test-'));
    const subDir = path.join(tmpDir, 'subfolder');
    await fs.mkdir(subDir, { recursive: true });

    const video1 = path.join(tmpDir, 'video1.mp4');
    const video2 = path.join(subDir, 'video2.mkv');
    const textFile = path.join(tmpDir, 'notes.txt');

    await fs.writeFile(video1, 'dummy mp4 data');
    await fs.writeFile(video2, 'dummy mkv data');
    await fs.writeFile(textFile, 'hello text');

    const expanded = await expandMediaPaths([tmpDir]);

    expect(expanded.length).toBe(2);
    expect(expanded).toContain(video1);
    expect(expanded).toContain(video2);
    expect(expanded).not.toContain(textFile);

    // Clean up
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
