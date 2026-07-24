// Neon Postgres pool + schema bootstrap for saved RETT flows.
//
// One table, rett_flows, holds every workflow snapshot — named client cases
// and un-named per-browser drafts alike. The form_state column stores the
// exact object RETTCaseStorage.captureFormState() produces (schema v4 on the
// client side), so restoring a flow is a byte-faithful applyFormState().
//
// Named flows are unique by lower(client_name) — the app's case model is
// name-keyed (see public/legacy/js/04-ui/case-storage.js), and every advisor
// shares one PIN, so the history is global. Drafts (client_name = '') are
// keyed only by their UUID, which the browser generates and remembers in
// localStorage so refreshes keep writing the same draft row.

import pg from 'pg';

// Read lazily, not at module scope: ESM import hoisting evaluates this module
// before index.js gets a chance to run dotenvConfig(), so a top-level
// process.env read would always see an empty DATABASE_URL.
function connectionString() {
  return process.env.DATABASE_URL || '';
}

let pool = null;
let schemaReady = null;

export function isDbConfigured() {
  return Boolean(connectionString());
}

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: connectionString(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // Without a handler, an idle-client error (Neon closing a pooled
    // connection) is an uncaught exception that kills the process.
    pool.on('error', (err) => {
      console.warn('[rett-db] idle client error:', err.message);
    });
  }
  return pool;
}

// Two tables:
//   rett_flows          — the LIVE, current state of each flow (name-keyed).
//   rett_flow_versions  — an APPEND-ONLY, immutable audit log. Every save
//                         writes a new version row; a delete first archives
//                         the final state as a 'delete' version. Rows here are
//                         never UPDATEd or DELETEd, so no overwrite or deletion
//                         of a live flow can ever lose data — the full history
//                         is always recoverable from this table.
//
// The whole block is idempotent (IF NOT EXISTS) and purely additive: it
// contains no DROP/TRUNCATE/ALTER-DROP, so running it on every cold start —
// including a prod deploy against a database that already holds live data —
// can never destroy or alter existing rows.
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS rett_flows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'completed')),
    form_state   JSONB NOT NULL,
    last_page    TEXT NOT NULL DEFAULT 'page-inputs',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX IF NOT EXISTS rett_flows_name_uniq
    ON rett_flows (lower(client_name)) WHERE client_name <> '';
  CREATE INDEX IF NOT EXISTS rett_flows_updated_idx
    ON rett_flows (updated_at DESC);

  CREATE TABLE IF NOT EXISTS rett_flow_versions (
    version_id   BIGSERIAL PRIMARY KEY,
    flow_id      UUID NOT NULL,
    client_name  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'in_progress',
    form_state   JSONB NOT NULL,
    last_page    TEXT NOT NULL DEFAULT 'page-inputs',
    event        TEXT NOT NULL DEFAULT 'sync',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS rett_flow_versions_flow_idx
    ON rett_flow_versions (flow_id, version_id DESC);
`;

// Idempotent; retried on the next request if a cold start raced Neon.
export function ensureSchema() {
  if (!isDbConfigured()) {
    return Promise.reject(new Error('DATABASE_URL not configured'));
  }
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // allow retry on the next call
        throw err;
      });
  }
  return schemaReady;
}

export async function dbQuery(text, params) {
  await ensureSchema();
  return getPool().query(text, params);
}

// Run fn inside a single transaction on a dedicated client. Used so a live-row
// write and its append-only version-log insert commit atomically — either both
// land or neither does, so the audit history can never drift from the live row.
export async function withTransaction(fn) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw err;
  } finally {
    client.release();
  }
}
