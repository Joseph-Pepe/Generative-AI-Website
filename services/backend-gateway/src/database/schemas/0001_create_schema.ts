// Drizzle: TypeScript Schema Definition (If using an ORM). Use this if you don't want to use a .sql file.
import { sql } from 'drizzle-orm';
import { pgTable, varchar, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const generations = pgTable('generations', {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }),
    prompt: text('prompt').notNull(),
    genre: varchar('genre', { length: 50 }),
    mood: varchar('mood', { length: 50 }),
    bpm: integer('bpm').default(120),
    durationSeconds: integer('duration_seconds').default(30),
    status: varchar('status', { length: 30 }).notNull().default('STREAMING'),
    masterAudioUrl: text('master_audio_url'),
    stemsMetadata: jsonb('stems_metadata'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Composite index for fast user history queries
    index('idx_generations_user_created').on(table.userId, table.createdAt),
    // Partial index for active streaming/demixing job polling (matches 0001_create_generations_table.sql)
    index('idx_generations_status')
      .on(table.status)
      .where(sql`${table.status} != 'COMPLETED' AND ${table.status} != 'DEMIXED'`),
  ]
);