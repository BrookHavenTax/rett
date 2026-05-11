// Express proxy for the RETT React app.
//
// Responsibilities:
//   1. Hold the Gemini API key in process.env so the browser bundle never
//      sees it.
//   2. Accept multipart W-2 / 1040 uploads at POST /api/gemini/extract-w2
//      and proxy them to generativelanguage.googleapis.com with the same
//      JSON-extraction prompt the upstream pmq-handler.js uses.
//   3. Rate-limit per IP, cap upload size at 10 MB, validate mime types.
//
// Run locally with `node server/index.js` (or `npm run dev` from the
// rett-react root, which runs vite + this proxy concurrently). In
// production, run under pm2 behind Nginx — see ../DEPLOYMENT.md.

// Load env from server/.env regardless of where node was launched from
// (concurrently runs us with cwd=rett-react; pm2 in production runs us with
// cwd=/var/www/rett-react/server). Either way, the .env we want is alongside
// this file. In production we ALSO honor /etc/rett/server.env if present.
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_CANDIDATES = [
  '/etc/rett/server.env',
  resolve(__dirname, '.env'),
];
for (const p of ENV_CANDIDATES) {
  if (existsSync(p)) dotenvConfig({ path: p, override: false });
}

const app = express();

// ---- Config from env ---------------------------------------------------
const PORT             = Number(process.env.PORT || 8787);
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';
const DEFAULT_MODEL    = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ALLOWED_ORIGINS  = (process.env.ALLOWED_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean);
const RATE_WINDOW_MS   = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const RATE_MAX         = Number(process.env.RATE_LIMIT_MAX || 30);

// ---- CORS (only used when the React app is served from a different origin
// ----  than the API; in our default Nginx config they share an origin so
// ----  this is a defense-in-depth knob).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow =
    ALLOWED_ORIGINS.includes('*') ||
    (origin && ALLOWED_ORIGINS.includes(origin));
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- Health check (used by EC2 load balancers / pm2 watchdog) ----------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    keyConfigured: Boolean(GEMINI_API_KEY),
    defaultModel:  DEFAULT_MODEL,
    uptimeSec:     Math.floor(process.uptime()),
  });
});

// ---- Multer: 10 MB cap, in-memory ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/pdf',
      'image/jpeg', 'image/jpg',
      'image/png',
      'image/webp',
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type: ' + file.mimetype), ok);
  },
});

// ---- Rate limiter (per IP, scoped to /api/gemini/*) ----
const geminiLimiter = rateLimit({
  windowMs:        RATE_WINDOW_MS,
  max:             RATE_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Rate limit exceeded — try again in a few minutes.' },
});
app.use('/api/gemini/', geminiLimiter);

// ---- Prompt: extracts income-source fields from ANY supported tax document
// ---- (W-2, 1040, 1099-NEC/MISC/INT/DIV/R/B, K-1, or a free-form client
// ---- income summary sheet). Schema is the superset the upstream calculator
// ---- expects for Section 01 (filing-status, state-code) and Section 02
// ---- (the seven income inputs). The advisor uploads whichever document they
// ---- have on hand; Gemini fills the fields it can actually find and
// ---- returns null for everything else.
const TAX_EXTRACT_PROMPT = [
  'You are a tax-document parser. The document you receive may be any of:',
  '  - a W-2',
  '  - a 1040 (any year, any schedule)',
  '  - a 1099-NEC, 1099-MISC, 1099-INT, 1099-DIV, 1099-R, or 1099-B',
  '  - a K-1 (1065 or 1120S)',
  '  - a free-form income summary sheet that lists fields as',
  '    "Label = Value" or "Label: Value" or "Label   $Value", where the',
  '    label may be a tax-form name (e.g. "Self-Employment Income = 1099 NEC")',
  '    OR a dollar amount (e.g. "W-2 Wages = 57000").',
  '',
  'Extract the fields below and return ONLY valid JSON — no markdown,',
  'no prose, no code fences — matching this exact schema:',
  '{',
  '  "filingStatus":            "single"|"mfj"|"mfs"|"hoh"|null,',
  '  "wages":                   number|null,',
  '  "federalTaxWithheld":      number|null,',
  '  "seIncome":                number|null,',
  '  "businessRevenue":         number|null,',
  '  "rentalIncome":            number|null,',
  '  "dividendIncome":          number|null,',
  '  "retirementDistributions": number|null,',
  '  "shortTermGain":           number|null,',
  '  "state":                   "two-letter state code"|null',
  '}',
  '',
  'Field-matching rules (apply in this order):',
  '  - "wages" / "W-2 Wages" / Box 1 of a W-2 / line 1a or 1z of a 1040',
  '    → wages',
  '  - "Self-Employment Income" / "SE Income" / 1099-NEC box 1',
  '    / Schedule C line 1 → seIncome',
  '  - "Business Income" / K-1 (1065 or 1120S) ordinary business income',
  '    → businessRevenue',
  '  - "Rental Income" / 1099-MISC box 1 / Schedule E line 3',
  '    → rentalIncome',
  '  - "Dividend Income" / "Dividend/Interest" / "Interest" /',
  '    1099-INT box 1 / 1099-DIV box 1a → dividendIncome (sum if both',
  '    interest and dividends appear).',
  '  - "Retirement Distributions" / "Pension" / 1099-R box 1 /',
  '    1040 line 4b/5b → retirementDistributions',
  '  - "Short-Term Capital Gain" / 1099-B short-term proceeds /',
  '    Schedule D line 7 → shortTermGain',
  '  - "Filing Status" (single / married filing jointly / married',
  '    filing separately / head of household) → filingStatus, in the',
  '    enum above (lowercase, e.g. "mfj").',
  '  - State of residence (W-2 box 15, 1040 mailing address, etc.)',
  '    → state, as a two-letter USPS code (uppercase).',
  '',
  'CRITICAL — DO NOT HALLUCINATE:',
  '  - You must only return numbers that appear LITERALLY in the document',
  '    text. Never estimate, infer, average, or "fill in" a value just',
  '    because a field label exists.',
  '  - If a label is followed by a tax-form NAME instead of a dollar',
  '    amount (e.g. "Self-Employment Income = 1099 NEC", or',
  '    "Rental Income = 1099 MISC"), the value is NOT in this document —',
  '    return null. The form name is a pointer to where the value lives,',
  '    not the value itself.',
  '  - If a field label is present but has no number, no "$" amount, and',
  '    no digit string anywhere near it, return null.',
  '  - Strip "$" and commas from numbers you DO extract. Round to whole',
  '    dollars.',
  '  - Use null (not 0) for any field you cannot confidently extract from',
  '    text actually present in the document.',
  '  - Return ONLY the JSON object, nothing else.',
].join('\n');

app.post('/api/gemini/extract-w2', upload.single('file'), async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY not configured on the server. See server/.env.',
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const model = String(req.body.model || DEFAULT_MODEL);

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const payload = {
      contents: [{
        parts: [
          { text: TAX_EXTRACT_PROMPT },
          {
            inline_data: {
              mime_type: req.file.mimetype,
              data:      req.file.buffer.toString('base64'),
            },
          },
        ],
      }],
      generationConfig: {
        response_mime_type: 'application/json',
        // Deterministic extraction. Tax data is not a creative task and we
        // never want the model to invent values for rows it cannot read.
        temperature:       0,
        topP:              0.1,
        // Gemini 2.5 Flash defaults to "thinking" mode which produces run-to-
        // run variance and, on short docs, occasionally hallucinates dollar
        // amounts for rows that only list form names (e.g. "Self-Employment
        // Income = 1099 NEC"). Disable thinking for stability + lower latency.
        thinkingConfig:    { thinkingBudget: 0 },
      },
    };

    const resp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || data?.error) {
      return res.status(502).json({
        error: data?.error?.message || `Gemini upstream error (${resp.status})`,
      });
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let fields;
    try {
      fields = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: 'Gemini returned non-JSON output. Try a clearer scan.',
      });
    }
    return res.json({ fields, model });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ---- Multer error wrapping ----
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(400).json({ error: err?.message || 'Upload error' });
});

// ---- Serve the built React app from ../dist if it exists. This lets a single
// ---- Node process serve both the static frontend and the /api proxy on EC2,
// ---- so we don't need Nginx. In dev (vite running separately) dist/ won't
// ---- exist and these handlers no-op.
const DIST_PATH = resolve(__dirname, '..', 'dist');
if (existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH, { index: 'index.html', extensions: ['html'] }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(resolve(DIST_PATH, 'index.html'));
  });
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[rett-server] listening on :${PORT} ` +
    `(model=${DEFAULT_MODEL}, key=${GEMINI_API_KEY ? 'set' : 'MISSING'})`,
  );
});
