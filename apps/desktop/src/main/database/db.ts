import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Job, Preset, WatcherRule, AppSettings, JobStatus, JobTransition } from '@ff-converter/shared-types';
import { SYSTEM_PRESETS } from '@ff-converter/preset-catalog';
import { LoggerService } from '../services/logger-service';

export class AppDatabase {
  private dbPath: string;
  private db: any = null;
  private fallbackStore: {
    jobs: Job[];
    presets: Preset[];
    watchers: WatcherRule[];
    settings: AppSettings;
    transitions: JobTransition[];
    processedWatcherFiles: Array<{ ruleId: string; fingerprint: string; filePath: string; processedAt: string }>;
  };

  constructor(private readonly logger?: LoggerService) {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.dbPath = path.join(userDataPath, 'ff-converter.db');
    this.fallbackStore = {
      jobs: [],
      presets: [...SYSTEM_PRESETS],
      watchers: [],
      transitions: [],
      processedWatcherFiles: [],
      settings: {
        maxConcurrentJobs: 2,
        autoConcurrency: true,
        preferredHardware: 'auto',
        ffmpegPathMode: 'bundled',
        duplicatePolicy: 'suffix',
        theme: 'dark',
        language: 'es',
        autoStartWatchers: true,
        keepTempFilesOnFailure: false,
        desktopNotifications: false,
      }
    };

    this.initDatabase();
  }

  private initDatabase() {
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.createTables();
      this.seedDefaults();
    } catch (e) {
      this.logger?.warn('Database', 'SQLite no está disponible; se utilizará el fallback JSON.', String(e));
      this.loadFallbackFile();
      this.seedDefaults();
    }
  }

  private createTables() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        input_path TEXT NOT NULL,
        output_path TEXT NOT NULL,
        temp_path TEXT,
        overwrite_existing INTEGER DEFAULT 0,
        preset_id TEXT NOT NULL,
        preset_name TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        progress_percent REAL DEFAULT 0,
        processed_seconds REAL DEFAULT 0,
        total_seconds REAL DEFAULT 0,
        current_fps REAL DEFAULT 0,
        current_speed REAL DEFAULT 0,
        current_bitrate TEXT,
        eta_seconds INTEGER DEFAULT 0,
        file_size_bytes INTEGER DEFAULT 0,
        output_size_bytes INTEGER,
        error TEXT,
        inspection_snapshot TEXT,
        effective_plan TEXT,
        hardware_used TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        is_system INTEGER DEFAULT 0,
        data TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS watchers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        watch_path TEXT NOT NULL,
        output_path TEXT NOT NULL,
        preset_id TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        data TEXT NOT NULL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_transitions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_transitions_job_id
        ON job_transitions(job_id, created_at);

      CREATE TABLE IF NOT EXISTS watcher_processed_files (
        rule_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        file_path TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        PRIMARY KEY (rule_id, fingerprint)
      );
    `);

    const jobColumns = this.db.prepare('PRAGMA table_info(jobs)').all().map((column: any) => column.name);
    if (!jobColumns.includes('overwrite_existing')) {
      this.db.exec('ALTER TABLE jobs ADD COLUMN overwrite_existing INTEGER DEFAULT 0');
    }
  }

  private seedDefaults() {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO presets (id, name, description, category, is_system, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          description=excluded.description,
          category=excluded.category,
          is_system=1,
          data=excluded.data,
          updated_at=excluded.updated_at
      `);
      SYSTEM_PRESETS.forEach(p => {
        const now = new Date().toISOString();
        stmt.run(p.id, p.name, p.description, p.category, JSON.stringify(p), now, now);
      });
    } else {
      const customPresets = this.fallbackStore.presets.filter(preset => !preset.isSystem);
      this.fallbackStore.presets = [...SYSTEM_PRESETS, ...customPresets];
    }
  }

  private loadFallbackFile() {
    const jsonPath = path.join(path.dirname(this.dbPath), 'store.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        this.fallbackStore = {
          ...this.fallbackStore,
          ...data,
          transitions: Array.isArray(data.transitions) ? data.transitions : []
          ,
          processedWatcherFiles: Array.isArray(data.processedWatcherFiles) ? data.processedWatcherFiles : []
        };
      } catch (err) {
        this.logger?.error('Database', 'No fue posible leer store.json.', String(err));
      }
    }
  }

  private saveFallbackFile() {
    const jsonPath = path.join(path.dirname(this.dbPath), 'store.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.fallbackStore, null, 2), 'utf-8');
  }

  // --- Job Operations ---

  public saveJob(job: Job) {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO jobs (
          id, input_path, output_path, temp_path, overwrite_existing, preset_id, preset_name, status, priority,
          progress_percent, processed_seconds, total_seconds, current_fps, current_speed, current_bitrate,
          eta_seconds, file_size_bytes, output_size_bytes, error, inspection_snapshot, effective_plan,
          hardware_used, created_at, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status,
          priority=excluded.priority,
          progress_percent=excluded.progress_percent,
          processed_seconds=excluded.processed_seconds,
          total_seconds=excluded.total_seconds,
          current_fps=excluded.current_fps,
          current_speed=excluded.current_speed,
          current_bitrate=excluded.current_bitrate,
          eta_seconds=excluded.eta_seconds,
          overwrite_existing=excluded.overwrite_existing,
          output_size_bytes=excluded.output_size_bytes,
          error=excluded.error,
          inspection_snapshot=excluded.inspection_snapshot,
          effective_plan=excluded.effective_plan,
          hardware_used=excluded.hardware_used,
          started_at=excluded.started_at,
          completed_at=excluded.completed_at
      `);
      stmt.run(
        job.id, job.inputPath, job.outputPath, job.tempPath || null, job.overwriteExisting ? 1 : 0, job.presetId, job.presetName,
        job.status, job.priority, job.progressPercent, job.processedSeconds, job.totalSeconds,
        job.currentFps, job.currentSpeed, job.currentBitrate, job.etaSeconds, job.fileSizeBytes,
        job.outputSizeBytes || null, job.error || null,
        job.inspectionSnapshot ? JSON.stringify(job.inspectionSnapshot) : null,
        job.effectivePlan ? JSON.stringify(job.effectivePlan) : null,
        job.hardwareUsed || null, job.createdAt, job.startedAt || null, job.completedAt || null
      );
    } else {
      const idx = this.fallbackStore.jobs.findIndex(j => j.id === job.id);
      if (idx !== -1) {
        this.fallbackStore.jobs[idx] = { ...job };
      } else {
        this.fallbackStore.jobs.push({ ...job });
      }
      this.saveFallbackFile();
    }
  }

  public getJobs(): Job[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
      return rows.map((r: any) => ({
        id: r.id,
        inputPath: r.input_path,
        outputPath: r.output_path,
        tempPath: r.temp_path,
        overwriteExisting: Boolean(r.overwrite_existing),
        presetId: r.preset_id,
        presetName: r.preset_name,
        status: r.status,
        priority: r.priority,
        progressPercent: r.progress_percent,
        processedSeconds: r.processed_seconds,
        totalSeconds: r.total_seconds,
        currentFps: r.current_fps,
        currentSpeed: r.current_speed,
        currentBitrate: r.current_bitrate,
        etaSeconds: r.eta_seconds,
        fileSizeBytes: r.file_size_bytes,
        outputSizeBytes: r.output_size_bytes,
        error: r.error,
        inspectionSnapshot: r.inspection_snapshot ? JSON.parse(r.inspection_snapshot) : undefined,
        effectivePlan: r.effective_plan ? JSON.parse(r.effective_plan) : undefined,
        hardwareUsed: r.hardware_used,
        createdAt: r.created_at,
        startedAt: r.started_at,
        completedAt: r.completed_at
      }));
    }
    return this.fallbackStore.jobs.map(j => ({ ...j }));
  }

  public recordJobTransition(jobId: string, fromStatus: JobStatus | undefined, toStatus: JobStatus, reason?: string): JobTransition {
    const transition: JobTransition = {
      id: `transition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      jobId,
      fromStatus,
      toStatus,
      reason,
      createdAt: new Date().toISOString()
    };
    if (this.db) {
      this.db.prepare(`
        INSERT INTO job_transitions (id, job_id, from_status, to_status, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        transition.id,
        transition.jobId,
        transition.fromStatus || null,
        transition.toStatus,
        transition.reason || null,
        transition.createdAt
      );
    } else {
      this.fallbackStore.transitions.push(transition);
      this.saveFallbackFile();
    }
    return transition;
  }

  public getJobTransitions(jobId: string): JobTransition[] {
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT id, job_id, from_status, to_status, reason, created_at
        FROM job_transitions WHERE job_id = ? ORDER BY created_at ASC
      `).all(jobId);
      return rows.map((row: any) => ({
        id: row.id,
        jobId: row.job_id,
        fromStatus: row.from_status || undefined,
        toStatus: row.to_status,
        reason: row.reason || undefined,
        createdAt: row.created_at
      }));
    }
    return this.fallbackStore.transitions.filter((transition) => transition.jobId === jobId);
  }

  public recoverInterruptedJobs(): Job[] {
    const recoverable = new Set<JobStatus>(['RUNNING', 'ANALYZING', 'VALIDATING_OUTPUT', 'PAUSED', 'CANCELLING']);
    const recovered: Job[] = [];
    for (const job of this.getJobs()) {
      if (!recoverable.has(job.status)) continue;
      const previousStatus = job.status;
      job.status = 'INTERRUPTED';
      job.error = `Application stopped while job was ${previousStatus}`;
      this.saveJob(job);
      this.recordJobTransition(job.id, previousStatus, 'INTERRUPTED', 'Recovered during application startup');
      recovered.push(job);
    }
    return recovered;
  }

  public deleteJob(id: string) {
    if (this.db) {
      this.db.prepare('DELETE FROM job_transitions WHERE job_id = ?').run(id);
      this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    } else {
      this.fallbackStore.jobs = this.fallbackStore.jobs.filter(j => j.id !== id);
      this.fallbackStore.transitions = this.fallbackStore.transitions.filter(t => t.jobId !== id);
      this.saveFallbackFile();
    }
  }

  // --- Presets ---

  public getPresets(): Preset[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT data FROM presets').all();
      return rows.map((r: any) => JSON.parse(r.data));
    }
    return this.fallbackStore.presets;
  }

  public savePreset(preset: Preset) {
    if (this.db) {
      this.db.prepare(`
        INSERT INTO presets (id, name, description, category, is_system, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, description=excluded.description, data=excluded.data, updated_at=excluded.updated_at
      `).run(
        preset.id, preset.name, preset.description, preset.category, preset.isSystem ? 1 : 0,
        JSON.stringify(preset), new Date().toISOString()
      );
    } else {
      const idx = this.fallbackStore.presets.findIndex(p => p.id === preset.id);
      if (idx !== -1) {
        this.fallbackStore.presets[idx] = preset;
      } else {
        this.fallbackStore.presets.push(preset);
      }
      this.saveFallbackFile();
    }
  }

  public deletePreset(id: string) {
    if (this.db) {
      this.db.prepare('DELETE FROM presets WHERE id = ? AND is_system = 0').run(id);
    } else {
      this.fallbackStore.presets = this.fallbackStore.presets.filter(p => p.id !== id || !p.isSystem);
      this.saveFallbackFile();
    }
  }

  // --- Watchers ---

  public getWatchers(): WatcherRule[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT data FROM watchers').all();
      return rows.map((r: any) => JSON.parse(r.data));
    }
    return this.fallbackStore.watchers;
  }

  public saveWatcher(watcher: WatcherRule) {
    if (this.db) {
      this.db.prepare(`
        INSERT INTO watchers (id, name, watch_path, output_path, preset_id, enabled, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, watch_path=excluded.watch_path, output_path=excluded.output_path,
          preset_id=excluded.preset_id, enabled=excluded.enabled, data=excluded.data
      `).run(
        watcher.id, watcher.name, watcher.watchPath, watcher.outputPath, watcher.presetId,
        watcher.enabled ? 1 : 0, JSON.stringify(watcher), watcher.createdAt
      );
    } else {
      const idx = this.fallbackStore.watchers.findIndex(w => w.id === watcher.id);
      if (idx !== -1) {
        this.fallbackStore.watchers[idx] = watcher;
      } else {
        this.fallbackStore.watchers.push(watcher);
      }
      this.saveFallbackFile();
    }
  }

  public deleteWatcher(id: string) {
    if (this.db) {
      this.db.prepare('DELETE FROM watcher_processed_files WHERE rule_id = ?').run(id);
      this.db.prepare('DELETE FROM watchers WHERE id = ?').run(id);
    } else {
      this.fallbackStore.watchers = this.fallbackStore.watchers.filter(w => w.id !== id);
      this.fallbackStore.processedWatcherFiles = this.fallbackStore.processedWatcherFiles.filter(item => item.ruleId !== id);
      this.saveFallbackFile();
    }
  }

  public hasProcessedWatcherFile(ruleId: string, fingerprint: string): boolean {
    if (this.db) {
      return Boolean(this.db.prepare(
        'SELECT 1 FROM watcher_processed_files WHERE rule_id = ? AND fingerprint = ?'
      ).get(ruleId, fingerprint));
    }
    return this.fallbackStore.processedWatcherFiles.some(
      item => item.ruleId === ruleId && item.fingerprint === fingerprint
    );
  }

  public recordProcessedWatcherFile(ruleId: string, fingerprint: string, filePath: string): void {
    const processedAt = new Date().toISOString();
    if (this.db) {
      this.db.prepare(`
        INSERT INTO watcher_processed_files (rule_id, fingerprint, file_path, processed_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(rule_id, fingerprint) DO UPDATE SET
          file_path=excluded.file_path,
          processed_at=excluded.processed_at
      `).run(ruleId, fingerprint, filePath, processedAt);
    } else {
      const existing = this.fallbackStore.processedWatcherFiles.find(
        item => item.ruleId === ruleId && item.fingerprint === fingerprint
      );
      if (existing) {
        existing.filePath = filePath;
        existing.processedAt = processedAt;
      } else {
        this.fallbackStore.processedWatcherFiles.push({ ruleId, fingerprint, filePath, processedAt });
      }
      this.saveFallbackFile();
    }
  }

  // --- Settings ---

  public getSettings(): AppSettings {
    if (this.db) {
      const row = this.db.prepare("SELECT value FROM settings WHERE key = 'app_settings'").get();
      if (row) {
        return JSON.parse(row.value);
      }
    }
    return this.fallbackStore.settings;
  }

  public saveSettings(settings: AppSettings) {
    if (this.db) {
      this.db.prepare("INSERT INTO settings (key, value) VALUES ('app_settings', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run(JSON.stringify(settings));
    } else {
      this.fallbackStore.settings = settings;
      this.saveFallbackFile();
    }
  }
}
