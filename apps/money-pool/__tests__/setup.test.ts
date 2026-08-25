import { describe, it, expect } from 'vitest';

/**
 * Placeholder test suite — verifica que vitest funciona correctamente.
 * Se reemplaza con tests reales en Fase 1+.
 */
describe('setup', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('numeric strings are not silently cast to floats', () => {
    // Regla dura del proyecto: montos como string, nunca parseFloat para sumas
    const amount = '45.5000000';
    expect(typeof amount).toBe('string');
    expect(amount).not.toBe(45.5); // sigue siendo string
  });
});
