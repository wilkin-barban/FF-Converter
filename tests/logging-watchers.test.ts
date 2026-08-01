import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  vi.useRealTimers();
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

  it('preserves an existing overwrite destination when replacement fails', async () => {
    const directory = await temporaryDirectory();
    const moveDirectory = path.join(directory, 'processed');
    const filePath = path.join(directory, 'movie.mp4');
    const destination = path.join(moveDirectory, 'movie.mp4');
    await fs.mkdir(moveDirectory);
    await fs.writeFile(filePath, 'new input');
    await fs.writeFile(destination, 'existing');
    const realRename = fs.rename;
    const rename = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (from === filePath && to === destination) throw Object.assign(new Error('replace failed'), { code: 'EIO' });
      return realRename(from, to);
    });
    const { service } = createService();

    await expect((service as any).applyPostAction({
      rule: watcherRule({ postAction: 'move', moveDestination: moveDirectory, duplicatePolicy: 'overwrite' }),
      filePath, fingerprint: 'fingerprint'
    })).rejects.toThrow('replace failed');
    expect(await fs.readFile(destination, 'utf8')).toBe('existing');
    expect(await fs.readFile(filePath, 'utf8')).toBe('new input');
    rename.mockRestore();
  });

  it('records a completed job only after its post-action succeeds so it can retry', async () => {
    vi.useFakeTimers();
    const records: string[] = [];
    const { service } = createService({ recordProcessedWatcherFile: (_rule: string, fingerprint: string) => records.push(fingerprint) });
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule: watcherRule({ postAction: 'move' }), filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable'
    });

    await (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    expect(records).toEqual([]);
    expect((service as any).pendingJobs.has('job-1')).toBe(true);
    expect((service as any).pendingFingerprints.has('retryable')).toBe(true);
    service.stopAll();
  });

  it('retries a failed completed post-action and records only after eventual success', async () => {
    vi.useFakeTimers();
    const records: string[] = [];
    const { service } = createService({ recordProcessedWatcherFile: (_rule: string, fingerprint: string) => records.push(fingerprint) });
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule: watcherRule(), filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable'
    });
    const apply = vi.spyOn(service as any, 'applyPostAction')
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce(undefined);

    await (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    expect(records).toEqual([]);
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledTimes(2);
    expect(records).toEqual(['retryable']);
    expect((service as any).pendingJobs.has('job-1')).toBe(false);
    expect((service as any).pendingFingerprints.has('retryable')).toBe(false);
  });

  it('clears a permanently failing post-action after finite retries so the file is recoverable', async () => {
    vi.useFakeTimers();
    const { service } = createService();
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule: watcherRule(), filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable'
    });
    const apply = vi.spyOn(service as any, 'applyPostAction').mockRejectedValue(new Error('persistent failure'));

    await (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledTimes(4);
    expect((service as any).pendingJobs.has('job-1')).toBe(false);
    expect((service as any).pendingFingerprints.has('retryable')).toBe(false);
  });

  it('does not schedule parallel retries for duplicate completed events', async () => {
    vi.useFakeTimers();
    const { service } = createService();
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule: watcherRule(), filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable'
    });
    const apply = vi.spyOn(service as any, 'applyPostAction').mockRejectedValue(new Error('transient failure'));

    await Promise.all([
      (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' }),
      (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' })
    ]);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    service.stopAll();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['disabled', (rule: WatcherRule) => [watcherRule({ ...rule, enabled: false })]],
    ['deleted', () => []],
    ['changed', (rule: WatcherRule) => [watcherRule({ ...rule, outputPath: 'C:\\changed-output' })]]
  ])('cancels a pending retry when its rule is %s', async (_state, nextRules) => {
    vi.useFakeTimers();
    const { service } = createService();
    const rule = watcherRule({ postAction: 'delete' });
    const signature = (service as any).signature(rule);
    (service as any).activeWatchers.set(rule.id, { watcher: { close: async () => undefined }, signature });
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule, filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable', serviceGeneration: 0, ruleGeneration: 0, signature
    });
    const apply = vi.spyOn(service as any, 'applyPostAction').mockRejectedValue(new Error('transient failure'));

    await (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    service.syncWatchers(nextRules(rule));
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledTimes(1);
    expect((service as any).pendingJobs.has('job-1')).toBe(false);
    expect((service as any).pendingFingerprints.has('retryable')).toBe(false);
    service.stopAll();
  });

  it('keeps an unrelated rule pending job valid when another rule is disabled', async () => {
    const { service } = createService();
    const ruleA = watcherRule({ id: 'rule-a', postAction: 'delete' });
    const ruleB = watcherRule({ id: 'rule-b' });
    for (const rule of [ruleA, ruleB]) {
      (service as any).activeWatchers.set(rule.id, {
        watcher: { close: async () => undefined }, signature: (service as any).signature(rule)
      });
    }
    const signatureB = (service as any).signature(ruleB);
    (service as any).pendingFingerprints.add('rule-b-file');
    (service as any).pendingJobs.set('job-b', {
      rule: ruleB, filePath: 'C:\\input\\movie.mp4', fingerprint: 'rule-b-file', serviceGeneration: 0, ruleGeneration: 0, signature: signatureB
    });
    const apply = vi.spyOn(service as any, 'applyPostAction').mockResolvedValue(undefined);

    service.syncWatchers([watcherRule({ ...ruleA, enabled: false }), ruleB]);
    await (service as any).handleJobUpdated({ id: 'job-b', status: 'COMPLETED' });

    expect(apply).toHaveBeenCalledTimes(1);
    expect((service as any).pendingJobs.has('job-b')).toBe(false);
    service.stopAll();
  });

  it('keeps an unrelated addJob overlap when another rule changes', async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, 'movie.mp4');
    await fs.writeFile(filePath, 'input');
    let resolveJob!: (job: { id: string; status: string }) => void;
    const { service, queue } = createService();
    const ruleA = watcherRule({ id: 'rule-a', postAction: 'delete' });
    const ruleB = watcherRule({ id: 'rule-b', watchPath: directory, outputPath: path.join(directory, 'output') });
    for (const rule of [ruleA, ruleB]) {
      (service as any).activeWatchers.set(rule.id, {
        watcher: { close: async () => undefined }, signature: (service as any).signature(rule)
      });
    }
    queue.addJob = () => new Promise(resolve => { resolveJob = resolve; });

    const added = (service as any).handleAddedFile(ruleB, filePath);
    await vi.waitFor(() => expect(resolveJob).toBeTypeOf('function'));
    service.syncWatchers([watcherRule({ ...ruleA, outputPath: 'C:\\changed-output' }), ruleB]);
    resolveJob({ id: 'job-b', status: 'QUEUED' });
    await added;

    expect((service as any).pendingJobs.has('job-b')).toBe(true);
    service.stopAll();
  });

  it('does not schedule retries or allow duplicate actions when stopAll interrupts an in-flight failure', async () => {
    vi.useFakeTimers();
    const { service } = createService();
    (service as any).pendingFingerprints.add('retryable');
    (service as any).pendingJobs.set('job-1', {
      rule: watcherRule(), filePath: 'C:\\input\\movie.mp4', fingerprint: 'retryable'
    });
    let rejectPostAction!: (reason: Error) => void;
    const apply = vi.spyOn(service as any, 'applyPostAction').mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectPostAction = reject;
    }));

    const completion = (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    service.stopAll();
    rejectPostAction(new Error('shutdown failure'));
    await completion;
    await (service as any).handleJobUpdated({ id: 'job-1', status: 'COMPLETED' });
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes a copied EXDEV destination when deleting the source fails', async () => {
    const directory = await temporaryDirectory();
    const source = path.join(directory, 'movie.mp4');
    const destination = path.join(directory, 'processed.mp4');
    await fs.writeFile(source, 'input');
    const realUnlink = fs.unlink.bind(fs);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('cross-device'), { code: 'EXDEV' }));
    vi.spyOn(fs, 'unlink').mockImplementation(async (filePath) => {
      if (filePath === source) throw Object.assign(new Error('source busy'), { code: 'EBUSY' });
      return realUnlink(filePath);
    });
    const { service } = createService();

    await expect((service as any).moveFile(source, destination, false)).rejects.toThrow('source busy');
    await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(source, 'utf8')).toBe('input');
  });

  it('restores an overwrite backup when EXDEV source deletion fails', async () => {
    const directory = await temporaryDirectory();
    const source = path.join(directory, 'movie.mp4');
    const destination = path.join(directory, 'processed.mp4');
    await fs.writeFile(source, 'input');
    await fs.writeFile(destination, 'existing');
    const realRename = fs.rename.bind(fs);
    const realUnlink = fs.unlink.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (from === source && to === destination) throw Object.assign(new Error('cross-device'), { code: 'EXDEV' });
      return realRename(from, to);
    });
    vi.spyOn(fs, 'unlink').mockImplementation(async (filePath) => {
      if (filePath === source) throw Object.assign(new Error('source busy'), { code: 'EBUSY' });
      return realUnlink(filePath);
    });
    const { service } = createService();

    await expect((service as any).moveFile(source, destination, true)).rejects.toThrow('source busy');
    expect(await fs.readFile(destination, 'utf8')).toBe('existing');
    expect(await fs.readFile(source, 'utf8')).toBe('input');
  });

  it('changes the fingerprint when size or modification time changes', () => {
    const { service } = createService();
    const first = (service as any).fingerprint('rule', 'C:\\media\\movie.mp4', 100, 1000);
    const second = (service as any).fingerprint('rule', 'C:\\media\\movie.mp4', 101, 1000);
    expect(first).not.toBe(second);
  });
});
