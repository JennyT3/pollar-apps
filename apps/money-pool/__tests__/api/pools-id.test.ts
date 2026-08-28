import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../../app/api/pools/[id]/route';
import { getPoolWithTotal, updatePoolStatus } from '../../lib/pools';
import { requirePoolOrganizer } from '../../lib/server-auth';
import { NextResponse } from 'next/server';

vi.mock('../../lib/pools', () => ({
  getPoolWithTotal: vi.fn(),
  updatePoolStatus: vi.fn(),
  toPublicPool: vi.fn((pool) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizerUserId, ...publicPool } = pool;
    if (publicPool.deadline && new Date() > new Date(publicPool.deadline)) {
      publicPool.status = 'closed';
    }
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
      .mockResolvedValueOnce(mockPool)
      .mockResolvedValueOnce(updatedPool);

    vi.mocked(requirePoolOrganizer).mockResolvedValueOnce({
      ok: true,
      address: 'G_ORGANIZER'
    });

    const request = new Request('http://localhost/api/pools/pool-1', { method: 'PATCH' });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'pool-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe('closed');
    expect(data.organizerUserId).toBeUndefined();
    expect(updatePoolStatus).toHaveBeenCalledWith('pool-1', 'closed');
  });
});

describe('GET /api/pools/[id] (DoS Mitigation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dynamically infer closed status for an expired pool without mutating DB', async () => {
    const pastDate = new Date(Date.now() - 10000);

    vi.mocked(getPoolWithTotal).mockResolvedValueOnce({
      id: 'pool-expired',
      name: 'Expired Pool',
      description: null,
      goalAmount: '100',
      deadline: pastDate,
      organizerAddress: 'G_TEST',
      organizerUserId: 'G_TEST',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      total: '0',
      percentage: 0,
      contributions: []
    } as unknown as import('../../lib/pools').PoolWithTotal);

    const request = new Request('http://localhost/api/pools/pool-expired');
    const response = await GET(request, { params: Promise.resolve({ id: 'pool-expired' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getPoolWithTotal).toHaveBeenCalledWith('pool-expired');

    expect(data.status).toBe('closed');
  });
});
