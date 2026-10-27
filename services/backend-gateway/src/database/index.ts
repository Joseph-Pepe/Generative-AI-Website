import { Pool, QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schemas/0001_create_schema.js';

// Initialize the Enterprise PostgreSQL connection pool tuned for Node.js 24 concurrency
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum active connections in pool
  idleTimeoutMillis: 30_000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 3_000, // Fail fast if Postgres is unreachable within 3 seconds
  maxUses: 7_500, // Recycle connections periodically to prevent memory bloat
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL idle client error:', err.message);
});

// Test the connection on startup
// Verify connection on startup AND immediately release the client back to the pool!
pool
  .connect()
  .then((client) => {
    client.release(); // CRITICAL FIX: Prevents leaking a connection on startup
    console.log('📦 Successfully connected to PostgreSQL database pool');
  })
  .catch((err) => console.error('❌ Database connection error:', err.message));

// Option 1: Export the Drizzle database instance with your schema loaded
export const db = drizzle(pool, { schema });

// Option 2: Parameterized raw sql queries (SELECT * FROM ...).
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
) => {
  return pool.query<T>(text, params);
};