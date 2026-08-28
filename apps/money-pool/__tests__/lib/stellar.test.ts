import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyTxOnRPC } from '../../lib/stellar';
import { rpc, Transaction } from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      Server: vi.fn().mockImplementation(function () {
        return { getTransaction: vi.fn() };
      })
    },
    Transaction: vi.fn().mockImplementation(function () {
      return {};
    })
  };
});

describe('verifyTxOnRPC', () => {
  const MOCK_HASH = 'mock_hash';
  const MOCK_DESTINATION = 'G_DESTINATION';
  const MOCK_AMOUNT = '10.0000000';
  const MOCK_POOL_ID = 'test-pool-123';
  const MOCK_FROM = 'G_CONTRIBUTOR';
  const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  let mockGetTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTransaction = vi.fn();
    (rpc.Server as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { getTransaction: mockGetTransaction };
    });
  });

  it('returns error if transaction does not exist (NOT_FOUND)', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT, MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('returns error if transaction failed on-chain', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'FAILED' });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT, MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('failed on-chain');
  });

  it('returns error if memo does not match poolId', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'SUCCESS', envelopeXdr: 'mock-xdr' });
    (Transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        memo: { type: 'text', value: 'wrong-pool' },
        operations: []
      };
    });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT, MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Memo mismatch');
  });

  it('returns error if asset is not USDC', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'SUCCESS', envelopeXdr: 'mock-xdr' });
    (Transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        memo: { type: 'text', value: MOCK_POOL_ID },
        operations: [
          {
            type: 'payment',
            destination: MOCK_DESTINATION,
            amount: '10.0000000',
            source: MOCK_FROM,
            asset: {
              isNative: () => true,
              getCode: () => 'XLM',
              getIssuer: () => ''
            }
          }
        ]
      };
    });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, '10', MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid asset');
  });

  it('returns valid with on-chain from for a correct USDC transaction', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'SUCCESS', envelopeXdr: 'mock-xdr' });
    (Transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        source: 'G_TRANSACTION_SOURCE',
        memo: { type: 'text', value: MOCK_POOL_ID },
        operations: [
          {
            type: 'payment',
            destination: MOCK_DESTINATION,
            amount: '10.0000000',
            source: MOCK_FROM,
            asset: {
              isNative: () => false,
              getCode: () => 'USDC',
              getIssuer: () => USDC_ISSUER
            }
          }
        ]
      };
    });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, '10', MOCK_POOL_ID);
    expect(result.valid).toBe(true);
    expect(result.from).toBe(MOCK_FROM);
    expect(result.error).toBeUndefined();
  });

  it('returns error if recipient does not match', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'SUCCESS', envelopeXdr: 'mock-xdr' });
    (Transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        memo: { type: 'text', value: MOCK_POOL_ID },
        operations: [
          {
            type: 'payment',
            destination: 'G_OTHER',
            amount: '10.0000000',
            source: MOCK_FROM,
            asset: {
              isNative: () => false,
              getCode: () => 'USDC',
              getIssuer: () => USDC_ISSUER
            }
          }
        ]
      };
    });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT, MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No matching payment');
  });

  it('returns error if amount does not match', async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: 'SUCCESS', envelopeXdr: 'mock-xdr' });
    (Transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        memo: { type: 'text', value: MOCK_POOL_ID },
        operations: [
          {
            type: 'payment',
            destination: MOCK_DESTINATION,
            amount: '5.0000000',
            source: MOCK_FROM,
            asset: {
              isNative: () => false,
              getCode: () => 'USDC',
              getIssuer: () => USDC_ISSUER
            }
          }
        ]
      };
    });

    const result = await verifyTxOnRPC(MOCK_HASH, MOCK_DESTINATION, MOCK_AMOUNT, MOCK_POOL_ID);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No matching payment');
  });
});
