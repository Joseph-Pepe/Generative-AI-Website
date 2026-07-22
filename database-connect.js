const { Pool } = require('pg');

// Initialize the database connection pool using the URL from your .env file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
pool.connect()
  .then(() => console.log('📦 Successfully connected to PostgreSQL database'))
  .catch(err => console.error('❌ Database connection error', err.stack));

module.exports = {
  query: (text, params) => pool.query(text, params),
};
