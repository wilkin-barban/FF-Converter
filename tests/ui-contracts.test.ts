import { describe, expect, it } from 'vitest';
import { AppSettingsSchema } from '../packages/shared-contracts/src';
import { getErrorMessage } from '../apps/desktop/src/renderer/utils/errors';

describe('Phase 7 UI contracts', () => {
  it('converts IPC validation failures into a readable message', () => {
    const error = new Error(
      `Error invoking remote method 'settings:save': Error: [{"message":"Expected absolute path"}]`
    );
    expect(getErrorMessage(error)).toBe('Expected absolute path');
  });

  it('enables desktop notifications only by explicit opt-in', () => {
    const settings = AppSettingsSchema.parse({});
    expect(settings.desktopNotifications).toBe(false);
    expect(settings.theme).toBe('dark');
    expect(settings.language).toBe('es');
  });
});
