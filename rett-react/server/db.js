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
