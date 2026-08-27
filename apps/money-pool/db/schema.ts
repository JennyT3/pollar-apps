import { pgTable, text, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const poolStatusEnum = pgEnum('pool_status', ['open', 'closed']);
export const contributionStatusEnum = pgEnum('contribution_status', ['pending', 'confirmed']);

export const pools = pgTable('pools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  goalAmount: numeric('goal_amount', { precision: 18, scale: 7 }).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  organizerAddress: text('organizer_address').notNull(),
  organizerUserId: text('organizer_user_id').notNull(),
  status: poolStatusEnum('status').default('open').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contributions = pgTable('contributions', {
  id: text('id').primaryKey(),
  poolId: text('pool_id')
    .references(() => pools.id)
    .notNull(),
  contributorName: text('contributor_name'),
  contributorAddress: text('contributor_address'),
  amount: numeric('amount', { precision: 18, scale: 7 }).notNull(),
  txHash: text('tx_hash').unique().notNull(),
  status: contributionStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
