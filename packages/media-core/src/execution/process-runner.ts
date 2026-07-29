import { spawn, ChildProcess } from 'child_process';
import EventEmitter from 'events';
import { ProgressEventPayload } from '@ff-converter/shared-types';

export interface ProcessRunnerOptions {
  ffmpegPath: string;
  args: string[];
  jobId: string;
  totalDurationSeconds: number;
  hardwareName?: string;
}

export class ProcessRunner extends EventEmitter {
  private child: ChildProcess | null = null;
  private isCancelled = false;
  private isPaused = false;
  private speedSamples: number[] = [];

  constructor(private options: ProcessRunnerOptions) {
    super();
  }

  public run(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.child = spawn(this.options.ffmpegPath, this.options.args);

      let stdoutBuffer = '';
      let stderrBuffer = '';

      const progressMap: Record<string, string> = {};

      this.child.stdout?.on('data', (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || ''; // Keep incomplete trailing line in buffer

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            progressMap[key] = val;

            if (key === 'progress') {
              this.emitProgress(progressMap);
            }
          }
        });
      });

      this.child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuffer += text;
        for (const line of text.split(/\r?\n/).filter(Boolean)) {
          if (/\b(error|warning|deprecated|invalid|failed)\b/i.test(line)) {
            this.emit('diagnostic', {
              // stderr may contain recoverable decoder errors even when FFmpeg exits
              // successfully. A non-zero process exit is logged as the actual error.
              level: 'warn',
              message: line.slice(0, 1000)
            });
          }
        }
      });

      this.child.on('error', (err) => {
        reject(new Error(`Failed to spawn FFmpeg process: ${err.message}`));
      });

      this.child.on('close', (code) => {
        if (this.isCancelled) {
          return reject(new Error('JOB_CANCELLED'));
        }

        if (code === 0) {
          // Emit final 100% progress
          this.emit('progress', {
            jobId: this.options.jobId,
            status: 'COMPLETED',
            progressPercent: 100,
            processedSeconds: this.options.totalDurationSeconds,
            totalSeconds: this.options.totalDurationSeconds,
            currentFps: 0,
            currentSpeed: 1,
            currentBitrate: 'N/A',
            etaSeconds: 0,
            hardwareUsed: this.options.hardwareName
          } as ProgressEventPayload);

          resolve();
        } else {
          const lastErrLines = stderrBuffer.trim().split('\n').slice(-10).join(' ');
          reject(new Error(`FFmpeg exited with error code ${code}: ${lastErrLines}`));
        }
      });
    });
  }

  public cancel(): void {
    this.isCancelled = true;
    if (this.child) {
      if (this.isPaused && process.platform !== 'win32') this.child.kill('SIGCONT');
      if (process.platform === 'win32' && this.child.pid) {
        spawn('taskkill', ['/pid', String(this.child.pid), '/t', '/f'], { windowsHide: true });
      } else {
        this.child.kill('SIGKILL');
      }
    }
  }

  public pause(): boolean {
    if (!this.child || this.isPaused || process.platform === 'win32') return false;
    const paused = this.child.kill('SIGSTOP');
    if (paused) this.isPaused = true;
    return paused;
  }

  public resume(): boolean {
    if (!this.child || !this.isPaused || process.platform === 'win32') return false;
    const resumed = this.child.kill('SIGCONT');
    if (resumed) this.isPaused = false;
    return resumed;
  }

  private emitProgress(map: Record<string, string>): void {
    const outTimeUs = parseInt(map.out_time_us || '0', 10);
    const processedSeconds = outTimeUs > 0 ? outTimeUs / 1_000_000 : 0;
    const fps = parseFloat(map.fps || '0') || 0;
    const speedStr = (map.speed || '1x').replace('x', '');
    const speed = parseFloat(speedStr) || 1;
    if (speed > 0) {
      this.speedSamples.push(speed);
      if (this.speedSamples.length > 10) this.speedSamples.shift();
    }
    const smoothedSpeed = this.speedSamples.length > 0
      ? this.speedSamples.reduce((sum, sample) => sum + sample, 0) / this.speedSamples.length
      : speed;
    const bitrate = map.bitrate || 'N/A';

    const total = this.options.totalDurationSeconds || 1;
    let percent = Math.min(99.9, Math.max(0, (processedSeconds / total) * 100));
    if (isNaN(percent)) percent = 0;

    const remainingSecs = Math.max(0, total - processedSeconds);
    const etaSeconds = smoothedSpeed > 0 ? Math.round(remainingSecs / smoothedSpeed) : 0;

    const payload: ProgressEventPayload = {
      jobId: this.options.jobId,
      status: 'RUNNING',
      progressPercent: Math.round(percent * 10) / 10,
      processedSeconds: Math.round(processedSeconds),
      totalSeconds: Math.round(total),
      currentFps: Math.round(fps),
      currentSpeed: Math.round(speed * 100) / 100,
      currentBitrate: bitrate,
      etaSeconds,
      hardwareUsed: this.options.hardwareName
    };

    this.emit('progress', payload);
  }
}
