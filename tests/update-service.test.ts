import { describe, expect, it, vi } from 'vitest';
import { UpdateService } from '../apps/desktop/src/main/services/update-service';

describe('UpdateService', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    const listeners = new Map<string, (...args: any[]) => void>();
    const updater = {
      autoDownload: true,
      on: vi.fn((event: string, listener: (...args: any[]) => void) => listeners.set(event, listener)),
      checkForUpdates: vi.fn().mockResolvedValue(undefined),
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn()
    };
    const emit = vi.fn();
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = new UpdateService({
      updater, appVersion: '1.0.0', isPackaged: true, platform: 'win32', isAppImage: false,
      openExternal, emit, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, delayMs: 0,
      releaseUrl: 'https://github.com/wilkinbarban/FF-Converter/releases/latest', ...overrides
    });
    return { service, updater, listeners, emit, openExternal };
  }

  it('never checks for updates in development', async () => {
    const { service, updater } = setup({ isPackaged: false });
    await service.start();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('announces only a strictly newer release and preserves explicit download', () => {
    const { service, listeners, emit, updater } = setup();
    listeners.get('update-available')?.({ version: '1.0.0' });
    listeners.get('update-available')?.({ version: '1.0.1', releaseNotes: 'Fixes' });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('events:update-available', expect.objectContaining({ version: '1.0.1' }));
    expect(updater.autoDownload).toBe(false);
  });

  it('downloads only after confirmation and installs when ready', async () => {
    const { service, updater } = setup();
    await service.downloadOrOpenRelease();
    service.install();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('opens the release page instead of self-installing DEB packages', async () => {
    const { service, updater, openExternal } = setup({ platform: 'linux', isAppImage: false });
    await service.downloadOrOpenRelease();
    service.install();
    expect(openExternal).toHaveBeenCalledOnce();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });
});
