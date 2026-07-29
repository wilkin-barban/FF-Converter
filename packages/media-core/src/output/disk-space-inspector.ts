import fs from 'fs/promises';

export interface DiskCapacity {
  availableBytes: number;
  requiredBytes: number;
  sufficient: boolean;
}

export interface FileSystemCapacity {
  bavail: number | bigint;
  bsize: number | bigint;
}

export class DiskSpaceInspector {
  constructor(
    private readonly getFileSystemCapacity: (outputFolder: string) => Promise<FileSystemCapacity> =
      async (outputFolder) => fs.statfs(outputFolder)
  ) {}

  public async check(outputFolder: string, inputSizeBytes: number): Promise<DiskCapacity> {
    const stats = await this.getFileSystemCapacity(outputFolder);
    const availableBytes = Number(stats.bavail) * Number(stats.bsize);
    const requiredBytes = this.estimateRequiredBytes(inputSizeBytes);
    return {
      availableBytes,
      requiredBytes,
      sufficient: Number.isFinite(availableBytes) && availableBytes >= requiredBytes
    };
  }

  public estimateRequiredBytes(inputSizeBytes: number): number {
    const conversionEstimate = Math.ceil(Math.max(inputSizeBytes * 1.25, 64 * 1024 * 1024));
    return conversionEstimate + 256 * 1024 * 1024;
  }
}
