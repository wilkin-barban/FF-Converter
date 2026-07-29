import { describe, expect, it } from 'vitest';
import { translateUiText } from '../apps/desktop/src/renderer/utils/i18n';

describe('live interface translations', () => {
  it('translates primary interface labels to English and preserves Spanish', () => {
    expect(translateUiText('Convertir Medios', 'en')).toBe('Convert Media');
    expect(translateUiText('Ajustes del sistema', 'en')).toBe('System Settings');
    expect(translateUiText('Carpetas Vigiladas', 'en')).toBe('Watched Folders');
    expect(translateUiText('Convertir Medios', 'es')).toBe('Convertir Medios');
  });

  it('translates dynamic counters without altering their values', () => {
    expect(translateUiText('Archivos Seleccionados (12)', 'en')).toBe('Selected Files (12)');
    expect(translateUiText('Trabajos activos en ejecución (2 de 7 totales).', 'en'))
      .toBe('Active jobs running (2 of 7 total).');
    expect(translateUiText('Mostrar 200 trabajos más (35 restantes)', 'en'))
      .toBe('Show 200 more jobs (35 remaining)');
  });

  it('leaves paths, logs and unknown user content untouched', () => {
    expect(translateUiText('C:\\Videos\\vacaciones.mp4', 'en')).toBe('C:\\Videos\\vacaciones.mp4');
    expect(translateUiText('Custom FFmpeg diagnostic', 'en')).toBe('Custom FFmpeg diagnostic');
  });
});
