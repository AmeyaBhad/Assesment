// PostgreSQL is the default database (as required by the assessment).
// Set USE_SQLITE=true in .env only for local development without PostgreSQL.
const useSQLite = process.env.USE_SQLITE === 'true';

if (useSQLite) {
  const sqliteAdapter = require('./sqlite-adapter');
  module.exports = sqliteAdapter;
} else {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'lead_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
  };
}
