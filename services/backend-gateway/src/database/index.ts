// services/backend-gateway/src/db/index.ts
import { Pool, QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schemas/0001_create_schema.js';

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection on startup
pool.connect()
  .then(() => console.log('📦 Successfully connected to PostgreSQL database'))
  .catch((err) => console.error('❌ Database connection error:', err.message));

// Option 1: Export the Drizzle database instance with your schema loaded
export const db = drizzle(pool, { schema });

// Option 2: Prefer writing raw SQL queries (SELECT * FROM ...).
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
) => {
  return pool.query<T>(text, params);
};