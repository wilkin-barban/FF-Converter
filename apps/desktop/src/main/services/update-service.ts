import type { ProgressInfo, UpdateInfo } from 'electron-updater';

export type UpdateAction = 'download' | 'open-release';

export interface UpdateAvailablePayload {
  version: string;
  releaseNotes?: string;
  action: UpdateAction;
}

export interface UpdateProgressPayload {
  percent: number;
}

interface UpdateLogger {
  info(component: string, message: string, details?: unknown): void;
  warn(component: string, message: string, details?: unknown): void;
  error(component: string, message: string, details?: unknown): void;
}

export interface UpdaterAdapter {
  autoDownload: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateServiceOptions {
  updater: UpdaterAdapter;
  appVersion: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  isAppImage: boolean;
  openExternal(url: string): Promise<void>;
  emit(channel: string, payload?: unknown): void;
  logger: UpdateLogger;
  delayMs?: number;
  releaseUrl: string;
}

function compareVersions(left: string, right: string): number {
  const toParts = (version: string) => version.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const leftParts = toParts(left);
  const rightParts = toParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export class UpdateService {
  private readonly delayMs: number;

  constructor(private readonly options: UpdateServiceOptions) {
    this.delayMs = options.delayMs ?? 2_500;
    options.updater.autoDownload = false;
    this.bindUpdaterEvents();
  }

  async start(): Promise<void> {
    if (!this.options.isPackaged) {
      this.options.logger.info('updates', 'Skipping update check outside packaged builds');
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));

    try {
      await this.options.updater.checkForUpdates();
    } catch (error) {
      this.options.logger.warn('updates', 'Unable to check for updates', error);
    }
  }

  async downloadOrOpenRelease(): Promise<void> {
    try {
      if (this.usesExternalReleasePage()) {
        await this.options.openExternal(this.options.releaseUrl);
        return;
      }

      await this.options.updater.downloadUpdate();
    } catch (error) {
      this.options.logger.warn('updates', 'Unable to download update', error);
      this.options.emit('events:update-error');
    }
  }

  install(): void {
    if (this.usesExternalReleasePage()) return;


    this.options.updater.quitAndInstall();
  }

  private bindUpdaterEvents(): void {
    this.options.updater.on('update-available', (info: UpdateInfo) => {
      if (compareVersions(info.version, this.options.appVersion) <= 0) return;

      const payload: UpdateAvailablePayload = {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        action: this.usesExternalReleasePage() ? 'open-release' : 'download'
      };
      this.options.emit('events:update-available', payload);
    });

    this.options.updater.on('download-progress', (progress: ProgressInfo) => {
      this.options.emit('events:update-progress', { percent: Math.round(progress.percent) } satisfies UpdateProgressPayload);
    });

    this.options.updater.on('update-downloaded', () => {
      this.options.emit('events:update-downloaded');
    });

    this.options.updater.on('error', (error: Error) => {
      this.options.logger.warn('updates', 'Updater reported an error', error);
      this.options.emit('events:update-error');
    });
  }

  private usesExternalReleasePage(): boolean {
    return this.options.platform === 'linux' && !this.options.isAppImage;
  }
}