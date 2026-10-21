import { sesionDePruebaDisponible } from '@/lib/dev-session';

describe('sesionDePruebaDisponible', () => {
  const original = (globalThis as { __DEV__?: boolean }).__DEV__;
  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = original;
  });

  it('está disponible en desarrollo', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(sesionDePruebaDisponible()).toBe(true);
  });

  it('NO está disponible en producción', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(sesionDePruebaDisponible()).toBe(false);
  });
});
