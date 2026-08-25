import { eq, sum } from 'drizzle-orm';
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
};

export async function getPoolWithTotal(id: string): Promise<PoolWithTotal | null> {
  const pool = await getPool(id);
  if (!pool) return null;

  const [{ totalAmount }] = await db
    .select({ totalAmount: sum(contributions.amount) })
    .from(contributions)
    .where(eq(contributions.poolId, id));

  const totalStr = (totalAmount as string | null) || '0';
  let percentage = 0;
  const goal = parseFloat(pool.goalAmount);
  const total = parseFloat(totalStr);

  if (goal > 0) {
    percentage = Math.min(100, Math.round((total / goal) * 100));
  }

  return {
    ...pool,
    total: totalStr,
    percentage,
  };
}
