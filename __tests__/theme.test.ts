import { NAV_THEME } from '@/lib/theme';

describe('NAV_THEME', () => {
  it('usa la paleta de Aequo en modo claro', () => {
    expect(NAV_THEME.light.colors.background).toBe('#FFFFFF');
    expect(NAV_THEME.light.colors.primary).toBe('#FFD300');
    expect(NAV_THEME.light.colors.text).toBe('#090C11');
  });

  it('usa la paleta de Aequo en modo oscuro', () => {
    expect(NAV_THEME.dark.colors.background).toBe('#090C11');
    expect(NAV_THEME.dark.colors.card).toBe('#262B32');
    expect(NAV_THEME.dark.colors.text).toBe('#FFFFFF');
  });
});
