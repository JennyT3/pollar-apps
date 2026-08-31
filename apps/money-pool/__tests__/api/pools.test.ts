import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/pools/route';
import { createPool } from '../../lib/pools';
import { requireSignedAddress } from '../../lib/server-auth';
import { NextResponse } from 'next/server';

vi.mock('../../lib/pools', () => ({
  createPool: vi.fn(),
  getPools: vi.fn(),
  syncExpiredPools: vi.fn(),
}));

vi.mock('../../lib/server-auth', () => ({
  requireSignedAddress: vi.fn(),
}));

describe('POST /api/pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if authentication fails', async () => {
    vi.mocked(requireSignedAddress).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    });

    const request = new Request('http://localhost/api/pools', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if the authenticated address does not match organizerAddress', async () => {
    vi.mocked(requireSignedAddress).mockResolvedValueOnce({
      ok: true,
      address: 'G_AUTH_USER'
    });

    const request = new Request('http://localhost/api/pools', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Pool',
        goalAmount: '100',
        organizerAddress: 'G_DIFFERENT_USER',
        organizerUserId: 'G_DIFFERENT_USER'
      })
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toMatch(/La sesión no coincide/);
  });

  it('should create the pool successfully and exclude organizerUserId from response', async () => {
    const mockAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    vi.mocked(requireSignedAddress).mockResolvedValueOnce({
      ok: true,
      address: mockAddress
    });

    vi.mocked(createPool).mockResolvedValueOnce({
      id: 'pool-1',
      name: 'My Pool',
      description: null,
      goalAmount: '100',
      deadline: null,
      organizerAddress: mockAddress,
      organizerUserId: mockAddress,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as import('../../lib/pools').Pool);

    const request = new Request('http://localhost/api/pools', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Pool',
        goalAmount: '100',
        organizerAddress: mockAddress,
        organizerUserId: mockAddress
      })
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();

    expect(data.id).toBe('pool-1');
    expect(data.name).toBe('My Pool');

    expect(data.organizerUserId).toBeUndefined();
    expect(createPool).toHaveBeenCalledTimes(1);
  });
});
