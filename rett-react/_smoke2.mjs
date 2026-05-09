import { chromium } from 'playwright';

const health = await fetch('http://localhost:8787/api/health').then(r => r.json());
console.log('PHASE 1  /api/health =', health);
if (!health.ok || !health.keyConfigured) { process.exit(1); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

const FAKE_FIELDS = {
  filingStatus: 'mfj', wages: 165000, federalTaxWithheld: 24000,
  seIncome: 12500, businessRevenue: 45000, rentalIncome: 18000,
  dividendIncome: 7500, retirementDistributions: 0, shortTermGain: 3200,
  state: 'CA',
};
await page.route('**/api/gemini/extract-w2', async (route) => {
  await route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ fields: FAKE_FIELDS, model: 'gemini-2.5-flash' }),
  });
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForFunction(() => window.__rettEngineReady === true, null, { timeout: 30000 });
await page.click('#nav-inputs');
await page.waitForTimeout(120);

const phase2 = await page.evaluate(() => ({
  newUploaderPresent: !!document.querySelector('.w2-uploader__btn'),
  uploaderInSection02: Array.from(document.querySelectorAll('.input-section')).some(sec =>
    sec.querySelector('.section-heading h2')?.textContent?.trim() === 'Income Sources' &&
    sec.querySelector('.w2-uploader__btn')),
  oldTaxDocCardGone: !document.getElementById('pmq-tax-compact'),
  oldGeminiKeyFieldGone: !document.getElementById('pmq-gemini-key'),
  oldDropzoneGone: !document.getElementById('pmq-tax-drop'),
  section02InputsExist: ['w2-wages','se-income','biz-revenue','rental-income','dividend-income','retirement-distributions','short-term-gain']
    .every(id => !!document.getElementById(id)),
  section01TargetsExist: ['filing-status', 'state-code'].every(id => !!document.getElementById(id)),
}));
console.log('PHASE 2', phase2);

const fakePdf = Buffer.from('%PDF-1.4\n% test\n');
await page.locator('.w2-uploader__file-input').setInputFiles({
  name: 'test-w2.pdf', mimeType: 'application/pdf', buffer: fakePdf,
});
await page.waitForFunction(
  () => !!document.querySelector('.w2-uploader__status--success'),
  null, { timeout: 10000 },
);
await page.waitForTimeout(500);

const phase3 = await page.evaluate(() => {
  const v = (id) => (document.getElementById(id) || {}).value;
  const t = (id) => (document.getElementById(id) || {}).textContent;
  return {
    autofilled: {
      'w2-wages': v('w2-wages'), 'se-income': v('se-income'),
      'biz-revenue': v('biz-revenue'), 'rental-income': v('rental-income'),
      'dividend-income': v('dividend-income'),
      'retirement-distributions': v('retirement-distributions'),
      'short-term-gain': v('short-term-gain'),
      'filing-status': v('filing-status'), 'state-code': v('state-code'),
    },
    baseline: {
      'bt-ord': t('bt-ord'), 'bt-stg': t('bt-stg'),
      'bt-fed': t('bt-fed'), 'bt-state': t('bt-state'), 'bt-tot': t('bt-tot'),
    },
    statusText: document.querySelector('.w2-uploader__status--success')?.textContent,
  };
});
console.log('PHASE 3', JSON.stringify(phase3, null, 2));
await browser.close();

let bad = 0;
for (const [id, want] of Object.entries({
  'w2-wages':'165000','se-income':'12500','biz-revenue':'45000',
  'rental-income':'18000','dividend-income':'7500','short-term-gain':'3200',
  'filing-status':'mfj','state-code':'CA',
})) {
  if (phase3.autofilled[id] !== want) { console.error(`mismatch ${id}: ${phase3.autofilled[id]}`); bad++; }
}
if (phase3.baseline['bt-ord'] !== '$248,000') { console.error('bt-ord:', phase3.baseline['bt-ord']); bad++; }
if (phase3.baseline['bt-stg'] !== '$3,200') { console.error('bt-stg:', phase3.baseline['bt-stg']); bad++; }
console.log('errors:', errors, 'mismatches:', bad);
process.exit(errors.length === 0 && bad === 0 ? 0 : 1);
