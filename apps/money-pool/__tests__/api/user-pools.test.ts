import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/user/pools/route';
import { getUserOrganizedPools, getUserContributedPools, PoolPublicView } from '../../lib/pools';

vi.mock('../../lib/pools', () => ({
  getUserOrganizedPools: vi.fn(),
  getUserContributedPools: vi.fn(),
  syncExpiredPools: vi.fn(),
}));

describe('GET /api/user/pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if address is missing or invalid', async () => {
    const request = new Request('http://localhost/api/user/pools');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Dirección inválida');
  });

  it('should return organized and contributed pools for the specified user', async () => {
    const mockAddress = 'GDF5YAFNPG3I7YSPLOSCP5WZINDYZFBWDS35KCJNPXX5D4SCNTG67ZM4';
    
    const mockOrganized = [{ id: 'pool-1' }];
    const mockContributed = [{ id: 'pool-2' }];

    vi.mocked(getUserOrganizedPools).mockResolvedValueOnce(mockOrganized as unknown as PoolPublicView[]);
    vi.mocked(getUserContributedPools).mockResolvedValueOnce(mockContributed as unknown as PoolPublicView[]);

    const request = new Request(`http://localhost/api/user/pools?address=${mockAddress}`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.organized).toEqual(mockOrganized);
    expect(data.contributed).toEqual(mockContributed);

    expect(getUserOrganizedPools).toHaveBeenCalledWith(mockAddress);
    expect(getUserContributedPools).toHaveBeenCalledWith(mockAddress);
  });
});
