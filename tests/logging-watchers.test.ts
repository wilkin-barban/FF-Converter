import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { LoggerService } from '../apps/desktop/src/main/services/logger-service';
import { WatchService } from '../apps/desktop/src/main/services/watch-service';
import { WatcherRule } from '../packages/shared-types/src';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-converter-logs-watch-'));
  temporaryDirectories.push(directory);
  return directory;
}

function watcherRule(overrides: Partial<WatcherRule> = {}): WatcherRule {
  return {
    id: 'rule-test',
    name: 'Test watcher',
    watchPath: 'C:\\input',
    outputPath: 'C:\\output',
    presetId: 'system-smarttv-compat',
    includeSubfolders: false,
    allowedExtensions: ['.mp4'],
    stabilizationSeconds: 1,
    postAction: 'keep',
    duplicatePolicy: 'suffix',
    enabled: true,
    processExisting: false,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

describe('LoggerService persistence', () => {
  it('persists, reloads, sanitizes and clears logs', async () => {
    const directory = await temporaryDirectory();
    const logger = new LoggerService({ logDirectory: directory });
    logger.info('System', `Archivo en ${os.homedir()}\\private\\movie.mp4`);
    logger.error('FFmpeg', 'Conversion failed', 'https://user:secret@example.test/input');

    const reloaded = new LoggerService({ logDirectory: directory });
    expect(reloaded.getLogs()).toHaveLength(2);
    expect(reloaded.getLogs()[1].message).toContain('%USER_HOME%');
    expect(reloaded.getLogs()[0].details).toContain('***:***@');

    reloaded.clearLogs();
    expect(reloaded.getLogs()).toHaveLength(0);
    expect(await fs.readFile(path.join(directory, 'ff-converter.log.jsonl'), 'utf8')).toBe('');
  });

  it('rotates bounded files and exports JSONL', async () => {
    const directory = await temporaryDirectory();
    const logger = new LoggerService({
      logDirectory: directory,
      maxFileSizeBytes: 100,
      retainedFiles: 2
    });
    for (let index = 0; index < 10; index += 1) {
      logger.info('Queue', `Entry ${index} ${'x'.repeat(80)}`);
    }

    const logPath = logger.getLogFilePath()!;
    expect(await fs.stat(`${logPath}.1`)).toBeTruthy();
    const exportPath = path.join(directory, 'export.jsonl');
    logger.exportLogs(exportPath);
    expect((await fs.readFile(exportPath, 'utf8')).split(/\r?\n/).filter(Boolean)).toHaveLength(10);
  });
});

describe('WatchService policies', () => {
  function createService(databaseOverrides: Record<string, any> = {}) {
    const queue = Object.assign(new EventEmitter(), {
      addJob: async () => ({ id: 'job-1', status: 'QUEUED' })
    });
    const database = {
      hasProcessedWatcherFile: () => false,
      recordProcessedWatcherFile: () => undefined,
      ...databaseOverrides
    };
    const logger = new LoggerService();
    return {
      service: new WatchService(queue as any, database as any, logger),
      queue,
      database
    };
  }

  it('does not enqueue a fingerprint already recorded', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'movie.mp4');
    await fs.writeFile(filePath, 'input');
    let enqueueCount = 0;
    const { service, queue } = createService({ hasProcessedWatcherFile: () => true });
    queue.addJob = async () => {
      enqueueCount += 1;
      return { id: 'job-1', status: 'QUEUED' };
    };

    await (service as any).handleAddedFile(
      watcherRule({ watchPath: directory, outputPath: path.join(directory, 'output') }),
      filePath
    );
    expect(enqueueCount).toBe(0);
  });

  it('deletes originals only through the completed post-action path', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'movie.mp4');
    await fs.writeFile(filePath, 'input');
    const { service } = createService();

    await (service as any).applyPostAction({
      rule: watcherRule({ postAction: 'delete' }),
      filePath,
      fingerprint: 'fingerprint'
    });
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('moves with suffix without overwriting an existing original', async () => {
    const directory = await temporaryDirectory();
    const moveDirectory = path.join(directory, 'processed');
    const filePath = path.join(directory, 'movie.mp4');
    await fs.mkdir(moveDirectory);
    await fs.writeFile(filePath, 'new input');
    await fs.writeFile(path.join(moveDirectory, 'movie.mp4'), 'existing');
    const { service } = createService();

    await (service as any).applyPostAction({
      rule: watcherRule({
        postAction: 'move',
        moveDestination: moveDirectory,
        duplicatePolicy: 'suffix'
      }),
      filePath,
      fingerprint: 'fingerprint'
    });

    expect(await fs.readFile(path.join(moveDirectory, 'movie.mp4'), 'utf8')).toBe('existing');
    expect(await fs.readFile(path.join(moveDirectory, 'movie-1.mp4'), 'utf8')).toBe('new input');
  });

  it('changes the fingerprint when size or modification time changes', () => {
    const { service } = createService();
    const first = (service as any).fingerprint('rule', 'C:\\media\\movie.mp4', 100, 1000);
    const second = (service as any).fingerprint('rule', 'C:\\media\\movie.mp4', 101, 1000);
    expect(first).not.toBe(second);
  });
});
