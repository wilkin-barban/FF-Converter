import fs from 'fs';
import path from 'path';
import { AppSettings } from '@ff-converter/shared-types';

export type FFmpegPathMode = AppSettings['ffmpegPathMode'];

export interface FFmpegResolution {
  ffmpegPath: string;
  ffprobePath: string;
  requestedMode: FFmpegPathMode;
  effectiveMode: FFmpegPathMode;
  fallbackReason?: string;
}

export interface FFmpegLocatorOptions {
  appPath: string;
  resourcesPath: string;
  isPackaged: boolean;
  platform?: NodeJS.Platform;
  architecture?: string;
  environmentPath?: string;
  pathExtensions?: string;
}

export class FFmpegLocator {
  private readonly platform: NodeJS.Platform;
  private readonly architecture: string;

  constructor(private readonly options: FFmpegLocatorOptions) {
    this.platform = options.platform ?? process.platform;
    this.architecture = options.architecture ?? process.arch;
  }

  public resolve(settings: AppSettings): FFmpegResolution {
    if (settings.ffmpegPathMode === 'custom') {
      return this.resolveCustom(settings);
    }
    if (settings.ffmpegPathMode === 'system') {
      return this.resolveSystem('system');
    }

    const bundled = this.getBundledPaths();
    if (this.isUsableFile(bundled.ffmpegPath) && this.isUsableFile(bundled.ffprobePath)) {
      return {
        ...bundled,
        requestedMode: 'bundled',
        effectiveMode: 'bundled'
      };
    }

    const system = this.resolveSystem('bundled');
    return {
      ...system,
      requestedMode: 'bundled',
      fallbackReason: `Bundled FFmpeg binaries were not found for ${this.platform}-${this.architecture}; using PATH`
    };
  }

  public getBundledPaths(): Pick<FFmpegResolution, 'ffmpegPath' | 'ffprobePath'> {
    const platformFolder = `${this.platform}-${this.architecture}`;
    const binarySuffix = this.platform === 'win32' ? '.exe' : '';
    const basePath = this.options.isPackaged
      ? path.join(this.options.resourcesPath, 'ffmpeg', platformFolder)
      : path.resolve(this.options.appPath, '..', '..', 'resources', 'ffmpeg', platformFolder);

    return {
      ffmpegPath: path.join(basePath, `ffmpeg${binarySuffix}`),
      ffprobePath: path.join(basePath, `ffprobe${binarySuffix}`)
    };
  }

  private resolveCustom(settings: AppSettings): FFmpegResolution {
    if (!settings.customFFmpegPath || !settings.customFFprobePath) {
      throw new Error('Custom mode requires both FFmpeg and FFprobe paths');
    }
    const ffmpegPath = path.resolve(settings.customFFmpegPath);
    const ffprobePath = path.resolve(settings.customFFprobePath);
    if (!this.isUsableFile(ffmpegPath)) throw new Error(`Custom FFmpeg is not executable: ${ffmpegPath}`);
    if (!this.isUsableFile(ffprobePath)) throw new Error(`Custom FFprobe is not executable: ${ffprobePath}`);
    return {
      ffmpegPath,
      ffprobePath,
      requestedMode: 'custom',
      effectiveMode: 'custom'
    };
  }

  private resolveSystem(requestedMode: FFmpegPathMode): FFmpegResolution {
    const ffmpegPath = this.findOnPath('ffmpeg');
    const ffprobePath = this.findOnPath('ffprobe');
    if (!ffmpegPath || !ffprobePath) {
      throw new Error('FFmpeg and FFprobe were not found in PATH');
    }
    return {
      ffmpegPath,
      ffprobePath,
      requestedMode,
      effectiveMode: 'system'
    };
  }

  private findOnPath(binaryName: string): string | null {
    const environmentPath = this.options.environmentPath ?? process.env.PATH ?? '';
    const extensions = this.platform === 'win32'
      ? (this.options.pathExtensions ?? process.env.PATHEXT ?? '.EXE;.CMD;.BAT')
          .split(';')
          .filter(Boolean)
      : [''];

    for (const directory of environmentPath.split(path.delimiter).filter(Boolean)) {
      for (const extension of extensions) {
        const candidate = path.join(directory, `${binaryName}${extension.toLowerCase()}`);
        if (this.isUsableFile(candidate)) return path.resolve(candidate);
        const originalCaseCandidate = path.join(directory, `${binaryName}${extension}`);
        if (originalCaseCandidate !== candidate && this.isUsableFile(originalCaseCandidate)) {
          return path.resolve(originalCaseCandidate);
        }
      }
    }
    return null;
  }

  private isUsableFile(candidatePath: string): boolean {
    try {
      const stat = fs.statSync(candidatePath);
      if (!stat.isFile()) return false;
      fs.accessSync(candidatePath, this.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
}
