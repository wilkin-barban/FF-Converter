import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('update dialog renderer contract', () => {
  it('renders the dialog and wires confirm, dismiss, and restart actions', () => {
    const source = fs.readFileSync(path.resolve('apps/desktop/src/renderer/App.tsx'), 'utf8');

    expect(source).toMatch(/\{update && \(\s*<UpdateDialog/);
    expect(source).toContain('onDismiss={() => setUpdate(null)}');
    expect(source).toContain('downloadOrOpenRelease()');
    expect(source).toContain('updates.install()');
  });
});
