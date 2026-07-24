// REST routes for saved RETT flows (named client cases + un-named drafts).
//
// The browser's cloud-sync module (public/rett-react-only/cloud-sync.js)
// pushes the full captureFormState() snapshot here on a debounce whenever the
// existing local autosave fires, and pulls the list/individual rows for the
// History tab. All routes sit behind the site access gate — the middleware in
// access-gate.js 401s any /api/* request without a valid session cookie.
//
//   GET    /api/flows        → list (no form_state payload; preview fields only)
//   GET    /api/flows/:id    → one row incl. form_state
//   POST   /api/flows/sync   → upsert snapshot { id?, clientName?, formState,
//                              page?, completed? } → { id, status, updatedAt }
//   DELETE /api/flows/:id    → remove a flow
//
// Upsert identity rules (mirrors the name-keyed case model in case-storage.js):
//   * clientName non-empty → the row with lower(client_name) match wins; if
//     none, the provided draft id (if any) is promoted in place; else insert.
//     A leftover un-named draft row under the provided id is absorbed
//     (deleted) when the name already maps to a different row.
//   * clientName empty → row keyed by the browser-persisted draft UUID.
//   * status is sticky: once 'completed', later edits keep 'completed'.

import express from 'express';
import crypto from 'node:crypto';
import { dbQuery, withTransaction, isDbConfigured } from './db.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_RE = /^page-[a-z][a-z-]{0,40}$/;

// Safety-only sanitation: strip control characters, collapse whitespace,
// cap length. Deliberately NOT the ASCII-only filter the PMQ continue button
// applies — client names can arrive from other entry paths (rename box)
// with accents or non-Latin scripts, and an ASCII-only server filter would
// corrupt "José García" or empty out "山田太郎" entirely, silently demoting
// those flows to untitled drafts. History rendering uses textContent, so
// Unicode names are inert.
function sanitizeName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const LIST_SQL = `
  SELECT id, client_name, status, last_page, created_at, updated_at, completed_at,
         form_state->>'_chosenStrategy'          AS chosen_strategy,
         form_state->>'year1'                    AS tax_year,
         form_state->>'state-code'               AS state_code,
         count(*) OVER ()                        AS total_count
    FROM rett_flows
   ORDER BY updated_at DESC
   LIMIT 1000`;

function dbUnavailable(res, err) {
  console.warn('[rett-flows] database error:', err?.message || err);
  return res.status(503).json({
    error: 'Saved-flows database is unavailable right now. Your work is still saved locally in this browser.',
  });
}

export function createFlowsRouter() {
  const router = express.Router();
  // The app-level JSON parser is capped at 1kb (access-verify bodies).
  // Flow snapshots are tens of KB, so this router carries its own parser;
  // index.js routes /api/flows traffic around the small one.
  router.use(express.json({ limit: '2mb' }));

  router.use((_req, res, next) => {
    if (!isDbConfigured()) {
      return res.status(503).json({
        error: 'DATABASE_URL is not configured on the server. See server/.env.',
      });
    }
    return next();
  });

  router.get('/', async (_req, res) => {
    try {
      const { rows } = await dbQuery(LIST_SQL);
      const total = rows.length ? Number(rows[0].total_count) : 0;
      for (const row of rows) delete row.total_count;
      return res.json({ flows: rows, total });
    } catch (err) {
      return dbUnavailable(res, err);
    }
  });

  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid flow id.' });
    try {
      const { rows } = await dbQuery(
        `SELECT id, client_name, status, form_state, last_page,
                created_at, updated_at, completed_at
           FROM rett_flows WHERE id = $1`,
        [id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Flow not found.' });
      return res.json({ flow: rows[0] });
    } catch (err) {
      return dbUnavailable(res, err);
    }
  });

  router.post('/sync', async (req, res) => {
    const body = req.body || {};
    const formState = body.formState;
    if (!formState || typeof formState !== 'object' || Array.isArray(formState)) {
      return res.status(400).json({ error: 'formState must be an object.' });
    }
    const clientName = sanitizeName(body.clientName);
    const requestedId =
      typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
    const page = PAGE_RE.test(String(body.page || '')) ? body.page : 'page-inputs';
    const completed = body.completed === true;

    try {
      const result = await upsertFlow({ requestedId, clientName, formState, page, completed });
      return res.json(result);
    } catch (err) {
      // Unique-name race between two browsers: retry once — the second
      // attempt finds the row the winner inserted and updates it.
      if (err && err.code === '23505') {
        try {
          const result = await upsertFlow({ requestedId, clientName, formState, page, completed });
          return res.json(result);
        } catch (err2) {
          return dbUnavailable(res, err2);
        }
      }
      return dbUnavailable(res, err);
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid flow id.' });
    try {
      const found = await withTransaction(async (client) => {
        const cur = await client.query(
          'SELECT client_name, status, form_state, last_page FROM rett_flows WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (!cur.rows.length) return false;
        const row = cur.rows[0];
        // Archive the final state BEFORE removing the live row, so a delete
        // is always recoverable from rett_flow_versions — nothing is erased.
        await client.query(
          `INSERT INTO rett_flow_versions
             (flow_id, client_name, status, form_state, last_page, event)
           VALUES ($1, $2, $3, $4::jsonb, $5, 'delete')`,
          [id, row.client_name, row.status, row.form_state, row.last_page],
        );
        await client.query('DELETE FROM rett_flows WHERE id = $1', [id]);
        return true;
      });
      if (!found) return res.status(404).json({ error: 'Flow not found.' });
      return res.json({ ok: true });
    } catch (err) {
      return dbUnavailable(res, err);
    }
  });

  return router;
}

async function upsertFlow(args) {
  // The whole resolve → write → version-log sequence runs in one transaction
  // so the live row and its append-only audit version commit atomically.
  return withTransaction((client) => upsertFlowTx(client, args));
}

async function upsertFlowTx(client, { requestedId, clientName, formState, page, completed }) {
  const q = (text, params) => client.query(text, params);
  const stateJson = JSON.stringify(formState);

  // Resolve the target row per the identity rules in the header comment.
  let targetId = null;
  if (clientName) {
    const byName = await q(
      'SELECT id FROM rett_flows WHERE lower(client_name) = lower($1) FOR UPDATE',
      [clientName],
    );
    if (byName.rows.length) {
      targetId = byName.rows[0].id;
      if (requestedId && requestedId !== targetId) {
        // The browser had been writing an un-named draft and the user then
        // typed a name that already exists in the cloud — the named row wins
        // and the orphaned draft is absorbed so History doesn't show a ghost.
        // (Its versions stay in rett_flow_versions, so nothing is lost.)
        await q("DELETE FROM rett_flows WHERE id = $1 AND client_name = ''", [requestedId]);
      }
    } else if (requestedId) {
      const byId = await q('SELECT id FROM rett_flows WHERE id = $1 FOR UPDATE', [requestedId]);
      if (byId.rows.length) targetId = requestedId; // promote draft / rename in place
    }
  } else if (requestedId) {
    const byId = await q('SELECT id FROM rett_flows WHERE id = $1 FOR UPDATE', [requestedId]);
    if (byId.rows.length) targetId = requestedId;
  }

  let written = null;
  if (targetId) {
    // client_name: an empty payload name never blanks an existing one — a
    // browser holding a stale draft id whose row was since promoted to a
    // named flow must not demote it back to "Untitled draft". The app has
    // no legitimate name-removal path (renames require a new name; deletes
    // remove the row), so empty-over-named is always staleness.
    const { rows } = await q(
      `UPDATE rett_flows
          SET client_name  = CASE WHEN $2 <> '' THEN $2 ELSE client_name END,
              form_state   = $3::jsonb,
              last_page    = $4,
              status       = CASE WHEN $5 OR status = 'completed'
                                  THEN 'completed' ELSE 'in_progress' END,
              completed_at = COALESCE(completed_at, CASE WHEN $5 THEN now() END),
              updated_at   = now()
        WHERE id = $1
        RETURNING id, client_name, status, updated_at`,
      [targetId, clientName, stateJson, page, completed],
    );
    if (rows.length) written = rows[0];
    // else: row vanished between resolve and update (concurrent delete) — insert.
  }

  if (!written) {
    const insertId = requestedId || crypto.randomUUID();
    const { rows } = await q(
      `INSERT INTO rett_flows (id, client_name, form_state, last_page, status, completed_at)
       VALUES ($1, $2, $3::jsonb, $4,
               CASE WHEN $5 THEN 'completed' ELSE 'in_progress' END,
               CASE WHEN $5 THEN now() END)
       ON CONFLICT (id) DO UPDATE
          SET client_name  = CASE WHEN EXCLUDED.client_name <> ''
                                  THEN EXCLUDED.client_name
                                  ELSE rett_flows.client_name END,
              form_state   = EXCLUDED.form_state,
              last_page    = EXCLUDED.last_page,
              status       = CASE WHEN $5 OR rett_flows.status = 'completed'
                                  THEN 'completed' ELSE 'in_progress' END,
              completed_at = COALESCE(rett_flows.completed_at,
                                      CASE WHEN $5 THEN now() END),
              updated_at   = now()
       RETURNING id, client_name, status, updated_at`,
      [insertId, clientName, stateJson, page, completed],
    );
    written = rows[0];
  }

  // Append-only version log. Records the exact state just persisted, keyed to
  // the live row's id + resolved name/status. Deduped against the flow's most
  // recent version so a burst of no-op syncs (e.g. page navigation) doesn't
  // pile up identical snapshots — every real change is still captured.
  await q(
    `INSERT INTO rett_flow_versions (flow_id, client_name, status, form_state, last_page, event)
     SELECT $1, $2, $3, $4::jsonb, $5, 'sync'
      WHERE NOT EXISTS (
        SELECT 1 FROM rett_flow_versions v
         WHERE v.flow_id = $1
           AND v.form_state = $4::jsonb
           AND v.version_id = (SELECT max(version_id) FROM rett_flow_versions WHERE flow_id = $1)
      )`,
    [written.id, written.client_name, written.status, stateJson, page],
  );

  return { id: written.id, status: written.status, updatedAt: written.updated_at };
}
