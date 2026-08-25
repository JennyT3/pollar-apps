import { vi, describe, it, expect } from 'vitest';
import { createPool, getPool } from '../../lib/pools';
import { db } from '../../db/client';

vi.mock('../../db/client', () => {
  const dbMock = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([
      { id: 'mocked-id', name: 'Test', goalAmount: '100.0000000' }
    ]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return { db: dbMock };
});

describe('Pools lib', () => {
  it('createPool generates an id and maintains goalAmount as string', async () => {
    const pool = await createPool({
      name: 'Test',
      goalAmount: '100.0000000',
      organizerAddress: 'G...',
      organizerUserId: 'G...',
    });
    expect(pool.id).toBeDefined();
    expect(typeof pool.goalAmount).toBe('string');
  });

  it('getPool returns null for non-existent id', async () => {
    const pool = await getPool('nonexistent');
    expect(pool).toBeNull();
  });
});
