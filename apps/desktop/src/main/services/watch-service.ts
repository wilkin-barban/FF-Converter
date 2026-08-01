import fs from 'fs/promises';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { Job, WatcherRule } from '@ff-converter/shared-types';
import { QueueOrchestrator } from './queue-orchestrator';
import { AppDatabase } from '../database/db';
import { LoggerService } from './logger-service';

interface ActiveWatcher {
  watcher: FSWatcher;
  signature: string;
}

interface PendingWatchJob {
  rule: WatcherRule;
  filePath: string;
  fingerprint: string;
  serviceGeneration: number;
  ruleGeneration: number;
  signature: string;
}

export class WatchService {
  private activeWatchers = new Map<string, ActiveWatcher>();
  private pendingFingerprints = new Set<string>();
  private pendingJobs = new Map<string, PendingWatchJob>();
  private postActionRetries = new Map<string, number>();
  private postActionRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private postActionsInFlight = new Set<string>();
  private serviceGeneration = 0;
  private ruleGenerations = new Map<string, number>();
  private stopped = false;
  private static readonly MAX_POST_ACTION_RETRIES = 3;
  private static readonly POST_ACTION_RETRY_DELAY_MS = 1_000;

  constructor(
    private queueOrchestrator: QueueOrchestrator,
    private db: AppDatabase,
    private logger: LoggerService
  ) {
    this.queueOrchestrator.on('job-updated', (job: Job) => {
      void this.handleJobUpdated(job);
    });
  }

  public syncWatchers(rules: WatcherRule[]): void {
    if (this.stopped) {
      this.stopped = false;
      this.serviceGeneration += 1;
    }
    for (const [id, active] of this.activeWatchers.entries()) {
      const rule = rules.find(candidate => candidate.id === id);
      const signature = rule ? this.signature(rule) : '';
      if (!rule || !rule.enabled || active.signature !== signature) {
        this.invalidateRulePendingJobs(id);
        void active.watcher.close();
        this.activeWatchers.delete(id);
        this.logger.info('Watcher', `Watcher detenido o actualizado: ${id}`);
      }
    }

    for (const rule of rules) {
      if (rule.enabled && !this.activeWatchers.has(rule.id)) this.startWatcher(rule);
    }
  }

  private startWatcher(rule: WatcherRule): void {
    const watcher = chokidar.watch(rule.watchPath, {
      depth: rule.includeSubfolders ? undefined : 0,
      ignoreInitial: !rule.processExisting,
      awaitWriteFinish: {
        stabilityThreshold: rule.stabilizationSeconds * 1000,
        pollInterval: 1000
      }
    });

    watcher.on('add', (filePath: string) => {
      void this.handleAddedFile(rule, filePath);
    });
    watcher.on('error', (error: unknown) => {
      this.logger.error('Watcher', `Error en watcher ${rule.name}`, String(error));
    });

    this.activeWatchers.set(rule.id, { watcher, signature: this.signature(rule) });
    this.logger.info(
      'Watcher',
      `Watcher iniciado: ${rule.name}`,
      `${rule.watchPath} -> ${rule.outputPath}; processExisting=${Boolean(rule.processExisting)}`
    );
  }

  private async handleAddedFile(rule: WatcherRule, filePath: string): Promise<void> {
    const serviceGeneration = this.serviceGeneration;
    const ruleGeneration = this.ruleGeneration(rule.id);
    if (!this.isRuleActive(rule) || filePath.includes('.ffconverter.partial') || this.isInside(rule.outputPath, filePath)) return;
    if (rule.moveDestination && this.isInside(rule.moveDestination, filePath)) return;

    const ext = path.extname(filePath).toLowerCase();
    if (!rule.allowedExtensions.map(extension => extension.toLowerCase()).includes(ext)) return;

    let fingerprint: string | undefined;
    try {
      const stat = await fs.stat(filePath);
      fingerprint = this.fingerprint(rule.id, filePath, stat.size, stat.mtimeMs);
      if (this.pendingFingerprints.has(fingerprint) || this.db.hasProcessedWatcherFile(rule.id, fingerprint)) {
        this.logger.info('Watcher', `Archivo ya procesado; se omite: ${filePath}`);
        return;
      }

      this.pendingFingerprints.add(fingerprint);
      this.logger.info('Watcher', `Archivo estabilizado detectado por ${rule.name}`, filePath);
      const job = await this.queueOrchestrator.addJob(
        filePath,
        rule.outputPath,
        rule.presetId,
        0,
        rule.duplicatePolicy
      );

      if (job.status === 'SKIPPED') {
        this.db.recordProcessedWatcherFile(rule.id, fingerprint, filePath);
        this.pendingFingerprints.delete(fingerprint);
        this.logger.info('Watcher', `Archivo marcado como procesado por pol√≠tica skip: ${filePath}`);
        return;
      }
      if (!this.isRuleActive(rule) || serviceGeneration !== this.serviceGeneration || ruleGeneration !== this.ruleGeneration(rule.id)) {
        this.pendingFingerprints.delete(fingerprint);
        return;
      }
      this.pendingJobs.set(job.id, { rule, filePath, fingerprint, serviceGeneration, ruleGeneration, signature: this.signature(rule) });
    } catch (error: any) {
      if (fingerprint) this.pendingFingerprints.delete(fingerprint);
      this.logger.error('Watcher', `No fue posible encolar ${filePath}`, error.message);
    }
  }

  private async handleJobUpdated(job: Job): Promise<void> {
    const pending = this.pendingJobs.get(job.id);
    if (!pending) return;
    if (job.status === 'COMPLETED') {
      await this.completePendingPostAction(job.id, pending);
    } else if (['FAILED', 'CANCELLED', 'SKIPPED'].includes(job.status)) {
      this.finishPending(job.id, pending.fingerprint);
    }
  }

  private async completePendingPostAction(jobId: string, pending: PendingWatchJob): Promise<void> {
    if (!this.isPendingCurrent(pending) || this.postActionsInFlight.has(jobId) || this.postActionRetryTimers.has(jobId)) return;
    this.postActionsInFlight.add(jobId);
    try {
      await this.applyPostAction(pending);
      if (!this.isPendingCurrent(pending)) return;
      this.db.recordProcessedWatcherFile(pending.rule.id, pending.fingerprint, pending.filePath);
      this.finishPending(jobId, pending.fingerprint);
    } catch (error: any) {
      this.logger.error('Watcher', `FallÛ la acciÛn posterior para ${pending.filePath}`, error.message);
      if (this.isPendingCurrent(pending)) this.schedulePostActionRetry(jobId, pending);
    } finally {
      this.postActionsInFlight.delete(jobId);
    }
  }

  private schedulePostActionRetry(jobId: string, pending: PendingWatchJob): void {
    if (!this.isPendingCurrent(pending) || this.postActionRetryTimers.has(jobId)) return;
    const attempts = (this.postActionRetries.get(jobId) || 0) + 1;
    if (attempts > WatchService.MAX_POST_ACTION_RETRIES) {
      this.logger.error('Watcher', `AcciÛn posterior agotÛ reintentos: ${pending.filePath}`);
      this.finishPending(jobId, pending.fingerprint);
      return;
    }

    this.postActionRetries.set(jobId, attempts);
    const delay = WatchService.POST_ACTION_RETRY_DELAY_MS * 2 ** (attempts - 1);
    this.logger.warn('Watcher', `Reintentando acciÛn posterior (${attempts}/${WatchService.MAX_POST_ACTION_RETRIES}): ${pending.filePath}`);
    const timer = setTimeout(() => {
      this.postActionRetryTimers.delete(jobId);
      const current = this.pendingJobs.get(jobId);
      if (current && this.isPendingCurrent(current)) void this.completePendingPostAction(jobId, current);
    }, delay);
    this.postActionRetryTimers.set(jobId, timer);
  }

  private async applyPostAction(pending: PendingWatchJob): Promise<void> {
    const { rule, filePath } = pending;
    if (rule.postAction === 'keep') return;
    if (rule.postAction === 'delete') {
      await fs.unlink(filePath);
      this.logger.info('Watcher', `Original eliminado despu√©s de conversi√≥n validada: ${filePath}`);
      return;
    }
    if (rule.postAction === 'move') {
      if (!rule.moveDestination) throw new Error('moveDestination is required for move action');
      await fs.mkdir(rule.moveDestination, { recursive: true });
      const destination = await this.resolveMoveDestination(rule, filePath);
      if (!destination) {
        this.logger.warn('Watcher', `Movimiento omitido porque el destino existe: ${filePath}`);
        return;
      }
      await this.moveFile(filePath, destination, rule.duplicatePolicy === 'overwrite');
      this.logger.info('Watcher', `Original movido despu√©s de conversi√≥n validada`, `${filePath} -> ${destination}`);
    }
  }

  private async resolveMoveDestination(rule: WatcherRule, filePath: string): Promise<string | null> {
    const destinationFolder = rule.moveDestination!;
    const parsed = path.parse(filePath);
    const initial = path.join(destinationFolder, parsed.base);
    if (!(await this.exists(initial))) return initial;
    if (rule.duplicatePolicy === 'skip') return null;
    if (rule.duplicatePolicy === 'overwrite') return initial;
    let counter = 1;
    let candidate: string;
    do {
      candidate = path.join(destinationFolder, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } while (await this.exists(candidate));
    return candidate;
  }

  private finishPending(jobId: string, fingerprint: string): void {
    const timer = this.postActionRetryTimers.get(jobId);
    if (timer) clearTimeout(timer);
    this.postActionRetryTimers.delete(jobId);
    this.postActionRetries.delete(jobId);
    this.pendingJobs.delete(jobId);
    this.pendingFingerprints.delete(fingerprint);
  }

  private async moveFile(source: string, destination: string, overwrite: boolean): Promise<void> {
    const backup = `${destination}.ffconverter-backup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const destinationExists = overwrite && await this.exists(destination);
    if (destinationExists) await fs.rename(destination, backup);

    try {
      await fs.rename(source, destination);
    } catch (error: any) {
      if (error.code === 'EXDEV') {
        const staging = `${destination}.ffconverter-partial-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let published = false;
        try {
          await fs.copyFile(source, staging);
          await fs.rename(staging, destination);
          published = true;
          await fs.unlink(source);
        } catch (copyError) {
          await fs.unlink(staging).catch(() => undefined);
          if (destinationExists) {
            await this.restoreBackup(backup, destination);
          } else if (published) {
            await fs.unlink(destination).catch(() => undefined);
          }
          throw copyError;
        }
      } else {
        if (destinationExists) await this.restoreBackup(backup, destination);
        throw error;
      }
    }

    if (destinationExists) {
      await fs.unlink(backup).catch((error) => {
        this.logger.warn('Watcher', `No fue posible eliminar el respaldo temporal: ${backup}`, error);
      });
    }
  }

  private async restoreBackup(backup: string, destination: string): Promise<void> {
    if (await this.exists(destination)) await fs.unlink(destination);
    await fs.rename(backup, destination);
  }

  private invalidateRulePendingJobs(ruleId: string): void {
    this.ruleGenerations.set(ruleId, this.ruleGeneration(ruleId) + 1);
    for (const [jobId, pending] of this.pendingJobs.entries()) {
      if (pending.rule.id === ruleId) this.finishPending(jobId, pending.fingerprint);
    }
  }

  private isRuleActive(rule: WatcherRule): boolean {
    return !this.stopped && this.activeWatchers.get(rule.id)?.signature === this.signature(rule);
  }

  private ruleGeneration(ruleId: string): number {
    return this.ruleGenerations.get(ruleId) || 0;
  }

  private isPendingCurrent(pending: PendingWatchJob): boolean {
    const serviceMatches = pending.serviceGeneration === undefined || pending.serviceGeneration === this.serviceGeneration;
    const ruleMatches = pending.ruleGeneration === undefined || pending.ruleGeneration === this.ruleGeneration(pending.rule.id);
    const signatureMatches = pending.signature === undefined
      || this.activeWatchers.get(pending.rule.id)?.signature === pending.signature;
    return !this.stopped && serviceMatches && ruleMatches && signatureMatches;
  }

  private fingerprint(ruleId: string, filePath: string, size: number, mtimeMs: number): string {
    const normalizedPath = process.platform === 'win32'
      ? path.resolve(filePath).toLowerCase()
      : path.resolve(filePath);
    return `${ruleId}:${normalizedPath}:${size}:${Math.trunc(mtimeMs)}`;
  }

  private signature(rule: WatcherRule): string {
    return JSON.stringify({
      watchPath: rule.watchPath,
      outputPath: rule.outputPath,
      presetId: rule.presetId,
      enabled: rule.enabled,
      includeSubfolders: rule.includeSubfolders,
      allowedExtensions: rule.allowedExtensions,
      stabilizationSeconds: rule.stabilizationSeconds,
      postAction: rule.postAction,
      moveDestination: rule.moveDestination,
      duplicatePolicy: rule.duplicatePolicy,
      processExisting: rule.processExisting
    });
  }

  private isInside(rootPath: string, candidatePath: string): boolean {
    const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  public stopAll(): void {
    this.stopped = true;
    this.serviceGeneration += 1;
    for (const [jobId, pending] of this.pendingJobs.entries()) this.finishPending(jobId, pending.fingerprint);
    for (const timer of this.postActionRetryTimers.values()) clearTimeout(timer);
    this.postActionRetryTimers.clear();
    this.postActionRetries.clear();
    for (const active of this.activeWatchers.values()) void active.watcher.close();
    this.activeWatchers.clear();
    this.logger.info('Watcher', 'Todos los watchers fueron detenidos.');
  }
}
