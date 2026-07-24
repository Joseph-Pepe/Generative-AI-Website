// Drizzle: TypeScript Schema Definition (If using an ORM). Use this if you don't want to use a .sql file.
import { pgTable, varchar, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

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
});