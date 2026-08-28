import { eq, and, sum, desc, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { pools, contributions } from '../db/schema';
import { nanoid } from 'nanoid';

export type Pool = typeof pools.$inferSelect;

export async function createPool(data: {
  name: string;
  description?: string;
  goalAmount: string;
  deadline?: Date | null;
  organizerAddress: string;
  organizerUserId: string;
}) {
  const [newPool] = await db
    .insert(pools)
    .values({
      id: nanoid(12),
      name: data.name,
      description: data.description,
      goalAmount: data.goalAmount,
      deadline: data.deadline,
      organizerAddress: data.organizerAddress,
      organizerUserId: data.organizerUserId,
    })
    .returning();
  return newPool;
}

export async function getPool(id: string) {
  const [pool] = await db.select().from(pools).where(eq(pools.id, id));
  return pool || null;
}

export type PoolWithTotal = Pool & {
  total: string;
  percentage: number;
  contributions: typeof contributions.$inferSelect[];
};

export type PoolPublicView = Omit<PoolWithTotal, 'organizerUserId'>;

export function toPublicPool(pool: PoolWithTotal): PoolPublicView {
  const { organizerUserId, ...publicPool } = pool;
  return publicPool;
}

export async function getPoolWithTotal(id: string): Promise<PoolWithTotal | null> {
  const pool = await getPool(id);
  if (!pool) return null;

  if (pool.status !== 'closed' && pool.deadline && new Date() > new Date(pool.deadline)) {
    await updatePoolStatus(id, 'closed');
    pool.status = 'closed';
  }

  const [{ totalAmount }] = await db
    .select({ totalAmount: sum(contributions.amount) })
    .from(contributions)
    .where(
      and(
        eq(contributions.poolId, id),
        eq(contributions.status, 'confirmed')
      )
    );

  const totalStr = (totalAmount as string | null) || '0';
  let percentage = 0;
  const goal = parseFloat(pool.goalAmount);
  const total = parseFloat(totalStr);

  if (goal > 0) {
    percentage = Math.min(100, Math.round((total / goal) * 100));
  }

  const poolContributions = await db
    .select()
    .from(contributions)
    .where(
      and(
        eq(contributions.poolId, id),
        eq(contributions.status, 'confirmed')
      )
    )
    .orderBy(desc(contributions.createdAt));

  return {
    ...pool,
    total: totalStr,
    percentage,
    contributions: poolContributions,
  };
}

export async function updatePoolStatus(id: string, status: 'open' | 'closed') {
  const [updatedPool] = await db
    .update(pools)
    .set({ status })
    .where(eq(pools.id, id))
    .returning();
  return updatedPool || null;
}

export async function getUserOrganizedPools(address: string): Promise<PoolPublicView[]> {
  const userPools = await db
    .select()
    .from(pools)
    .where(eq(pools.organizerUserId, address))
    .orderBy(desc(pools.createdAt));

  const enriched = await Promise.all(
    userPools.map((p) => getPoolWithTotal(p.id))
  );
  return enriched.filter((p): p is PoolWithTotal => p !== null).map(toPublicPool);
}

export async function getUserContributedPools(address: string): Promise<PoolPublicView[]> {
  const userContributions = await db
    .select({ poolId: contributions.poolId })
    .from(contributions)
    .where(
      and(
        eq(contributions.contributorAddress, address),
        eq(contributions.status, 'confirmed')
      )
    );

  if (userContributions.length === 0) return [];

  const poolIds = [...new Set(userContributions.map((c) => c.poolId))];

  const contributedPools = await db
    .select()
    .from(pools)
    .where(inArray(pools.id, poolIds))
    .orderBy(desc(pools.createdAt));

  const enriched = await Promise.all(
    contributedPools.map((p) => getPoolWithTotal(p.id))
  );
  return enriched.filter((p): p is PoolWithTotal => p !== null).map(toPublicPool);
}

export async function syncExpiredPools() {
  await db
    .update(pools)
    .set({ status: 'closed' })
    .where(
      and(
        eq(pools.status, 'open'),
        lt(pools.deadline, new Date())
      )
    );
}
