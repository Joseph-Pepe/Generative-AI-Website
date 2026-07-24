import dotenv from 'dotenv';
import path from 'path';
import { defineConfig } from 'drizzle-kit';

// 1. Explicitly load .env.local from workspace root and local directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // Fallback for standard .env

// 2. Fail fast with a clear error if the URL is still missing
if (!process.env.DATABASE_URL) {
  throw new Error('❌ CRITICAL ERROR: DATABASE_URL is missing! Check your .env.local file path.');
}

export default defineConfig({
  schema: './src/database/schemas/*.ts', // Tells Drizzle where your schema tables are located (.ts files in  schemas folder)
  out: './drizzle',                      // Folder where migration files will be saved
  dialect: 'postgresql',                 // We are using PostgreSQL
  dbCredentials: {
    url: process.env.DATABASE_URL!,      // Pulls the connection string from .env.local
  },
});