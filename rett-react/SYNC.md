# Syncing with the upstream RETT repo

The upstream calculator at
[`jacobchandler111-svg/RETT`](https://github.com/jacobchandler111-svg/RETT)
is still being refined. This React app loads the upstream calculator code
verbatim from `public/legacy/`, so updating to a new upstream commit is a
single command:

```bash
npm run sync:upstream
```

## Currently synced to

| Field | Value |
| --- | --- |
| Upstream SHA | `c9b9638a7de83f8a0bed2e00fae4d1f9333670aa` |
| Upstream short SHA | `c9b9638` |
| Upstream message | Two advisor fixes: protect Schwab default on case load + tighten Projection filter |
| Upstream committed | 2026-05-16 13:17 -0400 |
| Synced to React on | 2026-05-16 |
| Upstream commits URL | <https://github.com/jacobchandler111-svg/RETT/commits/main/> |

To verify the sync state at any time:

```bash
git -C ../_original-source rev-parse HEAD
# Should equal the "Upstream SHA" row above, until a new sync happens.
```

To see exactly which upstream commits are NEW since this sync (i.e. what
the next `npm run sync:upstream` will absorb), run:

```bash
git -C ../_original-source fetch --quiet origin
git -C ../_original-source --no-pager log --oneline \
  c9b9638a7de83f8a0bed2e00fae4d1f9333670aa..origin/main
```

If that prints nothing, you're up to date. If it prints commits, those are
what `npm run sync:upstream` will pull in next.

## Standard update workflow (do this every time upstream changes)

1. **Check what's new.** Visit the commits page or run the `git log` command
   above. Read each commit message; identify which touch `js/02-tax-engine/`,
   `js/04-ui/*-render.js`, or `index.html`.

2. **Pull the JS, CSS, data, assets.**

   ```bash
   cd ~/Desktop/Rett/rett-react
   npm run sync:upstream
   ```

   The script prints the commit range that was absorbed and shows which
   files actually changed (the `s`-flag in the rsync itemize output means
   the file was modified; `t` only is just an mtime touch).

3. **Port any HTML structure changes.** If upstream's `index.html` got a new
   `<div id="...">`, new table row, new button, etc., add the equivalent JSX
   to the matching React page in `src/components/pages/`:

   | Upstream section | React file |
   | --- | --- |
   | `<section id="page-pmq">`         | `PagePMQ.tsx` |
   | `<section id="page-inputs">`      | `PageInputs.tsx` |
   | `<section id="page-baseline">`    | `PageBaseline.tsx` |
   | `<section id="page-strategies">`  | `PageStrategies.tsx` |
   | `<section id="page-projection">`  | `PageProjection.tsx` |
   | `<section id="page-supplemental">`| `PageSupplemental.tsx` |
   | `<section id="page-summary">`     | `PageSummary.tsx` |
   | `<section id="page-temp">`        | `PageTemp.tsx` |

   To diff upstream HTML against React JSX:

   ```bash
   diff -u <(cat ../_original-source/index.html) <(cat src/components/pages/*.tsx) | less
   ```

   Ignore differences in:
   - `<head>`, `<script src="...">` blocks (we use Vite + `useLegacyEngine`)
   - JSX-specific syntax (`className=` vs `class=`, `style={{}}` vs `style=""`)
   - Em-dash encoding regressions (upstream sometimes saves with Windows-1252
     mojibake like `â€"`; our TSX keeps real `—` characters)

4. **TypeScript check + build.**

   ```bash
   npx tsc --noEmit
   npm run build
   ```

5. **Update this file.** Edit the "Currently synced to" table and prepend
   a new entry to the "Sync history" section below.

6. **Commit + push + redeploy** (see `DEPLOYMENT.md`):

   ```bash
   git add public/legacy src/components/pages SYNC.md
   git commit -m "Sync upstream <short-sha>: <one-line summary>"
   git push
   ssh -i ~/.ssh/rett.pem ubuntu@<ec2-ip> '
     cd ~/rett-react/rett-react && git pull && npm run build && pm2 restart rett
   '
   ```

## Sync history

Most recent first. Each entry: upstream short SHA, date, summary of what was
applied, and which React files needed manual ports.

### 2026-05-16 — `c9b9638` (current)

Largest sync to date: **26 upstream commits** absorbed in one pass. This was
the "Vegas pre-booth" overhaul plus the post-Vegas refinements. Both the
calculator engine AND the HTML structure changed significantly, so this
sync required substantial React-side ports.

Headline upstream features:
- **Multi-property scaffold (Q1–Q7)**: Section 03 grew from a single sale
  block to a 5-property scaffold (Property 1 always visible, Properties
  2–5 hidden behind a `+ Additional Real Estate Sale` button). Each
  property carries its own sale price, cost basis, accel depreciation,
  holding-period flag, sale/closing date, strategy-implementation date,
  personal-use yes/no, and personal-use amount. Property 1 keeps the
  unsuffixed legacy IDs (`sale-price`, `cost-basis`,
  `accelerated-depreciation`, `implementation-date`,
  `strategy-implementation-date`) so legacy direct-DOM readers continue
  to work; Properties 2–5 use suffixed IDs (`sale-price-2`, etc.).
- **Per-property personal-use carve-out** replaces the old top-level
  "Will the client be investing everything?" question. Section 04 "Sale
  Proceeds" collapsed into Section 03; only the client-level "Cover any
  tax bill from sale?" (`#cover-taxes-yes-no`) remains. The legacy
  `#withhold-yes-no`, `#withhold-amount`, `#withhold-amount-group`,
  `#withhold-error` elements are kept as HIDDEN MIRRORS that
  `controls.js` aggregates from the per-property fields, so
  `inputs-collector` + `_recomputeAvailableCapital` + the engine still
  read consistent aggregate values.
- **Multi-year sale notice** (`#multi-year-sale-notice`) shown by
  `controls.js` when properties have closing dates in different
  calendar years. `cfg.propertyGainSchedule` carries the per-year data
  for downstream consumers when ready.
- **Tax Implications (Tab 2 renamed)**: nav tab is now "2. Tax
  Implications", page heading is "Tax Baseline without Strategies".
  The old advisor breakdown table (`#bt-ord`, `#bt-stg`, `#bt-ltg`,
  `#bt-recap`, etc.) is **gone** upstream. Replaced with Blake's
  "delta trio" layout: three tiles read left-to-right as the equation
  `(Without the Sale) + (Tax Due to the Sale) = (Total Tax)`. New IDs:
  `bt-without`, `bt-without-sub`, `bt-delta`, `bt-delta-sub`,
  `bt-total`, `baseline-year-sub`. Per-property breakdown panel
  (`#baseline-breakdown-panel`, `#baseline-breakdown-list`) revealed by
  double-clicking the middle tile when 2+ properties are active;
  populated by `baseline-table.js`.
- **Strategy cards**:
  - Card 1 renamed "Sell Now" → **"Proceeds at Sale"**.
  - Card 2 renamed "Seller Finance" → **"Installment Sale"** and gained
    an inline default-risk toggle (`#default-risk-toggle` /
    `#default-risk-yes-no`). The hidden select is the engine input;
    the visible div-button writes to it and dispatches `change`.
  - Card 3 renamed "Structured Sale" → **"Structured Installment Sale"**,
    lockup text changed "18 Month Lockup" → "36 Month Distribution
    Period", and the entire card is now **hidden by default**. It
    reveals when either (a) the default-risk toggle is Yes, OR (b)
    Card 3's net benefit is ≥5% higher than BOTH Card 1 and Card 2.
  - Cards 1 + 3 gained spacer rows (`.strategy-default-risk-row--spacer`)
    so the Interested/Not Interested button row lines up across all three.
- **Section 05 rename**: "Future Appreciated Asset Sale" → **"Proactive
  Tax Savings"**. The multi-field form (future-sale-price,
  future-cost-basis, future-accelerated-depreciation,
  future-long-term-gain) collapsed to a simpler pair: "How much gain?"
  (`#future-estimated-gain`) and "When will it be recognized?"
  (`#future-sale-date`). Legacy `#future-sale-yes-no` /
  `#future-sale-fields-group` preserved.
- **Q7 Long-Term Capital Gain**: new visible input in Section 02
  Income Sources (`#long-term-gain`) for non-property LT gain (stocks,
  crypto, partnership distributions). The legacy hidden mirror is
  removed; engine reads the visible field directly.
- **Case Management moved out of Client Inputs** and into the PMQ page
  (Section 00b). The case-name-input, case-load-select, case-new-btn,
  case-delete-btn IDs are unchanged so case-storage.js wires them
  identically — they just live on the PMQ page now so the saved-client
  dropdown never appears in front of the client on the Inputs page.
- `#structured-sale-duration-months` hidden default value changed
  from `""` to `"36"` (regulatory minimum + common product default).
- Continue button text "Continue to Tax Baseline" → "Continue to Tax
  Implications".
- Engine fixes that are JS-only and required NO React-side port:
  - AMT topup + Card 3 5% rule use full optimizer pipeline.
  - Supplemental deductions cap yr1 at ordinary-income pool to prevent
    NOL inflation.
  - Vegas tighten-ups: Schwab-only custodian (no empty fallback,
    donut labels fit), Card 3 5% rule, default-risk visibility logic.
  - Two advisor fixes: protect Schwab default on case load + tighten
    Projection filter.
  - Trust-withdrawal callout on Tab 7 (rendered dynamically by
    `temp-page-render.js` — no HTML host needed in React).

Files mirrored by the rsync (with content changes): 20 JS files +
`css/styles.css` (+536 LOC). Two new upstream docs
(`MULTI_PROPERTY_VERIFICATION.md`, `VEGAS_FEEDBACK_FINDINGS.md`) live
in the upstream clone but are not synced to React (they're project
notes, not code).

React-side ports applied this round:

- `src/components/NavTabs.tsx` — Tab 2 label "2. Tax Baseline" →
  "2. Tax Implications".
- `src/components/pages/PagePMQ.tsx` — added Section 00b
  Case Management card (case-name-input, case-load-select,
  case-new-btn, case-delete-btn) inside `pmq-left-col`.
- `src/components/pages/PageInputs.tsx` — major rewrite:
  - Removed old Section 00 Client controls (moved to PMQ).
  - Added `page-inputs-title--banner` class on the H2.
  - Removed `"-- Select Custodian --"` placeholder option (engine
    requires a non-empty custodian).
  - Added Q7 visible Long-Term Capital Gain input in Section 02.
  - Section 03 fully rewritten with `<PropertyBlock n={1..5}/>`
    helper (~50 unique field IDs across 5 blocks), plus
    `#property-add-btn`, `#multi-year-sale-notice`, hidden withhold
    mirrors, and `#cover-taxes-yes-no`.
  - Section 05 renamed "Proactive Tax Savings" with simplified
    `#future-estimated-gain` + `#future-sale-date` form.
  - Hidden `#structured-sale-duration-months` default `"36"`.
  - Removed obsolete hidden `#long-term-gain` mirror.
  - Continue button → "Continue to Tax Implications →".
- `src/components/pages/PageBaseline.tsx` — full rewrite to the
  3-tile delta layout (`#bt-without`, `#bt-delta`, `#bt-total`,
  +subs, +`#baseline-breakdown-panel`). Old `bt-*` IDs (`bt-ord`,
  `bt-stg`, `bt-ltg`, `bt-recap`, `bt-loss-off`, `bt-loss-cfy`,
  `bt-taxable`, `bt-fed`, `bt-fed-ord`, `bt-fed-recap`, `bt-fed-lt`,
  `bt-amt`, `bt-state`, `bt-niit`, `bt-addmed`, `bt-setax`, `bt-tot`,
  `bt-ord-sub`, `bt-ltg-sub`) gone — confirmed upstream stripped them.
  Page heading now reads "Tax Baseline without Strategies".
- `src/components/pages/PageStrategies.tsx` — Card 1 rename
  ("Proceeds at Sale"), Card 2 rename ("Installment Sale") + new
  default-risk toggle row + `#default-risk-yes-no` hidden mirror,
  Card 3 rename ("Structured Installment Sale") + `hidden` attribute
  + lockup text "36 Month Distribution Period", spacer rows on
  Cards 1 + 3 for button-row alignment.

React-side carry-forwards (preserved through this sync, smoke-tested
working):

- `src/components/W2Uploader.tsx` — same-origin call to
  `/api/gemini/extract-w2` for in-memory tax-document scan + autofill.
- `server/index.js` — deterministic `generationConfig`
  (`temperature: 0`, `topP: 0.1`, `thinkingConfig.thinkingBudget: 0`)
  + no-hallucination prompt + static-dist serving for single-process
  EC2 deploy.
- `src/hooks/useLegacyEngine.ts` — explicit `bindControls()` /
  `_syncPmqNameFromCase()` calls + drop-un-named-draft on page load.
- `src/components/NavTabs.tsx` — Tab 7 reveal `+` / `−` toggle.
- `src/styles/app.css` — near-black right border on the Tab 7
  toggle buttons + W-2 uploader styling.

Smoke-tested after sync (Playwright, against `npm run dev`):

- All ~80 critical legacy DOM IDs render (zero missing).
- Zero JavaScript / console errors on page load.
- `+ Additional Real Estate Sale` button reveals Property 2 (legacy
  `controls.js _showNextSlot` correctly finds the React-mounted DOM).
- Sale price `$1,500,000` in Property 1 → Tax Implications page
  renders `bt-delta = $400,688`, `bt-total = $400,688` (engine
  picking up the new multi-property aggregate cleanly).
- Card 3 hidden by default on entry to Strategies page.
- Tab 7 `+` toggle reveals the tab and swaps in the `−` button.

Commits, oldest first (26 total):

- `eab89d3` Vegas pre-booth: Q1-Q7 multi-property + Tax Implications +
  cosmetic palette swap.
- `ca85471` Add Vegas feedback findings + multi-property verification
  audit docs.
- `b2d0129` Tax Implications: double tile size for stage presence.
- `2c8e0a4` Projection italic J fix + relocate "+ Additional Real
  Estate Sale" to bottom.
- `6487f40` Per-property strategy dates + strategy renames + label
  tweaks.
- `799def7` Per-property personal-use carve-out (replaces top-level
  investing question).
- `35ef872` Section 05 rename: "Future Sale Loss Target" → "Proactive
  Tax Savings".
- `4837162` Fix conditional .input-row hidden — Amount box now hides
  on No.
- `1e9ee55` Tax Implications tiles: shrink fonts so 10-11 char dollar
  values fit.
- `a427053` Projection titles: swap Fraunces → Georgia so the J in
  "January" renders normally.
- `969bc6e` Conditional Card 3 (Structured Installment Sale) +
  default-risk toggle.
- `fc75a47` Card 3 5% rule: use full optimizer pipeline for accurate
  net comparison.
- `8f2e82a` Nav tabs: swap Fraunces italic → Georgia upright.
- `38c572e` Strategy grid: 2-card mode 460px (bigger, centered),
  3-card mode 1fr (single row).
- `5451a94` Move Case Management to PMQ + banner header + Tab 7
  trust-withdrawal callout.
- `97ee7c9` Tab 2: rename to "Tax Baseline without Strategies" +
  drop advisor breakdown.
- `dce8391` Strategy Card 3 [hidden] now actually hides — was
  overridden by `.grid` display.
- `1c81962` Strategy cards: Card 1 → "Proceeds at Sale" +
  click-toggle for default risk + row alignment.
- `8835d80` Strategy cards: progressive visibility (1 / 1+2 / 1+2+3)
  by which strategy wins.
- `aae6152` Default-risk question: hide when C dominates or trails
  by ≥10%; keep visible when user opts in.
- `f43f139` Strategy cards: tighten thresholds — Card 3 5% rule +
  toggle ±5% band.
- `f0e0e83` Vegas tighten-up: Schwab-only custodian, no empty
  fallback, donut labels fit.
- `bc53e9e` Supplemental deductions: cap yr1 at ordinary income pool
  to prevent NOL inflation.
- `d45dde6` Helper/page parity + extend ord-pool cap to Cost Seg /
  Equipment / Charitable.
- `72cf891` Multi-property: plumb per-year gain schedule on cfg +
  surface limitation banner.
- `c9b9638` Two advisor fixes: protect Schwab default on case load +
  tighten Projection filter.

### 2026-05-12 — `deaeb68`

Three upstream commits absorbed. No React-side HTML port needed — every
`index.html` diff in this range was the cache-buster `?v=` increment.

Commits, oldest first:

- `e3a1987` AMT: add back standard deduction to AMTI per §55(b)(1)(A) /
  Form 6251 line 2a. (Closes the $9,896 reconciliation gap the previous
  sync's commit message flagged — engine now matches CPA software exactly
  on the canonical scenario.) `tax-calc-federal.js`,
  `engine-self-test.js`.
- `88b4fc7` Return on Planning: render as percentage (net / fees), not
  multiplier. (Display change on the Strategy Summary card.)
  `strategy-summary-render.js`.
- `deaeb68` Run pipeline before strategy-summary render so hard refresh
  lands correct. (Ordering fix so the Strategy Summary doesn't render
  stale numbers on a hard refresh.) `controls.js`.

Files actually mirrored by the rsync (with content changes): four JS files
under `public/legacy/js/02-tax-engine/` and `public/legacy/js/04-ui/`.

React-side carries forward (unchanged by the sync):

- `src/components/W2Uploader.tsx`
- `server/index.js` Gemini prompt + deterministic `generationConfig`.
- `src/hooks/useLegacyEngine.ts` explicit `bindControls()` call + drop-
  un-named-draft on page load. (Note: `controls.js` was updated this
  round; the explicit-bind workaround still applies since the upstream
  change was an additive pipeline call inside `bindControls`, not a
  refactor of when it runs.)
- `src/components/pages/PageBaseline.tsx` four federal-tax sub-rows
  (`bt-fed-ord`, `bt-fed-recap`, `bt-fed-lt`, `bt-amt`).

### 2026-05-11 (evening) — `0c01cee`

Six upstream commits absorbed in one pass. No React-side HTML port needed —
only `tax-calc-federal.js` and `temp-page-render.js` changed content; all
`index.html` diffs in this range were the cache-buster `?v=` increment plus
blank-line whitespace shuffles.

Commits, oldest first:

- `99a9271` Revert AMT 25% recap carve-out; restore Tab 7 matched-timing
  baseline. (Walked back the recap @ 25% AMT fix from `d4c51cc` after CPA
  review said the original behavior was correct.) `tax-calc-federal.js`,
  `temp-page-render.js`.
- `3c609f2` Re-apply §1250 recap @ 25% inside AMT per Form 6251 Part III.
  (Re-applied the carve-out after deeper CPA review against Form 6251.)
  `tax-calc-federal.js`.
- `f5f88a2` Fix 2026 AMT 26%/28% breakpoint: $244,000 → $244,500 per Rev.
  Proc. 2025-32. `tax-calc-federal.js`.
- `893f480` Reconcile Tab 7 per-year sum to bottom panel; show all
  Interested supps. (Per-year cards now sum to Tab 6 hero number.)
  `temp-page-render.js`.
- `98fbc89` Tab 7: revert supp filter relax + rename to 'Gain from lower
  tax bracket'. (Restored `s.rivalry.funded` gate; relabeled the deferred-
  strategy gap row per CPA preference.) `temp-page-render.js`.
- `0c01cee` Allocate lower-bracket benefit to Y0 card so per-year nets sum
  to total. (Y0's activity card now shows an explicit "Gain from lower tax
  bracket (deferred recognition)" row.) `temp-page-render.js`.

React-side carries forward (unchanged by the sync):

- `src/components/W2Uploader.tsx`
- `server/index.js` Gemini prompt + deterministic `generationConfig`.
- `src/hooks/useLegacyEngine.ts` `bindControls()` + drop-un-named-draft
  on page load.
- `src/components/pages/PageBaseline.tsx` four federal-tax sub-rows
  (`bt-fed-ord`, `bt-fed-recap`, `bt-fed-lt`, `bt-amt`) from the previous
  sync — still required by the upstream `baseline-table.js`.

### 2026-05-11 (morning) — `b9ac0f6`

Two upstream commits absorbed in one pass:

- `d4c51cc` Fix AMT mis-trigger on recap-heavy returns; align Tab 7 NIIT
  baseline with Page 3.
  - `js/02-tax-engine/tax-calc-federal.js` — §1250 unrecaptured gain is now
    charged at 25% inside AMT instead of riding the 26/28% band; eliminates
    ~$38K spurious AMT on MFJ + $500K recap.
  - `js/04-ui/temp-page-render.js` — Tab 7 reads `doNothingBaseline` so the
    CPA audit card matches Page 3's net-benefit KPI; trailing rows inflate
    investment income at 2%/yr.
- `b9ac0f6` Align Page-2 baseline NIIT with engine; split federal tax
  display.
  - `js/04-ui/baseline-table.js` — NIIT base now includes §1250 recap per
    §1411(c)(1)(A)(iii); fills the new federal-tax sub-rows.
  - `index.html` (HTML structure change) — manually ported into
    `src/components/pages/PageBaseline.tsx`: added four indented sub-rows
    under "Federal Income Tax" (`bt-fed-ord`, `bt-fed-recap`, `bt-fed-lt`,
    `bt-amt`), each hidden when zero.

React-side carries forward (unchanged by the sync):

- `src/components/W2Uploader.tsx` — the inline W-2 / 1099 / K-1 / income-
  summary uploader in Section 02.
- `server/index.js` — Express proxy; broadened Gemini prompt with
  `temperature: 0`, `topP: 0.1`, `thinkingBudget: 0` so extraction is
  deterministic and Gemini will not hallucinate dollar amounts for rows
  that only list form names.
- `src/hooks/useLegacyEngine.ts` — explicit `bindControls()` + drop-the-
  un-named-draft on page load.

### (Earlier syncs not retroactively logged.)

The first-pass port of upstream was created before this log existed; see
the README "Currently synced to" history in git if you need to find the
exact starting commit.

That runs `scripts/sync-from-upstream.sh`, which:

1. `git pull`s the upstream repo into `../_original-source/` (cloning it
   fresh if it doesn't exist).
2. `rsync`s `js/00-data` … `js/05-projections` and `js/04-ui` into
   `public/legacy/js/`. `--delete` is on, so files removed upstream
   disappear locally too.
3. Copies `data/taxBrackets.json` and `css/styles.css` verbatim.
4. Prints the upstream commit range so you can see exactly which commits
   were absorbed.

## What kinds of upstream changes need React-side work?

| Where the upstream change is             | What you need to do                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `js/00-data` (custodians, strategies)    | Nothing — calculator picks it up.                                           |
| `js/01-brooklyn` (Brooklyn math)         | Nothing.                                                                    |
| `js/02-tax-engine` (tax math, brackets)  | Nothing.                                                                    |
| `js/03-solver` (solvers, decision)       | Nothing.                                                                    |
| `js/05-projections` (projection engine)  | Nothing.                                                                    |
| `data/taxBrackets.json`                  | Nothing.                                                                    |
| `css/styles.css`                         | Nothing.                                                                    |
| `js/04-ui` *renderers* (`*-render.js`)   | Confirm the host `<div id="...-host">` still exists in the matching React page. |
| `js/04-ui/pmq-handler.js`                | Skipped intentionally — replaced by `W2Uploader.tsx`.                       |
| `js/04-ui/pmq-questions.js`              | Skipped intentionally — to be ported in a future pass.                      |
| New top-level HTML element added upstream | Add the matching JSX to the relevant `src/components/pages/*.tsx` page.    |

## How to tell what kind of change happened

After running the sync, the script prints the list of upstream commits it
absorbed. Scan that list for:

- File paths under `js/04-ui/` — those are the only ones likely to need a
  React-side change.
- Words like "new field", "new section", "added id" in the commit message —
  those almost always mean a new DOM element needs to be reflected in JSX.

If you're unsure, you can always diff the upstream `index.html` against
`rett-react/index.html` plus `src/components/pages/*.tsx`:

```bash
diff -u ../_original-source/index.html rett-react/index.html | less
```

The differences should be:

1. The `<head>` block (we use Vite's index.html for the React entry).
2. The `<script src="...">` load order (we load via `useLegacyEngine`).
3. The page bodies, which are now JSX in `src/components/pages/`.

Anything other than those three categories is probably an upstream change
you need to mirror.

## Tagging upstream-known-good versions

Before pulling a major upstream change, tag the working tree:

```bash
cd ../_original-source
git tag rett-react-known-good-$(date +%Y%m%d)
cd ../rett-react
git add -A && git commit -m "snapshot: pre-sync $(date +%Y-%m-%d)"
```

If a sync goes badly, you can `git reset --hard` and `git checkout` the
upstream tag to roll everything back.
