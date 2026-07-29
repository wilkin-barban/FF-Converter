import path from 'path';
import fs from 'fs/promises';

export type DuplicatePolicy = 'overwrite' | 'skip' | 'suffix';

export interface OutputPathResolution {
  finalPath: string;
  tempPath?: string;
  action: 'convert' | 'skip';
  overwriteExisting: boolean;
}

export interface OutputPathRequest {
  inputPath: string;
  outputFolder: string;
  targetContainer: string;
  duplicatePolicy: DuplicatePolicy;
  jobId: string;
  isReserved?: (candidatePath: string) => boolean;
}

export class OutputPathResolver {
  public async resolve(request: OutputPathRequest): Promise<OutputPathResolution> {
    const basename = path.basename(request.inputPath, path.extname(request.inputPath));
    const extension = `.${request.targetContainer.toLowerCase().replace(/^\./, '')}`;
    const initialPath = path.join(request.outputFolder, `${basename}${extension}`);
    const targetsInput = this.normalize(initialPath) === this.normalize(request.inputPath);
    const reserved = request.isReserved?.(initialPath) ?? false;
    const exists = await this.exists(initialPath);
    const collides = reserved || exists || targetsInput;

    if (collides && request.duplicatePolicy === 'skip' && !targetsInput) {
      return {
        finalPath: initialPath,
        action: 'skip',
        overwriteExisting: false
      };
    }

    let finalPath = initialPath;
    if (collides && (request.duplicatePolicy === 'suffix' || reserved || targetsInput)) {
      let counter = 1;
      do {
        finalPath = path.join(request.outputFolder, `${basename}-${counter}${extension}`);
        counter += 1;
      } while (await this.collides(finalPath, request.isReserved));
    }

    const safeJobId = request.jobId.replace(/[^a-zA-Z0-9_-]/g, '');
    const tempPath = path.join(
      request.outputFolder,
      `.${basename}.${safeJobId}.ffconverter.partial${extension}`
    );

    return {
      finalPath,
      tempPath,
      action: 'convert',
      overwriteExisting: exists && !reserved && !targetsInput && request.duplicatePolicy === 'overwrite'
    };
  }

  private async collides(candidatePath: string, isReserved?: (candidatePath: string) => boolean): Promise<boolean> {
    if (isReserved?.(candidatePath)) return true;
    return this.exists(candidatePath);
  }

  private async exists(candidatePath: string): Promise<boolean> {
    try {
      await fs.stat(candidatePath);
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  private normalize(candidatePath: string): string {
    const resolved = path.resolve(candidatePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }
}
