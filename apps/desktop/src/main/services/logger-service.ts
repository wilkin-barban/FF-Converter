import EventEmitter from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LogEntry, LogLevel, LogSource } from '@ff-converter/shared-types';

export interface LoggerServiceOptions {
  logDirectory?: string;
  maxBufferLength?: number;
  maxFileSizeBytes?: number;
  retainedFiles?: number;
}

export class LoggerService extends EventEmitter {
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferLength: number;
  private readonly maxFileSizeBytes: number;
  private readonly retainedFiles: number;
  private readonly logDirectory?: string;
  private readonly logFilePath?: string;

  constructor(options: LoggerServiceOptions = {}) {
    super();
    this.maxBufferLength = options.maxBufferLength ?? 1000;
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 5 * 1024 * 1024;
    this.retainedFiles = options.retainedFiles ?? 3;
    this.logDirectory = options.logDirectory;
    this.logFilePath = options.logDirectory ? path.join(options.logDirectory, 'ff-converter.log.jsonl') : undefined;
    if (this.logDirectory && this.logFilePath) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
      this.loadPersistedLogs();
    }
  }

  public log(level: LogLevel, source: LogSource, message: string, details?: string): LogEntry {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message: this.sanitize(message),
      details: details ? this.sanitize(details) : undefined
    };

    this.logBuffer.unshift(entry);
    if (this.logBuffer.length > this.maxBufferLength) this.logBuffer.pop();
    this.persist(entry);

    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] [${source}] ${entry.message}`);
    if (entry.details) console.log(`  Details: ${entry.details}`);

    this.emit('log', entry);
    return entry;
  }

  public info(source: LogSource, message: string, details?: string) {
    return this.log('info', source, message, details);
  }

  public warn(source: LogSource, message: string, details?: string) {
    return this.log('warn', source, message, details);
  }

  public error(source: LogSource, message: string, details?: string) {
    return this.log('error', source, message, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  public getLogFilePath(): string | null {
    return this.logFilePath ?? null;
  }

  public exportLogs(destinationPath: string): void {
    const contents = this.logBuffer
      .slice()
      .reverse()
      .map(entry => JSON.stringify(entry))
      .join(os.EOL);
    fs.writeFileSync(destinationPath, contents ? `${contents}${os.EOL}` : '', 'utf8');
  }

  public clearLogs(): void {
    this.logBuffer = [];
    if (this.logFilePath) fs.writeFileSync(this.logFilePath, '', 'utf8');
    this.emit('cleared');
  }

  private persist(entry: LogEntry): void {
    if (!this.logFilePath) return;
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}${os.EOL}`, 'utf8');
    } catch (error) {
      console.error('Failed to persist log entry:', error);
    }
  }

  private rotateIfNeeded(): void {
    if (!this.logFilePath || !fs.existsSync(this.logFilePath)) return;
    if (fs.statSync(this.logFilePath).size < this.maxFileSizeBytes) return;
    const oldest = `${this.logFilePath}.${this.retainedFiles}`;
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
    for (let index = this.retainedFiles - 1; index >= 1; index -= 1) {
      const source = `${this.logFilePath}.${index}`;
      const destination = `${this.logFilePath}.${index + 1}`;
      if (fs.existsSync(source)) fs.renameSync(source, destination);
    }
    fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
  }

  private loadPersistedLogs(): void {
    if (!this.logFilePath || !fs.existsSync(this.logFilePath)) return;
    try {
      const lines = fs.readFileSync(this.logFilePath, 'utf8').split(/\r?\n/).filter(Boolean);
      const entries: LogEntry[] = [];
      for (const line of lines.slice(-this.maxBufferLength)) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Ignore a single truncated/corrupt line and preserve the rest of the log.
        }
      }
      this.logBuffer = entries.reverse();
    } catch (error) {
      console.error('Failed to load persisted logs:', error);
    }
  }

  private sanitize(value: string): string {
    let sanitized = String(value);
    const homeDirectory = os.homedir();
    if (homeDirectory) {
      sanitized = sanitized.split(homeDirectory).join('%USER_HOME%');
      sanitized = sanitized.split(homeDirectory.replace(/\\/g, '/')).join('%USER_HOME%');
    }
    sanitized = sanitized.replace(/([a-z]+:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, '$1***:***@');
    return sanitized;
  }
}
