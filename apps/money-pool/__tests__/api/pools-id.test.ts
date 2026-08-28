import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '../../app/api/pools/[id]/route';
import { getPoolWithTotal, updatePoolStatus } from '../../lib/pools';
import { requirePoolOrganizer } from '../../lib/server-auth';
import { NextResponse } from 'next/server';

vi.mock('../../lib/pools', () => ({
  getPoolWithTotal: vi.fn(),
  updatePoolStatus: vi.fn(),
  toPublicPool: vi.fn((pool) => {
    const { organizerUserId, ...publicPool } = pool;
    return publicPool;
  })
}));

vi.mock('../../lib/server-auth', () => ({
  requirePoolOrganizer: vi.fn(),
}));

describe('PATCH /api/pools/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if pool does not exist', async () => {
    vi.mocked(getPoolWithTotal).mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/pools/pool-1', { method: 'PATCH' });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'pool-1' }) });

    expect(response.status).toBe(404);
  });

  it('should return 400 if pool is already closed', async () => {
    vi.mocked(getPoolWithTotal).mockResolvedValueOnce({ status: 'closed' } as unknown as import('../../lib/pools').PoolWithTotal);

    const request = new Request('http://localhost/api/pools/pool-1', { method: 'PATCH' });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'pool-1' }) });

    expect(response.status).toBe(400);
  });

  it('should return 403 if auth fails (requirePoolOrganizer fails)', async () => {
    vi.mocked(getPoolWithTotal).mockResolvedValueOnce({
      status: 'open',
      organizerAddress: 'G_ORGANIZER'
    } as unknown as import('../../lib/pools').PoolWithTotal);

    vi.mocked(requirePoolOrganizer).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    });

    const request = new Request('http://localhost/api/pools/pool-1', { method: 'PATCH' });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'pool-1' }) });

    expect(response.status).toBe(403);
  });

  it('should update pool to closed and exclude organizerUserId in response', async () => {
    const mockPool = {
      id: 'pool-1',
      status: 'open',
      organizerAddress: 'G_ORGANIZER',
      organizerUserId: 'G_USER_ID',
      total: '100',
      percentage: 100,
      contributions: []
    } as unknown as import('../../lib/pools').PoolWithTotal;

    const updatedPool = {
      ...mockPool,
      status: 'closed'
    } as unknown as import('../../lib/pools').PoolWithTotal;

    vi.mocked(getPoolWithTotal)
      .mockResolvedValueOnce(mockPool)      // Primera llamada para validar
      .mockResolvedValueOnce(updatedPool);  // Segunda llamada para devolver el actualizado

    vi.mocked(requirePoolOrganizer).mockResolvedValueOnce({
      ok: true,
      address: 'G_ORGANIZER'
    });

    const request = new Request('http://localhost/api/pools/pool-1', { method: 'PATCH' });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'pool-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe('closed');
    expect(data.organizerUserId).toBeUndefined(); // Protegido contra fuga de información
    expect(updatePoolStatus).toHaveBeenCalledWith('pool-1', 'closed');
  });
});
