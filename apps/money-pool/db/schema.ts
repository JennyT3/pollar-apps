import { pgTable, text, numeric, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

const isLocal = !process.env.DATABASE_URL;

export const poolStatusEnum = pgEnum('pool_status', ['open', 'closed']);
export const contributionStatusEnum = pgEnum('contribution_status', ['pending', 'confirmed']);

const pgPools = pgTable('pools', {
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

const sqlitePools = sqliteTable('pools', {
  id: sqliteText('id').primaryKey(),
  name: sqliteText('name').notNull(),
  description: sqliteText('description'),
  goalAmount: sqliteText('goal_amount').notNull(),
  deadline: sqliteInteger('deadline', { mode: 'timestamp' }),
  organizerAddress: sqliteText('organizer_address').notNull(),
  organizerUserId: sqliteText('organizer_user_id').notNull(),
  status: sqliteText('status').default('open').notNull(),
  createdAt: sqliteInteger('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

export const pools = (isLocal ? sqlitePools : pgPools) as typeof pgPools;

const pgContributions = pgTable('contributions', {
  id: text('id').primaryKey(),
  poolId: text('pool_id')
    .references(() => pgPools.id)
    .notNull(),
  contributorName: text('contributor_name'),
  contributorAddress: text('contributor_address'),
  amount: numeric('amount', { precision: 18, scale: 7 }).notNull(),
  txHash: text('tx_hash').unique().notNull(),
  status: contributionStatusEnum('status').default('pending').notNull(),
  overGoal: boolean('over_goal').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

const sqliteContributions = sqliteTable('contributions', {
  id: sqliteText('id').primaryKey(),
  poolId: sqliteText('pool_id')
    .references(() => sqlitePools.id)
    .notNull(),
  contributorName: sqliteText('contributor_name'),
  contributorAddress: sqliteText('contributor_address'),
  amount: sqliteText('amount').notNull(),
  txHash: sqliteText('tx_hash').unique().notNull(),
  status: sqliteText('status').default('pending').notNull(),
  overGoal: sqliteInteger('over_goal', { mode: 'boolean' }).default(false).notNull(),
  createdAt: sqliteInteger('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

export const contributions = (isLocal ? sqliteContributions : pgContributions) as typeof pgContributions;
