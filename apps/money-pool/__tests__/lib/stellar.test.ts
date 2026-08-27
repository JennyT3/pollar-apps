import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyTxOnHorizon } from '../../lib/stellar';

describe('verifyTxOnHorizon', () => {
  const MOCK_HASH = 'mock_hash';
  const MOCK_DESTINATION = 'G_DESTINATION';
  const MOCK_AMOUNT = '10.0000000';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('devuelve error si la transacción no existe (404)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await verifyTxOnHorizon(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no existe');
  });

  it('devuelve error si la transacción falló', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ successful: false }),
    } as Response);

    const result = await verifyTxOnHorizon(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('falló');
  });

  it('devuelve válido para una transacción correcta (con normalización de monto)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ successful: true }),
    } as Response);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              type: 'payment',
              to: MOCK_DESTINATION,
              amount: MOCK_AMOUNT,
            }
          ]
        }
      }),
    } as Response);

    // Send "10" to test internal normalizeAmount
    const result = await verifyTxOnHorizon(MOCK_HASH, MOCK_DESTINATION, '10');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('devuelve error si el monto no coincide', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ successful: true }),
    } as Response);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              type: 'payment',
              to: MOCK_DESTINATION,
              amount: '5.0000000',
            }
          ]
        }
      }),
    } as Response);

    const result = await verifyTxOnHorizon(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no coincide');
  });

  it('devuelve error si el destinatario no coincide', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ successful: true }),
    } as Response);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              type: 'payment',
              to: 'G_OTHER',
              amount: MOCK_AMOUNT,
            }
          ]
        }
      }),
    } as Response);

    const result = await verifyTxOnHorizon(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no coincide');
  });
});
