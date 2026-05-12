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
| Upstream SHA | `deaeb6894cd5307bc55824b6ca9981a928a40f38` |
| Upstream short SHA | `deaeb68` |
| Upstream message | Run pipeline before strategy-summary render so hard refresh lands correct |
| Upstream committed | 2026-05-12 14:42 -0400 |
| Synced to React on | 2026-05-12 |
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
  deaeb6894cd5307bc55824b6ca9981a928a40f38..origin/main
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

### 2026-05-12 — `deaeb68` (current)

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
