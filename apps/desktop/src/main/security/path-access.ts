import path from 'path';

export class PathAccessRegistry {
  private readonly exactPaths = new Set<string>();
  private readonly directoryRoots = new Set<string>();
  private readonly outputDirectories = new Set<string>();

  public authorizeFile(filePath: string): string {
    const normalized = this.normalizeAbsolute(filePath);
    this.exactPaths.add(normalized);
    return normalized;
  }

  public authorizeDirectory(directoryPath: string): string {
    const normalized = this.normalizeAbsolute(directoryPath);
    this.directoryRoots.add(normalized);
    this.outputDirectories.add(normalized);
    return normalized;
  }

  public authorizeOutputDirectory(directoryPath: string): string {
    const normalized = this.normalizeAbsolute(directoryPath);
    this.outputDirectories.add(normalized);
    return normalized;
  }

  public authorizeGeneratedPath(filePath: string): string {
    return this.authorizeFile(filePath);
  }

  public assertReadable(candidatePath: string): string {
    const normalized = this.normalizeAbsolute(candidatePath);
    if (this.isExact(normalized) || this.isInsideAuthorizedRoot(normalized)) {
      return normalized;
    }
    throw new Error('Path is not authorized for reading');
  }

  public assertDirectory(candidatePath: string): string {
    const normalized = this.normalizeAbsolute(candidatePath);
    if (this.outputDirectories.has(normalized)) {
      return normalized;
    }
    throw new Error('Directory is not authorized');
  }

  public assertOpenable(candidatePath: string): string {
    return this.assertReadable(candidatePath);
  }

  private isExact(normalizedPath: string): boolean {
    return this.exactPaths.has(normalizedPath) || this.directoryRoots.has(normalizedPath);
  }

  private isInsideAuthorizedRoot(normalizedPath: string): boolean {
    for (const root of this.directoryRoots) {
      const relative = path.relative(root, normalizedPath);
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return true;
      }
    }
    return false;
  }

  private normalizeAbsolute(candidatePath: string): string {
    if (typeof candidatePath !== 'string' || candidatePath.includes('\0') || !path.isAbsolute(candidatePath)) {
      throw new Error('Expected an absolute filesystem path');
    }
    const resolved = path.resolve(candidatePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }
}
