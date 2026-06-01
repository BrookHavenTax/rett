#!/usr/bin/env node
// End-to-end: generate dummy 1040 → Gemini extract → verify all Income Sources keys.
//
// Usage (from rett-react root, API on :8787 with GEMINI_API_KEY set):
//   node scripts/test-1040-autofill.mjs [path-to-pdf]
//
// Exit 0 = all fields matched; exit 1 = mismatch or API error.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const API = process.env.RETT_API_URL || 'http://127.0.0.1:8787';
const PDF = process.argv[2] || resolve(homedir(), 'Desktop', 'Rett', 'sample-1040.pdf');

// Expected values — must match scripts/generate-dummy-1040.mjs DATA
const EXPECTED = {
  filingStatus: 'mfj',
  state: 'NY',
  wages: 165_000,
  interestIncome: 2_400,
  dividendIncome: 5_600,
  retirementDistributions: 18_000,
  socialSecurity: 32_000,
  rentalIncome: 28_000,
  shortTermGain: 12_500,
  longTermGain: 47_500,
  seIncome: 22_000,
  businessRevenue: 45_000,
};

function resolveBusinessIncome(fields) {
  if (typeof fields.businessIncome === 'number') return fields.businessIncome;
  const se = typeof fields.seIncome === 'number' ? fields.seIncome : 0;
  const biz = typeof fields.businessRevenue === 'number' ? fields.businessRevenue : 0;
  return se + biz || null;
}

function numEq(a, b) {
  return typeof a === 'number' && typeof b === 'number' && a === b;
}

function generatePdf() {
  const r = spawnSync(process.execPath, ['scripts/generate-dummy-1040.mjs', PDF], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  console.log(r.stdout.trim());
}

async function extract() {
  const buf = readFileSync(PDF);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'sample-1040.pdf');
  const resp = await fetch(`${API}/api/gemini/extract-w2`, { method: 'POST', body: fd });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return data.fields || {};
}

function check(label, got, want) {
  const ok = numEq(got, want) || (label === 'filingStatus' && got === want) || (label === 'state' && String(got).toUpperCase() === want);
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${label.padEnd(26)} expected ${want}  got ${got ?? 'null'}`);
  return ok;
}

async function main() {
  generatePdf();

  console.log(`\nCalling Gemini via ${API} …`);
  const fields = await extract();
  console.log('\nField checks:');

  let pass = true;
  for (const [k, v] of Object.entries(EXPECTED)) {
    if (!check(k, fields[k], v)) pass = false;
  }

  const bizTotal = resolveBusinessIncome(fields);
  const wantBiz = EXPECTED.seIncome + EXPECTED.businessRevenue;
  if (!check('business-income-amount (computed)', bizTotal, wantBiz)) pass = false;

  console.log(`\nRaw JSON:\n${JSON.stringify(fields, null, 2)}`);

  if (pass) {
    console.log('\nPASS — all Income Sources fields extracted correctly.');
    process.exit(0);
  }
  console.log('\nFAIL — one or more fields missing or wrong. Re-run after prompt/map changes.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
