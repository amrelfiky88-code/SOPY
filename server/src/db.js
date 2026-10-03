import pg from 'pg';
import 'dotenv/config';

// pg treats sslmode=require (and prefer, verify-ca) as verify-full today,
// and printed a "SECURITY WARNING" about a future change at every start
// (Neon's addresses say require). Say verify-full outright: the same
// connection as now, without the warning flooding the log.
export function explicitSslMode(url) {
  if (!url || /[?&]uselibpqcompat=/i.test(url)) return url;
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/i, '$1verify-full');
}

export const pool = new pg.Pool({
  connectionString: explicitSslMode(process.env.DATABASE_URL),
  // Give up on a connection attempt rather than queueing requests behind
  // a database that isn't answering.
  connectionTimeoutMillis: 10_000,
  // A runaway query can't hold a request (and a pool slot) forever.
  statement_timeout: 20_000,
  idleTimeoutMillis: 30_000,
});

// When the database restarts or the network drops an *idle* connection,
// node-postgres emits 'error' on the pool. With no listener, Node treats
// that as an unhandled error event and the whole server exits — one DB
// hiccup took SOPY down until someone restarted it. The broken client is
// discarded by the pool; the next query simply opens a fresh connection.
pool.on('error', (err) => {
  console.error('Database connection lost (will reconnect on next query):', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withClient(fn) {
  const client = await pool.connect();
  let broken = false;
  try {
    return await fn(client);
  } catch (err) {
    broken = isConnectionError(err);
    throw err;
  } finally {
    // A client whose connection died must not go back into the pool.
    client.release(broken || undefined);
  }
}

export async function withTransaction(fn) {
  return withClient(async (client) => {
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      // If the connection itself is gone, ROLLBACK fails too — don't let
      // that second error hide the real one.
      try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
      throw err;
    }
  });
}

function isConnectionError(err) {
  return ['57P01', '57P02', '57P03', '08000', '08003', '08006'].includes(err?.code)
    || /Connection terminated|ECONNRESET|ECONNREFUSED/i.test(err?.message || '');
}
