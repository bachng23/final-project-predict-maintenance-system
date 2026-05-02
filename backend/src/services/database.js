const { Pool } = require('pg');

const globalForDatabase = globalThis;

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  return connectionString;
}

function createPool() {
  return new Pool({
    connectionString: getConnectionString(),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000)
  });
}

function getPool() {
  if (!globalForDatabase.pgPool) {
    globalForDatabase.pgPool = createPool();
  }

  return globalForDatabase.pgPool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function transaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (globalForDatabase.pgPool) {
    await globalForDatabase.pgPool.end();
    globalForDatabase.pgPool = null;
  }
}

module.exports = {
  query,
  transaction,
  closePool
};
