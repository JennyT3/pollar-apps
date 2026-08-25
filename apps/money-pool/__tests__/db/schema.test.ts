import { describe, it, expect } from 'vitest';
import { pools, contributions, poolStatusEnum, contributionStatusEnum } from '../../db/schema';

describe('Database Schema', () => {
  it('pools table has correct numeric types and enums', () => {
    // We check that the builder recorded the types appropriately
    expect(pools.id.dataType).toBe('string');
    expect(pools.goalAmount.dataType).toBe('string'); // numeric translates to string in Drizzle PG by default
    expect(poolStatusEnum.enumValues).toEqual(['open', 'closed']);
  });

  it('contributions table has correct numeric types and enums', () => {
    expect(contributions.id.dataType).toBe('string');
    expect(contributions.amount.dataType).toBe('string');
    expect(contributionStatusEnum.enumValues).toEqual(['pending', 'confirmed']);
  });
});
