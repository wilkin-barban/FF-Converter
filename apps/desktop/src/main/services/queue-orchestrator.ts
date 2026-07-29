import path from 'path';
import fs from 'fs/promises';
import EventEmitter from 'events';
import { Job, JobStatus, SystemCapabilities, AppSettings, ProgressEventPayload } from '@ff-converter/shared-types';
import {
  MediaInspector,
  PresetResolver,
  CommandBuilder,
  ProcessRunner,
  OutputValidator,
  OutputPathResolver,
  DiskSpaceInspector,
  DuplicatePolicy,
  JobStateMachine
} from '@ff-converter/media-core';
import { resolveConcurrencyLimit } from '@ff-converter/media-core';
import { AppDatabase } from '../database/db';
import { LoggerService } from './logger-service';

export class QueueOrchestrator extends EventEmitter {
  private activeRunners = new Map<string, ProcessRunner>();
  private startingJobs = new Set<string>();
  private isQueuePaused = false;
  private reservedOutputs = new Set<string>();
  private outputPathResolver = new OutputPathResolver();
  private diskSpaceInspector = new DiskSpaceInspector();
  private spaceRetryTimers = new Map<string, NodeJS.Timeout>();
  private stateMachine = new JobStateMachine();
  private cancelledBeforeRunner = new Set<string>();

  constructor(
    private db: AppDatabase,
    private getCapabilities: () => SystemCapabilities,
    private getSettings: () => AppSettings,
    private logger?: LoggerService
  ) {
    super();
    for (const job of this.db.getJobs()) {
      if (['QUEUED', 'RUNNING', 'ANALYZING', 'VALIDATING_OUTPUT', 'WAITING_FOR_SPACE'].includes(job.status)) {
        this.reservedOutputs.add(this.normalizeOutputPath(job.outputPath));
      }
      if (job.status === 'WAITING_FOR_SPACE') this.scheduleSpaceRetry(job.id);
    }
  }

  public async processQueue(): Promise<void> {
    if (this.isQueuePaused) return;

    const settings = this.getSettings();
    const allJobs = this.db.getJobs();
    const automaticLimit = this.calculateAutomaticWorkerLimit(allJobs.filter(job => job.status === 'QUEUED'));
    const maxWorkers = resolveConcurrencyLimit(
      settings.maxConcurrentJobs,
      settings.autoConcurrency,
      automaticLimit
    );

    const occupiedWorkers = new Set([...this.activeRunners.keys(), ...this.startingJobs]).size;
    if (occupiedWorkers >= maxWorkers) {
      return;
    }

    const queuedJobs = allJobs.filter(j => j.status === 'QUEUED');
    queuedJobs.sort((a, b) => b.priority - a.priority);

    const availableSlots = maxWorkers - occupiedWorkers;
    const jobsToStart = queuedJobs.slice(0, availableSlots);

    for (const job of jobsToStart) {
      this.executeJob(job);
    }
  }

  public async addJob(
    inputPath: string,
    outputFolder: string,
    presetId: string,
    priority: number = 0,
    duplicatePolicy?: DuplicatePolicy
  ): Promise<Job> {
    const stat = await fs.stat(inputPath);
    if (stat.isDirectory()) {
      throw new Error(`Cannot add directory path '${inputPath}' as a single job.`);
    }

    const presets = this.db.getPresets();
    const preset = presets.find(p => p.id === presetId) || presets[0];

    const settings = this.getSettings();
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const outputResolution = await this.outputPathResolver.resolve({
      inputPath,
      outputFolder,
      targetContainer: preset.targetContainer,
      duplicatePolicy: duplicatePolicy ?? settings.duplicatePolicy,
      jobId,
      isReserved: (candidatePath) => this.reservedOutputs.has(this.normalizeOutputPath(candidatePath))
    });

    const job: Job = {
      id: jobId,
      inputPath,
      outputPath: outputResolution.finalPath,
      tempPath: outputResolution.tempPath,
      overwriteExisting: outputResolution.overwriteExisting,
      presetId: preset.id,
      presetName: preset.name,
      status: outputResolution.action === 'skip' ? 'SKIPPED' : 'QUEUED',
      priority,
      progressPercent: 0,
      processedSeconds: 0,
      totalSeconds: 0,
      currentFps: 0,
      currentSpeed: 0,
      currentBitrate: '0 kb/s',
      etaSeconds: 0,
      fileSizeBytes: stat.size,
      createdAt: new Date().toISOString(),
      completedAt: outputResolution.action === 'skip' ? new Date().toISOString() : undefined,
      error: outputResolution.action === 'skip' ? 'Skipped because the destination already exists' : undefined
    };

    this.db.saveJob(job);
    this.logger?.info('Queue', `Trabajo creado: ${job.id}`, `${inputPath} -> ${job.outputPath}`);
    this.db.recordJobTransition(job.id, undefined, job.status, outputResolution.action === 'skip'
      ? 'Destination exists and duplicate policy is skip'
      : 'Job created');
    this.emit('job-updated', job);
    if (outputResolution.action === 'skip') return job;
    this.reservedOutputs.add(this.normalizeOutputPath(job.outputPath));
    this.processQueue();
    return job;
  }

  private async executeJob(job: Job): Promise<void> {
    if (this.startingJobs.has(job.id) || this.activeRunners.has(job.id)) return;
    this.startingJobs.add(job.id);
    const caps = this.getCapabilities();
    const settings = this.getSettings();
    const presets = this.db.getPresets();
    const preset = presets.find(p => p.id === job.presetId) || presets[0];

    const inspector = new MediaInspector(caps.ffprobePath);

    try {
      const capacity = await this.diskSpaceInspector.check(path.dirname(job.outputPath), job.fileSizeBytes);
      if (this.cancelledBeforeRunner.has(job.id) || job.status === 'CANCELLED') throw new Error('JOB_CANCELLED');
      if (!capacity.sufficient) {
        job.error = `Insufficient disk space: ${capacity.availableBytes} bytes available, ${capacity.requiredBytes} required`;
        this.transitionJob(job, 'WAITING_FOR_SPACE', job.error);
        this.scheduleSpaceRetry(job.id);
        return;
      }

      // 1. Analyze if snapshot missing
      if (!job.inspectionSnapshot) {
        this.transitionJob(job, 'ANALYZING', 'Inspecting input with FFprobe');
        job.inspectionSnapshot = await inspector.inspect(job.inputPath);
        job.totalSeconds = job.inspectionSnapshot.durationSeconds;
      }
      if (this.cancelledBeforeRunner.has(job.id) || job.status === 'CANCELLING') throw new Error('JOB_CANCELLED');

      // 2. Resolve conversion plan
      const resolver = new PresetResolver();
      const plan = resolver.resolve(preset, job.inspectionSnapshot, caps, settings);
      job.effectivePlan = plan;

      // 3. Build command
      const builder = new CommandBuilder();
      const args = builder.buildFFmpegArgs(job.inputPath, job.tempPath!, plan);

      // 4. Run process
      job.startedAt = job.startedAt || new Date().toISOString();
      job.hardwareUsed = plan.video.encoder;
      job.error = undefined;
      this.transitionJob(job, 'RUNNING', `Started with encoder ${plan.video.encoder}`);

      const runner = new ProcessRunner({
        ffmpegPath: caps.ffmpegPath,
        args,
        jobId: job.id,
        totalDurationSeconds: job.totalSeconds,
        hardwareName: plan.video.encoder
      });

      this.activeRunners.set(job.id, runner);
      this.startingJobs.delete(job.id);
      this.logger?.info('FFmpeg', `Iniciando FFmpeg para ${job.id}`, this.sanitizeCommand(caps.ffmpegPath, args));
      this.attachRunnerDiagnostics(runner, job.id);

      runner.on('progress', (progressPayload: ProgressEventPayload) => {
        job.progressPercent = progressPayload.progressPercent;
        job.processedSeconds = progressPayload.processedSeconds;
        job.currentFps = progressPayload.currentFps;
        job.currentSpeed = progressPayload.currentSpeed;
        job.currentBitrate = progressPayload.currentBitrate;
        job.etaSeconds = progressPayload.etaSeconds;
        this.db.saveJob(job);
        this.emit('job-progress', progressPayload);
      });

      try {
        await runner.run();
      } catch (runErr: any) {
        if (runErr.message === 'JOB_CANCELLED') throw runErr;

        // Automatic GPU -> CPU Fallback if GPU hardware encoder fails
        if (plan.video.encoder.includes('nvenc') || plan.video.encoder.includes('qsv') || plan.video.encoder.includes('amf') || plan.video.encoder.includes('vaapi')) {
          this.logger?.warn('FFmpeg', `Encoder GPU ${plan.video.encoder} falló; se usará CPU.`, runErr.message);
          plan.video.encoder = preset.videoCodec === 'h265' ? 'libx265' : 'libx264';
          job.hardwareUsed = `${plan.video.encoder} (CPU Fallback)`;
          this.db.saveJob(job);
          this.emit('job-updated', job);

          const fallbackArgs = builder.buildFFmpegArgs(job.inputPath, job.tempPath!, plan);
          const fallbackRunner = new ProcessRunner({
            ffmpegPath: caps.ffmpegPath,
            args: fallbackArgs,
            jobId: job.id,
            totalDurationSeconds: job.totalSeconds,
            hardwareName: job.hardwareUsed
          });

          this.activeRunners.set(job.id, fallbackRunner);
          this.startingJobs.delete(job.id);
          this.attachRunnerDiagnostics(fallbackRunner, job.id);
          this.logger?.info('FFmpeg', `Reintentando ${job.id} con CPU.`, this.sanitizeCommand(caps.ffmpegPath, fallbackArgs));
          fallbackRunner.on('progress', (progressPayload: ProgressEventPayload) => {
            job.progressPercent = progressPayload.progressPercent;
            job.processedSeconds = progressPayload.processedSeconds;
            job.currentFps = progressPayload.currentFps;
            job.currentSpeed = progressPayload.currentSpeed;
            job.currentBitrate = progressPayload.currentBitrate;
            job.etaSeconds = progressPayload.etaSeconds;
            this.db.saveJob(job);
            this.emit('job-progress', progressPayload);
          });

          await fallbackRunner.run();
        } else {
          throw runErr;
        }
      }

      // 5. Output Validation & Atomic Rename
      this.transitionJob(job, 'VALIDATING_OUTPUT', 'FFmpeg exited successfully');

      const validator = new OutputValidator(inspector);
      const valResult = await validator.validateAndFinalize(job.tempPath!, job.outputPath, {
        expectedDurationSeconds: job.totalSeconds,
        sourceSnapshot: job.inspectionSnapshot,
        plan,
        overwriteExisting: Boolean(job.overwriteExisting)
      });

      if (!valResult.success) {
        throw new Error(valResult.error);
      }

      const stat = await fs.stat(job.outputPath);
      job.outputSizeBytes = stat.size;
      job.completedAt = new Date().toISOString();
      job.progressPercent = 100;
      job.etaSeconds = 0;
      this.transitionJob(job, 'COMPLETED', 'Output validated and finalized');
    } catch (err: any) {
      if (err.message === 'JOB_CANCELLED') {
        if (job.status !== 'CANCELLED') {
          if (job.status !== 'CANCELLING') this.transitionJob(job, 'CANCELLING', 'Cancellation requested');
          this.transitionJob(job, 'CANCELLED', 'Job execution terminated');
        }
      } else {
        job.error = err.message || 'Unknown execution error';
        this.transitionJob(job, 'FAILED', job.error);
      }
      // Clean up partial temp file if configured
      if (job.tempPath && !settings.keepTempFilesOnFailure) {
        try { await fs.unlink(job.tempPath); } catch (_) {}
      }
    } finally {
      this.startingJobs.delete(job.id);
      this.cancelledBeforeRunner.delete(job.id);
      this.activeRunners.delete(job.id);
      if (job.status !== 'WAITING_FOR_SPACE') {
        this.reservedOutputs.delete(this.normalizeOutputPath(job.outputPath));
      }
      this.db.saveJob(job);
      this.processQueue();
    }
  }

  public cancelJob(jobId: string): void {
    const runner = this.activeRunners.get(jobId);
    const job = this.db.getJobs().find(j => j.id === jobId);
    if (runner) {
      if (job && job.status !== 'CANCELLING') this.transitionJob(job, 'CANCELLING', 'Cancellation requested by user');
      runner.cancel();
    } else {
      if (job && job.status === 'ANALYZING') {
        this.cancelledBeforeRunner.add(job.id);
        this.transitionJob(job, 'CANCELLING', 'Cancellation requested during analysis');
      } else if (job && ['QUEUED', 'WAITING_FOR_SPACE', 'INTERRUPTED'].includes(job.status)) {
        this.cancelledBeforeRunner.add(job.id);
        const timer = this.spaceRetryTimers.get(job.id);
        if (timer) clearTimeout(timer);
        this.spaceRetryTimers.delete(job.id);
        this.transitionJob(job, 'CANCELLED', 'Cancelled before execution');
        this.reservedOutputs.delete(this.normalizeOutputPath(job.outputPath));
      }
    }
  }

  public async retryJob(jobId: string): Promise<boolean> {
    const job = this.db.getJobs().find(j => j.id === jobId);
    if (!job) return false;
    const stat = await fs.stat(job.inputPath).catch(() => null);
    if (!stat?.isFile()) {
      job.error = 'La entrada ya no existe o no es un archivo multimedia. Elimina este trabajo y vuelve a agregar el archivo correcto.';
      this.db.saveJob(job);
      this.emit('job-updated', job);
      return false;
    }
    job.progressPercent = 0;
    job.processedSeconds = 0;
    job.error = undefined;
    this.reservedOutputs.add(this.normalizeOutputPath(job.outputPath));
    this.transitionJob(job, 'QUEUED', 'Retry requested by user');
    this.processQueue();
    return true;
  }

  public removeJob(jobId: string): boolean {
    const job = this.db.getJobs().find(candidate => candidate.id === jobId);
    if (!job) return false;
    if (this.activeRunners.has(jobId) || this.startingJobs.has(jobId) ||
      ['RUNNING', 'ANALYZING', 'VALIDATING_OUTPUT', 'CANCELLING', 'PAUSED'].includes(job.status)) {
      throw new Error('Cancela el trabajo activo antes de eliminarlo.');
    }
    const timer = this.spaceRetryTimers.get(jobId);
    if (timer) clearTimeout(timer);
    this.spaceRetryTimers.delete(jobId);
    this.cancelledBeforeRunner.delete(jobId);
    this.reservedOutputs.delete(this.normalizeOutputPath(job.outputPath));
    this.db.deleteJob(jobId);
    this.logger?.info('Queue', `Trabajo eliminado: ${jobId}`);
    this.emit('job-removed', { id: jobId });
    this.processQueue();
    return true;
  }

  public pauseQueue(): void {
    this.isQueuePaused = true;
    this.emit('queue-status', { paused: true });
  }

  public resumeQueue(): void {
    this.isQueuePaused = false;
    this.emit('queue-status', { paused: false });
    this.processQueue();
  }

  public pauseJob(jobId: string): boolean {
    const runner = this.activeRunners.get(jobId);
    const job = this.db.getJobs().find(candidate => candidate.id === jobId);
    if (!runner || !job || job.status !== 'RUNNING' || !runner.pause()) return false;
    this.transitionJob(job, 'PAUSED', 'Process suspended by user');
    return true;
  }

  public resumeJob(jobId: string): boolean {
    const runner = this.activeRunners.get(jobId);
    const job = this.db.getJobs().find(candidate => candidate.id === jobId);
    if (!runner || !job || job.status !== 'PAUSED' || !runner.resume()) return false;
    this.transitionJob(job, 'RUNNING', 'Process resumed by user');
    return true;
  }

  public setJobPriority(jobId: string, priority: number): Job {
    const job = this.db.getJobs().find(candidate => candidate.id === jobId);
    if (!job) throw new Error('Job not found');
    if (!['QUEUED', 'WAITING_FOR_SPACE', 'INTERRUPTED'].includes(job.status)) {
      throw new Error('Priority can only be changed for pending jobs');
    }
    job.priority = Math.max(-1000, Math.min(1000, Math.trunc(priority)));
    this.db.saveJob(job);
    this.emit('job-updated', job);
    return job;
  }

  public async retryFailedAndInterrupted(): Promise<number> {
    let count = 0;
    for (const job of this.db.getJobs()) {
      if (!['FAILED', 'INTERRUPTED', 'CANCELLED'].includes(job.status)) continue;
      try {
        const stat = await fs.stat(job.inputPath);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
      if (await this.retryJob(job.id)) count += 1;
    }
    return count;
  }

  private normalizeOutputPath(outputPath: string): string {
    const resolved = path.resolve(outputPath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  private scheduleSpaceRetry(jobId: string): void {
    if (this.spaceRetryTimers.has(jobId)) return;
    const timer = setTimeout(() => {
      this.spaceRetryTimers.delete(jobId);
      const job = this.db.getJobs().find((candidate) => candidate.id === jobId);
      if (job?.status === 'WAITING_FOR_SPACE') {
        this.transitionJob(job, 'QUEUED', 'Retrying disk capacity check');
        this.processQueue();
      }
    }, 30_000);
    this.spaceRetryTimers.set(jobId, timer);
  }

  private transitionJob(job: Job, toStatus: JobStatus, reason?: string): void {
    const fromStatus = job.status;
    this.stateMachine.assertTransition(fromStatus, toStatus);
    job.status = toStatus;
    this.db.saveJob(job);
    if (fromStatus !== toStatus) {
      this.db.recordJobTransition(job.id, fromStatus, toStatus, reason);
    }
    this.emit('job-updated', job);
  }

  private calculateAutomaticWorkerLimit(queuedJobs: Job[]): number {
    if (queuedJobs.length === 0) return 1;
    const presets = this.db.getPresets();
    const queuedPresets = queuedJobs
      .map(job => presets.find(preset => preset.id === job.presetId))
      .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset));
    const allLightweight = queuedPresets.length > 0 && queuedPresets.every(
      preset => preset.videoCodec === 'none' || preset.videoCodec === 'copy'
    );
    if (allLightweight) return 4;

    const hasHardwareEncoder = this.getCapabilities().hardwareEncoders.some(
      encoder => encoder.available && encoder.type !== 'cpu'
    );
    if (hasHardwareEncoder) return 3;

    return Math.min(2, Math.max(1, Math.floor(this.getCapabilities().availableCpuCores / 2)));
  }

  private attachRunnerDiagnostics(runner: ProcessRunner, jobId: string): void {
    let diagnosticCount = 0;
    runner.on('diagnostic', (diagnostic: { level: 'warn' | 'error'; message: string }) => {
      if (diagnosticCount >= 20) return;
      diagnosticCount += 1;
      this.logger?.log(diagnostic.level, 'FFmpeg', `${jobId}: ${diagnostic.message}`);
    });
  }

  private sanitizeCommand(executable: string, args: string[]): string {
    return [executable, ...args].map(argument => JSON.stringify(argument)).join(' ');
  }
}
