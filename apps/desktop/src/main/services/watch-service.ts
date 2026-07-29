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
}

export class WatchService {
  private activeWatchers = new Map<string, ActiveWatcher>();
  private pendingFingerprints = new Set<string>();
  private pendingJobs = new Map<string, PendingWatchJob>();

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
    for (const [id, active] of this.activeWatchers.entries()) {
      const rule = rules.find(candidate => candidate.id === id);
      const signature = rule ? this.signature(rule) : '';
      if (!rule || !rule.enabled || active.signature !== signature) {
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
    if (filePath.includes('.ffconverter.partial') || this.isInside(rule.outputPath, filePath)) return;
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
        this.logger.info('Watcher', `Archivo marcado como procesado por política skip: ${filePath}`);
        return;
      }
      this.pendingJobs.set(job.id, { rule, filePath, fingerprint });
    } catch (error: any) {
      if (fingerprint) this.pendingFingerprints.delete(fingerprint);
      this.logger.error('Watcher', `No fue posible encolar ${filePath}`, error.message);
    }
  }

  private async handleJobUpdated(job: Job): Promise<void> {
    const pending = this.pendingJobs.get(job.id);
    if (!pending) return;
    if (job.status === 'COMPLETED') {
      this.db.recordProcessedWatcherFile(pending.rule.id, pending.fingerprint, pending.filePath);
      try {
        await this.applyPostAction(pending);
      } catch (error: any) {
        this.logger.error('Watcher', `Falló la acción posterior para ${pending.filePath}`, error.message);
      }
      this.finishPending(job.id, pending.fingerprint);
    } else if (['FAILED', 'CANCELLED', 'SKIPPED'].includes(job.status)) {
      this.finishPending(job.id, pending.fingerprint);
    }
  }

  private async applyPostAction(pending: PendingWatchJob): Promise<void> {
    const { rule, filePath } = pending;
    if (rule.postAction === 'keep') return;
    if (rule.postAction === 'delete') {
      await fs.unlink(filePath);
      this.logger.info('Watcher', `Original eliminado después de conversión validada: ${filePath}`);
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
      try {
        await fs.rename(filePath, destination);
      } catch (error: any) {
        if (error.code !== 'EXDEV') throw error;
        await fs.copyFile(filePath, destination);
        await fs.unlink(filePath);
      }
      this.logger.info('Watcher', `Original movido después de conversión validada`, `${filePath} -> ${destination}`);
    }
  }

  private async resolveMoveDestination(rule: WatcherRule, filePath: string): Promise<string | null> {
    const destinationFolder = rule.moveDestination!;
    const parsed = path.parse(filePath);
    const initial = path.join(destinationFolder, parsed.base);
    if (!(await this.exists(initial))) return initial;
    if (rule.duplicatePolicy === 'skip') return null;
    if (rule.duplicatePolicy === 'overwrite') {
      await fs.unlink(initial);
      return initial;
    }
    let counter = 1;
    let candidate: string;
    do {
      candidate = path.join(destinationFolder, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } while (await this.exists(candidate));
    return candidate;
  }

  private finishPending(jobId: string, fingerprint: string): void {
    this.pendingJobs.delete(jobId);
    this.pendingFingerprints.delete(fingerprint);
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
    for (const active of this.activeWatchers.values()) void active.watcher.close();
    this.activeWatchers.clear();
    this.logger.info('Watcher', 'Todos los watchers fueron detenidos.');
  }
}
