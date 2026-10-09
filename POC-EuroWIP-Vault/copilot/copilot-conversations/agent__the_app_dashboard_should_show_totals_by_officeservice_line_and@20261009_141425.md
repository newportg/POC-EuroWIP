---
epoch: 1791551665048
mode: agent
backendId: opencode
projectId: "debe6f1a-9d0f-437b-b8db-43703f81ca1f"
sessionId: "ses_edf351232ffeskz9YtlbFutBJJ"
agentLabel: "Dashboard totals by office and status"
usage: '{"usedTokens":83753,"contextWindow":200000,"updatedAt":1791555743579}'
tags:
  - copilot-conversation
---

**user**: the app dashboard should show totals by office/service line and status, also what is inhand, billed/lost
[Timestamp: 2026/10/09 14:14:25]

**ai**: I have the full picture now. The app is the Svelte POC at `POC/wip-poc`, and its dashboard currently only has KPI tiles plus an "open pipeline by service line" card that appears only when a month is selected. Plan:Now the breakdown component:Now wire it into `App.svelte`:Tests caught two references to what I replaced. Fixing the smoke test, browser check, and the two warnings:All checks pass. Let me see if the browser check can run end-to-end to confirm the rendered dashboard:End-to-end browser check passes — all three breakdown tables render, "In hand" KPI shows 5,400,000. Now committing per the vault's rules:The EuroWIP POC dashboard now shows the breakdowns you asked for. Committed as `0fbc9cf`.

**What's on the dashboard now** (replaces the old "Open pipeline by service line" card, which only appeared when a month was picked — these three always render and respect the month selector):

- **Totals by status** — all four states, including **In hand (WIP)**, **Billed**, **Paid**, **Lost**: line count, gross, share of gross, and the weighted figure for open lines, with a totals footer.
- **Totals by office** — one row per owning office (KF Paris / KF Madrid / KF London), with **In hand · Billed · Paid · Lost · Weighted** side by side plus totals.
- **Totals by service line** — same columns, full width, ordered by gross value.

**How it's built** — in `POC/wip-poc`:

- `src/lib/repo.js` — new `getTotalsByStatus`, `getTotalsByOffice`, `getTotalsByServiceLine` (all month-scoped, reading `v_wip`, so PL-2 denormalised service line and office carry the report without joins — this is the wiki's "weighted pipeline by `kf_serviceline`, `kf_owningoffice`" requirement, minus sector). `getPipelineByServiceLine` is gone.
- `src/components/TotalsTables.svelte` — new component holding the three cards; the office and service-line tables share one snippet so the column set can't drift apart.
- `src/App.svelte` — a shared `{@render overview()}` snippet feeds both the Dashboard and WIP tabs, killing the duplicated markup. The KPI and totals queries now key off the `version` invalidation counter, so **billing or losing a line refreshes the KPI bar too** (previously it could go stale after a status change).
- `src/components/KpiBar.svelte` — "Gross pipeline" tile relabelled **"In hand — gross WIP, not yet billed"**; Billed and Lost tiles were already there.

**Verification** — `svelte-check` 0 errors/0 warnings, `npm test` 76 checks pass (including four new smoke checks asserting the status split reconciles to the KPI totals and honours the month filter), and the headless-Chrome check confirms the rendered page: `breakdown tables: status yes, office yes, service line yes`, in-hand KPI 5,400,000.

Two things worth knowing:

- The mixed-currency caveat still applies — EUR and GBP lines are summed without conversion, so the totals inherit the flag already shown under the KPI bar (the wiki treats this as a known reporting gap, Q7 territory).
- Backlog **T-41** ("weighted pipeline report by service line, sector and owning office") is now covered for service line and office, but **not sector** — I've left it unchecked in [[wip-delivery-backlog]].
[Timestamp: 2026/10/09 14:14:25]

**user**: dashboard doesnt need the wip lines as they are on the wip tab
[Timestamp: 2026/10/09 14:27:20]

**ai**: Removing the WIP lines block from the Dashboard tab:

Now check what the browser test expects on the default tab:All green. Running the end-to-end browser check against the fresh build:One oddity: the log still says `WIP line created: null` even though `new row visible: yes`. Let me check the escaping in that expression:Line 302 uses a single `\d` inside a template literal, which JS unescapes to a literal `d` — so the browser was testing `/WIP-d{6}/`. Pre-existing bug in that log line:Everything passes, and the log now correctly reports `WIP-000017`. Committing:Done — the Dashboard tab is now purely a reporting screen: KPI bar + the three totals tables (status / office / service line). Committed as `bf92978`.

What changed:

- **`src/App.svelte`** — removed the WIP line table, detail panel, and Quick actions card from the Dashboard branch; both Dashboard and WIP tabs now render the same `{@render overview()}`, but only the WIP tab adds the line list underneath. Dropped the now-unused `.hint` styles.
- **`viewInWip`** — after creating a record, "view in WIP" now lands on the **WIP** tab instead of the Dashboard, since that's where the list (and the search filter it sets) actually shows now.
- **`scripts/browser-check.mjs`** — updated to match: it reports the Dashboard as intentionally free of line rows, switches to the WIP tab before clicking a row and checking the detail panel, and the creation flow now asserts routing to the WIP tab. Also fixed a latent escaping bug there (`/WIP-\d{6}/` inside a template literal was arriving in the browser as `/WIP-d{6}/`), so the log finally reports the created reference — `WIP line created: WIP-000017`.

Verification: `svelte-check` 0/0, `npm test` 76 checks pass, production build succeeds, and the headless-Chrome run passes with `WIP line list on Dashboard: absent`, all three breakdown tables present, and the create → WIP-tab → row visible flow working.
[Timestamp: 2026/10/09 14:27:20]

**user**: the create tab should take the same form as the create Instruction tab in this application C:\Source\Obsidian\Projects\POC-Instructions\POC-Instructions-Vault\POC\instruction-wizard.html
[Timestamp: 2026/10/09 14:38:23]

**ai**: The reference is a 2,947-line HTML wizard. Let me survey its structure before adapting it:## Objective
- Make the EuroWIP POC app dashboard show WIP totals by office, by service line, and by status — including what is in hand (WIP), billed, paid and lost.
- Follow-up: the Dashboard tab should no longer show the WIP lines table/detail, since the WIP tab already owns that.

## Important Details
- App lives at `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc` (Svelte 5 runes + `sql.js` in-memory/IndexedDB). Git repo root is `C:\Source\Obsidian\Projects\POC-EuroWIP`.
- Data model: `v_wip` view carries `wip_status` (`WIP`/`Billed`/`Paid`/`Lost`), `office_name`, `service_line`, `gross_fee`, `office_retained`, `probability`, `reporting_month`, `is_stale`. Seed: 3 offices (KF Paris/Madrid/London), 16 WIP lines, 3 reporting months.
- "In hand" = WIP status (won, not yet billed); weighted = `office_retained * probability / 100` on open lines only.
- Mixed-currency caveat (EUR + GBP summed unconverted) already surfaced by `currencyNote` in `KpiBar`; wiki treats it as an open reporting gap (Q7).
- Wiki backlog `T-41` ("weighted pipeline by service line, sector and owning office") is covered for service line + office but **not sector** — left unchecked in `wiki/wip-delivery-backlog.md`.
- Repo rule (AGENTS.md): commit after meaningful changes, but only app files — never `.obsidian/workspace.json` or `copilot/copilot-conversations/*.md` (vault housekeeping).
- Verification commands (run in `POC\wip-poc`): `npm run check`, `npm test` (= `npm run verify && npm run smoke`), `npm run build`; browser check needs `npm run preview` listening on `http://localhost:4173` (started via PowerShell `Start-Process npm.cmd ... -WindowStyle Hidden`, killed via `Get-NetTCPConnection -LocalPort 4173`).

## Work State
### Completed
- `src/lib/repo.js`: removed `getPipelineByServiceLine`; added `getTotalsByStatus(month)`, `getTotalsByOffice(month)`, `getTotalsByServiceLine(month)` via shared `GROUP_TOTALS_SQL(dimensionExpr)` (columns `group_name`, `lines`, `in_hand`, `billed`, `paid`, `lost`, `weighted`, `total`; ordered `total DESC`; month filter `(? IS NULL OR reporting_month = ?)`). `getTotalsByStatus` always returns all four statuses via `['WIP','Billed','Paid','Lost']`.
- `src/components/TotalsTables.svelte` (new): three cards — "Totals by status" (status pill, lines, gross, share, weighted), "Totals by office", "Totals by service line" (shared `{#snippet groupTable(rows, key, header)}`), totals footers, note explaining In hand/weighted, scoped CSS (`.breakdowns` 2-col grid, `.wide` full width, `tr.nodrag` cursor reset, media query at 1100px).
- `src/App.svelte`: imported `TotalsTables`; `{#snippet overview()}` renders `KpiBar` + `TotalsTables`; rendered on both Dashboard and WIP tabs; `kpi`, `statusTotals`, `officeTotals`, `serviceTotals` now key off `version` (`$derived(version >= 0 && repo.getX(...))`) so mutations refresh them; deleted both duplicated "Open pipeline by service line" cards.
- `src/components/KpiBar.svelte`: first tile relabelled "In hand" with sub "gross WIP, not yet billed".
- Dashboard tab now renders only `{@render overview()}` — WIP table/detail/quick-actions block removed; `.hint` CSS removed; `viewInWip(name)` now sets `tab = 'wip'` instead of `'dashboard'`.
- `scripts/smoke.mjs`: replaced `getPipelineByServiceLine` check with `getTotalsByStatus`, `getTotalsByOffice`, `getTotalsByServiceLine`, plus month-filter check — includes cross-checks that status split reconciles to `getKpis` totals.
- `scripts/browser-check.mjs`: probes renamed (`kpiInHand`, `hasStatusTotals`/`hasOfficeTotals`/`hasServiceLineTotals`), clicks WIP tab before row selection, creation-flow now expects WIP tab (`onWipTab`), log labels updated.
- Verified: `svelte-check` 0 errors / 0 warnings; `npm test` green (verify 31 passed, smoke all passed); `npm run build` ok; browser check PASS — `in-hand KPI: 5,400,000`, `breakdown tables: status yes, office yes, service line yes`, `WIP line list on Dashboard: absent`, `routed to WIP tab: yes`.
- Commit `0fbc9cf` "poc: dashboard shows totals by status, office and service line" (first round: repo.js, TotalsTables.svelte, App.svelte, KpiBar.svelte, smoke.mjs, browser-check.mjs).

### Active
- Second round of changes (remove WIP list from Dashboard, `viewInWip` → WIP tab, browser-check updates) is **uncommitted**.
- Investigating cosmetic oddity in browser-check output: `WIP line created: null` while `new row visible: yes`. `wipRef` (browser-check.mjs ~lines 298-303) reads `bodyRows.map(tr => tr.textContent.match(/WIP-\d{6}/)?.[0]).find(Boolean) ?? null` — should be non-null if a `tbody tr` contains `WIP-000017`; row may live outside `tbody`/in a panel, or the totals-table rows precede it.

### Blocked
- (none)

## Next Move
1. Read `scripts/browser-check.mjs` lines ~315-354 (and the WIP-tab rendering path) to explain `wipRef === null` while `rowVisible === true`; fix the probe or downgrade it to informational.
2. Re-run `npm run check && npm test && npm run build`, then the preview + `node scripts/browser-check.mjs` loop; then commit the second round only (`git add POC-EuroWIP-Vault/POC/wip-poc/src POC-EuroWIP-Vault/POC/wip-poc/scripts`; `git commit`) with a message like "poc: dashboard drops the WIP line list".

## Relevant Files
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/repo.js`: new totals queries; only module the UI talks to.
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/TotalsTables.svelte`: new breakdown component (status/office/service line cards).
- `POC-EuroWIP-Vault/POC/wip-poc/src/App.svelte`: `overview()` snippet, version-keyed deriveds, tab routing, `viewInWip`.
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/KpiBar.svelte`: "In hand" KPI tile.
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/smoke.mjs`: totals-query assertions (uncommitted changes from round 2 unrelated).
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/browser-check.mjs`: e2e probes; open question on `wipRef`.
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/schema.js`, `seed.js`, `db.js`: `v_wip`, seed data, `query`/`tx` primitives.
- `POC-EuroWIP-Vault/wiki/wip-reporting-and-kpis.md`, `wiki/wip-delivery-backlog.md`: reporting requirements (T-41, sector gap) and open questions.
- `POC-EuroWIP-Vault/AGENTS.md`: commit-after-meaningful-changes rule.I've now read the full reference wizard. Before I start a large rewrite of the Create tab, let me confirm what the WIP POC currently has to map against:I've now read the whole reference (`instruction-wizard.html`, 3,182 lines) and the current WIP POC's `App.svelte`, `CreatePanel.svelte`, and `repo.js`. Before I rewrite the Create tab, I need to confirm scope, because the two apps differ in ways that make a literal copy impossible — and getting this wrong means a large wasted rewrite.

## What the reference wizard actually is

A single-page, 6-step wizard with its own mock data layer, entirely separate from the WIP POC's schema:

- **Step 1 Type** — a grid of 13 instruction-type cards (`TYPES`), each mapping a service line → core record (`Instruction`/`Mandate`/`Engagement`) → a specialised entity (`kf_SalesInstruction`, `kf_Deal`, …). Picking a type rewrites the later steps.
- **Step 2 Client** — a **mock client lookup** (15 hard-coded records) plus 6 typed fields.
- **Step 3 Property** — **Loqate** address Find/Verify (live external API calls) plus address fields.
- **Step 4 Details** — dynamic fields per selected type.
- **Step 5 Terms** — fee basis/amount, currency, expected revenue, owning office → negotiator, notes.
- **Step 6 Review** — a readiness checklist (required-field gate), a read-only review grid, an **Accept** button disabled until every step is green, and a frozen JSON payload.

It also persists the draft to its own `sql.js` DB (separate from the WIP POC's schema) and only *pushes* accepted instructions into a WIP list.

## Why I can't just port it as-is

- The WIP POC drives everything from **lookup tables** it already has (`account`, `business_unit`, `property`, `contact`, `service_line_parent`) — not the wizard's hard-coded mock directories.
- The 13-type taxonomy and per-type `Details` fields **don't exist** in the WIP POC schema; adding them would mean extending the DB and seed.
- Loqate does live web calls, which is out of scope here (no network in this app, and the vault rule is no browsing unless asked).
- The WIP POC's Create tab also creates **WIP lines**, which the reference wizard has no concept of.

## My recommended reading of "same form"

Rebuild the Create tab as a **stepped wizard that mirrors the reference's structure and UX**, wired to the WIP POC's own data — i.e.:

- **Step 1 Type** — service-line cards (from `service_line_parent`) that set the instruction type/core, replacing the 13 hard-coded types.
- **Step 2 Client** — brand, legal entity, primary contact (searchable selects over `account`/`contact`, no mock directory).
- **Step 3 Property** — property lookup over the `property` table (no Loqate).
- **Step 4 Terms** — owning office → negotiator, expected revenue, start/signed dates, status, sector, comments.
- **Step 5 Review** — readiness checklist, review grid, and the **Accept** gate, calling `repo.createInstruction`.
- Keep **WIP-line creation** as a second wizard/step in the same Create tab, styled identically, calling `repo.createWip`.

Before I build it, please confirm three things:

1. **Scope** — should the Create tab become the full 5-step wizard for the Instruction, with the WIP-line creator kept alongside it (my recommendation)? Or Instruction wizard only, with WIP-line creation dropped?
2. **Style** — reuse the **WIP POC's existing dark theme** (just taking the wizard's *structure/UX*), or also adopt the reference's indigo look-and-feel (step pills, type cards, gradient title)?
3. **Fidelity of the extras** — do you want the reference's richer touches ported over too (readiness checklist, review grid, frozen-JSON accept record, "free navigation + required-field flagging"), or a simpler wizard that just chunks the existing fields into steps?
[Timestamp: 2026/10/09 14:38:23]

**user**: yes go ahead
[Timestamp: 2026/10/09 14:43:52]

**ai**: Proceeding with my recommendation: 5-step wizard for the Instruction (WIP-line creator kept alongside), WIP POC theme, and the reference's richer UX (free navigation, per-step required-field gating, readiness checklist, review grid, frozen accept record). Let me gather the data model and test harness first.Now I have the full picture. Let me set up a task list and check the remaining test harness before writing.

**Error:** Internal error: Bad Request: {"model":"big-pickle"}
[Timestamp: 2026/10/09 14:43:52]

**user**: have you finished
[Timestamp: 2026/10/09 14:53:19]

**ai**: Not yet — I'm mid-implementation. I've finished all the reading/recon and the plan is locked. What remains is writing the code and running the checks. Here's my status:

- ✅ Read the reference wizard (3,182 lines) and the full WIP POC (`schema.js`, `seed.js`, `db.js`, `repo.js`, `app.css`, `App.svelte`, `CreatePanel.svelte`) and the test harness (`smoke.mjs`, `browser-check.mjs`, `verify.mjs`).
- ⏳ Next: add wizard CSS → build `InstructionWizard.svelte` → rewrite `CreatePanel.svelte` (mode switch + WIP-line form) → update `browser-check.mjs` → run `check`/`verify`/`smoke`/`build`/`browser-check` → commit.

Proceeding now with the code.## Objective
- Now: make the WIP POC's **Create tab** take the same form as the reference "Create an Instruction" wizard at `C:\Source\Obsidian\Projects\POC-Instructions\POC-Instructions-Vault\POC\instruction-wizard.html`.
- Previously (done): Dashboard tab shows WIP totals by status/office/service line and no longer shows the WIP line list (that lives on the WIP tab).

## Important Details
- App: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc` (Svelte 5 runes + `sql.js`, in-memory + IndexedDB). Git root `C:\Source\Obsidian\Projects\POC-EuroWIP`.
- **Approved scope decisions** (user replied "yes go ahead" to the agent's recommendation):
  1. Rebuild Create tab as a stepped wizard for the Instruction; **keep WIP-line creation** alongside it (as a mode switch).
  2. Reuse the **WIP POC's existing dark theme** (`app.css`) — take the wizard's *structure/UX*, not the reference's indigo look.
  3. Port the reference's richer UX: free step navigation + per-step required-field flagging, readiness checklist, review grid, frozen-JSON accept record.
- Do **not** port Loqate (`https://api.addressy.com/...`, key `BY92-NN99-ER43-XT19`) or the reference's hard-coded mock directories — use the WIP POC's own lookup tables and no external calls.
- Reference wizard (3,182 lines) structure: `<style>` 7-641; `#panel-type` 672, `#panel-client` 725, `#panel-property` 818, `#panel-details` 957, `#panel-terms` 1010, `#panel-review` 1123; `<script>` 1318-3179. `TYPES` = 13 entries each with `{ name, entity (kf_*), core (Instruction/Mandate/Engagement), serviceLine, icon, role, desc, fields[] }`; `MOCK_OFFICES` maps office→currency→negotiators.
- WIP POC instruction columns: `instruction_type` (Mandate/Engagement/Instruction, CHECK), `service_line`, `client_account_id`, `legal_entity_account_id`, `primary_contact_id`, `property_id`, `owning_office_id`, `instruction_status` (Active/On Hold/Completed/Withdrawn), `start_date`, `signed_date`, `expected_revenue`, `termination_reason`, `sector`, `negotiator`, `parent_id`, `comments`.
- Hierarchy: `account` is self-referencing Brand/Group → Legal Entity via `parent_account_id` (+ `classification`). Seed: Meridian(1)→France SAS(2), Spain SL(3); Northgate(4)→UK Ltd(5); Alderman(6)→French SARL(7). Contacts: 1→acct2, 2→acct3, 3→acct5, 4→acct7. 13 `service_line_parent` rows (each has `id, service_line, table_name, ref`). `business_unit` = KF Paris/Madrid/London (`erp_local_system` Paris GL/Madrid Accounting/SAP).
- Repo API: `getOffices`, `getServiceLines`, `getAccounts`, `getBrands`, `getLegalEntities`, `getProperties`, `getContacts`, `getInstructions`, `getFeeSchedules`, `getPeriods`, `createInstruction` → `{ok,id,name}` (`INS-######`), `createWip` → `{ok,id,name}` (`WIP-######`).
- AGENTS.md rule: commit after meaningful changes, but only app files (`src`, `scripts`) — never `.obsidian/workspace.json` or `copilot/copilot-conversations/*.md`.
- Verify commands (in `POC\wip-poc`): `npm run check`, `npm test` (= `npm run verify && npm run smoke`), `npm run build`; browser check needs `npm run preview` on `http://localhost:4173` (start via PowerShell `Start-Process npm.cmd ... -WindowStyle Hidden`; kill via `Get-NetTCPConnection -LocalPort 4173` → `Stop-Process`).

## Work State
### Completed
- Dashboard reporting round 1 (`0fbc9cf`): `repo.js` `getTotalsByStatus/Office/ServiceLine` via shared `GROUP_TOTALS_SQL`; new `TotalsTables.svelte`; `KpiBar.svelte` "In hand" tile; `App.svelte` `overview()` snippet with version-keyed deriveds; duplicate service-line cards deleted; `smoke.mjs` assertions; `browser-check.mjs` probes renamed.
- Dashboard round 2 committed as **`bf92978`** "poc: dashboard shows KPIs and totals only; line list lives on the WIP tab" (2 files: `src/App.svelte`, `scripts/browser-check.mjs`; 31 insertions / 44 deletions): WIP table + detail panel + quick-actions removed from Dashboard; `viewInWip` → WIP tab; `.hint` CSS removed.
- Fixed latent escaping bug in `browser-check.mjs` (~line 302): `/WIP-\d{6}/` inside a template literal arrived in the browser as `/WIP-d{6}/` — changed to `/WIP-\\d{6}/`. This resolved the prior `WIP line created: null` oddity; log now reads `WIP line created: WIP-000017`.
- Verified after round 2: `svelte-check` 0/0, `npm test` 76 checks pass, build ok, browser check PASS (`in-hand KPI: 5,400,000`, `WIP line list on Dashboard: absent`, `breakdown tables: status yes, office yes, service line yes`, `routed to WIP tab: yes`).
- Read the full reference wizard and all relevant WIP POC files (`App.svelte`, `CreatePanel.svelte`, `repo.js`, `schema.js`, `db.js`, `seed.js`, `app.css`, `browser-check.mjs`, `smoke.mjs`, `package.json`).

### Active
- Building the Create-tab wizard. Todo list: (1) done reading; **(2) in progress: add wizard CSS to `app.css`**; (3) `InstructionWizard.svelte`; (4) rewrite `CreatePanel.svelte`; (5) update `browser-check.mjs`; (6) run check/verify/smoke/build/browser-check; (7) commit.
- **Design settled**: 6 steps — `type` (segmented Mandate/Engagement/Instruction + service-line card grid `data-sl`), `client` (brand → legal entity filtered by `parent_account_id` → contact filtered by `account_id`), `property` (lookup, optional), `details` (sector select, comments textarea), `terms` (owning office, negotiator, expected revenue, start/signed dates, status), `review` (readiness rows + review cards + Accept gate + frozen JSON).
- `missingRequired()` → type: Service line; client: Client brand, Legal entity; terms: Owning office, Start date; property/details optional (always green).
- Planned field IDs: `#i-brand`, `#i-le`, `#i-contact`, `#i-prop`, `#i-sector`, `#i-comments`, `#i-office`, `#i-status`, `#i-neg`, `#i-rev`, `#i-start`, `#i-signed`, Accept button `#accept-btn`; step pills `.step-pill[data-step=...]`; type cards `.type-card[data-sl=...]`; readiness `.readiness-row.ok` / `.readiness-row.missing`; WIP form `#wip-line-form`.
- Planned `CreatePanel.svelte`: mode switch "Create an Instruction" | "Create a WIP line"; WIP mode keeps a single styled card/form with existing `#w-instr`, `#w-net`, `#w-retained`, `#w-prob`, `#w-gross` fields, calls `createWip` then `onview`.
- Planned `app.css` additions: `.steps`, `.step-pill`(+`.active`/`.done`/`.num`), `.type-grid`, `.type-card`(+`.selected`), `.form-grid`, `.field`(+`.req`/`.hint`/`.err`/`.invalid`), `.readiness(.row.ok/.missing)`, `.review-grid/.review-card/.review-row`, `.wizard-nav`, `.success-banner`, `.accept-error`, `.seg`, `.docs`.
- Svelte 5 conventions in this repo: `$props`, `$state`, `$derived.by`, `$effect`; version-keyed `$derived.by(() => { void version; return getX(); })` for data freshness; `onclick`/`onchange` handlers; explicit `value={...}` + onchange for brand/legal-entity selects (avoid relying on bind ordering).
- `browser-check.mjs` previously used `document.querySelectorAll('form')` (expects 2 forms) and `form.requestSubmit()` with IDs `#i-sl`/`#i-brand`/`#i-le`/`#i-office`/`#i-rev`/`#i-neg` — **must be rewritten** to click step pills/cards, fill each step (fields only exist in DOM while their `{#if step === i}` panel is active), assert readiness, click `#accept-btn`, then switch mode and submit the WIP form.

### Blocked
- (none)

## Next Move
1. Add the wizard CSS block to `POC-EuroWIP-Vault/POC/wip-poc/src/app.css` (classes listed above).
2. Create `POC-EuroWIP-Vault/POC/wip-poc/src/components/InstructionWizard.svelte` implementing the 6-step wizard per the settled design (cards + step pills + readiness + review + Accept → `createInstruction` → frozen JSON; `oncreated` bump, `onview(name)`).

## Relevant Files
- `C:\Source\Obsidian\Projects\POC-Instructions\POC-Instructions-Vault\POC\instruction-wizard.html`: reference wizard (read-only source of the "same form").
- `POC-EuroWIP-Vault/POC/wip-poc/src/app.css`: global theme + where wizard CSS goes.
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/InstructionWizard.svelte`: **to create** (6-step wizard).
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/CreatePanel.svelte`: **to rewrite** (mode switch + WIP-line form).
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/browser-check.mjs`: **to update** — drive the wizard instead of the old two-form flow.
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/repo.js`: `createInstruction`/`createWip` + lookup getters (only module the UI talks to).
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/schema.js`, `seed.js`, `db.js`: schema (`SCHEMA_VERSION = 4`), seed accounts/contacts/service lines, query/tx primitives.
- `POC-EuroWIP-Vault/POC/wip-poc/src/App.svelte`: tabs, `version` invalidation, `viewInWip`, `overview()` snippet.
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/smoke.mjs`, `verify.mjs`: domain/schema test suites (`npm test`).
- `POC-EuroWIP-Vault/AGENTS.md`: commit-after-meaningful-changes rule + vault housekeeping exclusions.Now let me run the static checks and tests.All 76 checks pass. Now the build and the browser check.Everything passes. Let me review the diff and commit.Done. The Create tab is now a six-step instruction wizard, and everything's committed.

## What changed

**New: `InstructionWizard.svelte`** — the stepped form, taking the reference wizard's structure but in the WIP POC's own dark theme:

| Step | Contents | Key fields |
| --- | --- | --- |
| 1 Type | Segmented core shape + service-line card grid (`data-sl`) | `instruction_type`, `service_line` |
| 2 Client | Brand → legal entity → contact, each narrowing the next | `#i-brand`, `#i-le`, `#i-contact` |
| 3 Property | Optional asset attach; sector pre-fills from it | `#i-prop`, `#i-sector` |
| 4 Details | Signed date + desk notes | `#i-signed`, `#i-comments` |
| 5 Terms | Owning office (VAT/ERP hint), start date, revenue, negotiator, status | `#i-office`, `#i-start`, `#i-rev`, `#i-neg`, `#i-status` |
| 6 Review | Readiness checklist, review cards, accept gate, frozen JSON | `#accept-btn` |

- Free step navigation via `.step-pill[data-step]` pills (with done/active states).
- Required grading is only what the database insists on — service line, brand, legal entity, owning office, start date. Property/details stay optional, so they never block accept.
- Accept calls the real `createInstruction` (PL-1 parentage + F5 entity checks fire for real) and renders a `${INS-…} accepted.` banner plus a frozen payload.

**`CreatePanel.svelte`** is now a mode switch — "Create an Instruction" (the wizard) or "Create a WIP line" (`#wip-line-form`, unchanged logic) — so the wizard gets the full width.

**`app.css`** gained the wizard classes (`.steps`/`.step-pill`, `.seg`, `.type-grid`/`.type-card`, `.form-grid`/`.field` with `.req`/`.hint`/`.invalid`, `.readiness`, `.review-grid`, `.wizard-nav`, `.success-banner`, `.accept-error`, `.json-out`).

**`browser-check.mjs`** now drives the real flow: click the Valuations card → pick brand then entity → terms → assert readiness is green → accept → switch to WIP mode → submit a line under the new instruction.

## Verification
- `npm run check`: 0 errors, 0 warnings
- `npm test`: 76 checks pass (31 verify + 45 smoke)
- `npm run build`: ok
- `browser-check`: **PASS** — `instruction created: INS-000009`, `WIP line created: WIP-000017`, routed to WIP tab, row visible

## Commit
`27008ad` — "poc: create tab is a six-step instruction wizard with readiness and accept" (4 files changed, +649/-269; only app files staged — `.obsidian/workspace.json` and the copilot conversation notes left out).
[Timestamp: 2026/10/09 14:53:19]

**user**: th eproperty tab should use the same Loqate api as the POC_instructions app. the client/details and terms tabs should have the same fields and mocks also
[Timestamp: 2026/10/09 15:02:40]

**ai**: The reference wizard's client/property/details/terms steps need a careful read. Let me pull the exact panels, mocks, and Loqate wiring.Now the script internals — configs, mocks, and Loqate wiring.I've now read the full reference wizard — `TYPES` (13 types with per-type `fields`), `MOCK_CLIENTS` (15), `MOCK_OFFICES` (10, with negotiators + currency), the Loqate Find/Verify code, and the Client/Property/Details/Terms/Review wiring. I can port all of it. Before I rip out the current dropdown-based Client and Terms steps, one decision drives the whole shape, and I don't want to guess it.

**The reference wizard's steps don't line up with the WIP POC's database.** The reference is a pure "information payload" POC: the Client step is a mock directory + free-text fields (`clientName`, `partyType`, `contactName`, `contactEmail`, `contactPhone`, `legalEntity`); Terms uses the 10 mock offices with a negotiator list, fee basis/amount, currency default, and no start date; Details renders per-type fields from `TYPES`. Meanwhile the WIP POC's `createInstruction` needs real foreign keys (`client_account_id`, `legal_entity_account_id`, `owning_office_id`, `start_date`) that point at the seeded `account` / `business_unit` rows — and `browser-check` asserts a real `INS-…` row is created and a `wip` line attaches under it.

So: **what should Accept do?**

- **(A) Faithful UX + keep the WIP chain** (my recommendation). Port the Client/Property/Details/Terms steps exactly as the reference — mock client directory, free-text fields, Loqate Find/Verify on Property, the 10-office directory with negotiators and currency defaulting, dynamic per-type Details fields — and freeze the same `{ kf_Instruction, kf_<entity> }` payload at Accept. On top of that, a thin mapping layer writes a real `instruction` row (upserting client/legal-entity/contact accounts by name, mapping the mock office to a `business_unit`, using the instruction date as `start_date`) so WIP lines still attach and the relational model stays the point of the POC.
- **(B) Pure reference.** The wizard becomes exactly the POC-Instructions wizard: Accept only freezes the JSON payload, no DB write. The WIP-line mode then can no longer attach to a wizard-created record, and I'd rewrite `browser-check` to assert the JSON payload instead of `INS-…`/WIP creation.

Also confirm one thing on scope: in the Client and Terms steps I'd **replace** the current real dropdowns (brand → legal entity → contact; real offices) with the reference's mock directory + free-text fields, rather than keep both. Correct?

Say **(A)** or **(B)** and I'll build it — plus, if you know the Loqate key is still live, I'll wire the real calls; otherwise I'll default to the reference's key (`BY92-NN99-ER43-XT19`) and keep the on-screen override + raw-response panel like the reference does.
[Timestamp: 2026/10/09 15:02:40]

**user**: A
[Timestamp: 2026/10/09 15:08:19]

**ai**: Option **A** it is — faithful reference UX (mock directories, free-text fields, Loqate, dynamic Details) while still writing a real `instruction` row so WIP lines attach. Let me set up the plan and read the last two things I need: the exact schema columns I'll write to, and the test harness structure.Now I have everything I need. Let me build the pieces. First the config module (types + mocks) and the Loqate module.Now the repo resolvers that map the free-text/mock client and office onto the relational model.Now the big piece — rewriting the wizard as a faithful port with a DB-writing accept.## Objective
- Make the WIP POC's **Create tab** take the same form as the reference "Create an Instruction" wizard (`C:\Source\Obsidian\Projects\POC-Instructions\POC-Instructions-Vault\POC\instruction-wizard.html`), **including the Loqate address API on the Property tab and the reference's mock client/office directories + dynamic per-type Details fields** — while still writing a real `instruction` row so WIP lines attach (user chose option **A**).

## Important Details
- App: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc` (Svelte 5 runes + `sql.js`, in-memory + IndexedDB). Git root `C:\Source\Obsidian\Projects\POC-EuroWIP`.
- **User directives (latest, overrides prior scope):**
  1. Property tab must use **the same Loqate API** as the POC-Instructions app.
  2. Client / Details / Terms tabs must have **the same fields and mocks** as the reference (mock client directory, free-text fields, 10 mock offices w/ negotiators + default currency, dynamic per-type Details fields).
  3. User chose **(A)** on the fork: faithful reference UX **and** keep the WIP chain — freeze the same `{kf_Instruction, kf_<entity>}` payload at Accept **and** write a real `instruction` row via a thin mapping layer.
  4. **Replace** the current brand→legal-entity→contact dropdowns and real-office dropdowns with the reference's mock lookups + free-text fields (not keep both). Agent asked; user replied "A" (confirms replace + Loqate wiring).
- Prior approved decisions still in force: keep WIP-line creation as a mode switch; reuse the WIP POC's dark theme (`app.css`); free step navigation + per-step required flagging + readiness checklist + review grid + frozen-JSON accept.
- Loqate: key `BY92-NN99-ER43-XT19` (user to confirm if still live; agent defaulted to it + on-screen override + raw-response panel like the reference).
- Reference wizard structure: `<style>` 7-641; panels — `#panel-type` 672, `#panel-client` 725, `#panel-property` 818, `#panel-details` 957, `#panel-terms` 1010, `#panel-review` 1123; `<script>` 1318-3179. Key lines: `TYPES` 1323-1489; `missingRequired` 1719; `LOQATE_FIND_URL` 1859; `LOQATE_VERIFY_URL` 1860; `loqateFind` 1889; `loqateVerify` 1947; `searchLoqate` 2130; `pickLoqateAddress` 2157; `initLoqate` 2184; `MOCK_CLIENTS` 2212-2262; `findMockClients` 2277; `pickMockClient` 2309; `MOCK_OFFICES` 2353-2364; `populateOfficeSelect` 2372; `populateNegotiatorSelect` 2394; `onOfficeChange` 2416; `renderDetails` 2782; `renderReadiness` 2924; `renderReview` 2951; `buildRecord` 3033.
- `TYPES`: 13 entries `{ name, entity (kf_*), core (Instruction/Mandate/Engagement), serviceLine, icon, role, desc, fields[] }`. `core` maps directly onto `instruction_type`.
- **Schema (v4)** columns: `business_unit(id,name,city,country,vat_percent,erp_local_system CHECK IN 'Paris GL','Madrid Accounting','SAP','Other')`; `account(id,name,classification CHECK 'Brand/Group'|'Legal Entity',parent_account_id)`; `contact(id,name,account_id)`; `site(id,name)`; `property(id,name,sector,site_id)`.
- Service-line name mapping (reference → POC `service_line_parent.service_line`): `'Leasing (Commercial Agency)'→'Leasing'`, `'Occupier Strategy & Solutions'→'OSS'`, `'Workplace Consulting'→'Workplace'`, `'Development Consultancy'→'Development'` (all other 9 pass through).
- Office→`business_unit` mapping: match by `city` first, else by country code (`'United Kingdom'→'UK'`, `'Spain'→'ES'`, `'France'→'FR'`, `'Germany'→'DE'`, `'Poland'→'PL'`), else fall back to first business_unit (DE/PL have no seeded office).
- Accept mapping: `service_line=mapServiceLine(t.serviceLine)`, `instruction_type=t.core`, client/legal-entity via `resolveClientAccounts`, `primary_contact_id` via `resolveContact`, `owning_office_id` via `resolveOfficeId`, `property_id` via `resolveProperty`, `start_date=details.kf_instructiondate`, `expected_revenue=terms.expectedRevenue`, `sector=property.propertySector`, `negotiator=terms.assignedTo`, `comments=terms.notes`.
- All 13 reference types carry a required `kf_instructiondate`, so `start_date` is always present.
- Skip porting: the reference's big `<details>` documentation blocks and its own SQLite draft cache (component holds state; DB write only on Accept).
- Verify commands (in `POC\wip-poc`): `npm run check`, `npm test` (= `npm run verify && npm run smoke`), `npm run build`; browser check needs `npm run preview` on `http://localhost:4173` (start via PowerShell `Start-Process npm.cmd … -WindowStyle Hidden`; kill via `Get-NetTCPConnection -LocalPort 4173` → `Stop-Process`).
- AGENTS.md rule: commit after meaningful changes, but **only app files** (`src`, `scripts`) — never `.obsidian/workspace.json` or `copilot/copilot-conversations/*.md`.
- Latent-escaping gotcha: inside `browser-check.mjs` template literals, regexes need `\\d` (e.g. `/WIP-\\d{6}/`, `/INS-\\d{6}/`) or they arrive in the browser as `d{6}`.
- `browser-check.mjs` currently uses `document.querySelectorAll('form')`-based flow and `#i-sl`/`#i-brand`/`#i-le`/`#i-office`/`#i-rev`/`#i-neg` — being retired for the new wizard.
- Svelte 5 conventions in this repo: `$props`, `$state`, `$derived.by`, `$effect`; version-keyed `$derived.by(() => { void version; return getX(); })`; `onclick`/`onchange` handlers.

## Work State
### Completed
- Dashboard round 1 `0fbc9cf`; dashboard round 2 `bf92978` "poc: dashboard shows KPIs and totals only; line list lives on the WIP tab" (only `src/App.svelte`, `scripts/browser-check.mjs`).
- Fixed `browser-check.mjs` escaping bug (`/WIP-\\d{6}/`).
- **First wizard build committed `27008ad`** "poc: create tab is a six-step instruction wizard with readiness and accept" (4 files, +649/-269): created `src/components/InstructionWizard.svelte` (6 steps, real dropdowns, readiness, accept → `createInstruction`, frozen JSON); rewrote `CreatePanel.svelte` as mode switch ("Create an Instruction" | "Create a WIP line") with `#wip-line-form`; added wizard CSS to `app.css`; rewrote `browser-check.mjs` createFlow to drive the wizard.
- Verified after `27008ad`: `npm run check` 0 errors/0 warnings; `npm test` 76 checks pass (31 verify + 45 smoke); `npm run build` ok; browser-check **PASS** (`instruction created: INS-000009`, `WIP line created: WIP-000017`, routed to WIP tab, new row visible, rows after filter 14).
- Read the full reference wizard (TYPES, mocks, Loqate find/verify, client lookup, office/negotiator, details/readiness/review/buildRecord).
- **Created `src/lib/wizardConfig.js`**: `TYPES` (13, verbatim), `STEPS`, `REQUIRED_LABELS` (client: clientName/contactName; property: address/city/postcode/country; terms: feeBasis/currency/assignedTo/owningOffice), `SERVICE_LINE_MAP`+`mapServiceLine`, `MOCK_CLIENTS` (15), `CLIENT_FIELDS`, `findMockClients`, `MOCK_OFFICES` (10), `getOfficeByName`.
- **Created `src/lib/loqate.js`**: `LOQATE_FIND_URL`/`LOQATE_VERIFY_URL`/`LOQATE_DEFAULT_KEY`/`LOQATE_KEY_STORAGE`, `OPTION_COUNTRIES`, `COUNTRY_ISO`, `ISO_TO_OPTION`, `loadLoqateKey`/`saveLoqateKey`, `loqateFind`, `batchResult`/`batchVerify`/`loqateVerify`, `optionForCountry`, `resolveCountry`, `matchIso`, `splitAddressLines`, `mapVerifyMatch`.
- Read `schema.js` (cols 27-135) and `smoke.mjs` header.

### Active
- Porting the reference UX (option **A**). Todo list (status): (1) read schema+smoke — **done**; (2) add `repo.js` resolvers — **pending/in progress**; (3) `wizardConfig.js` — **done**; (4) `loqate.js` — **done**; (5) rewrite `InstructionWizard.svelte` as faithful port + DB-writing accept — **pending**; (6) add wizard CSS (loqate box, type cards icon/desc/badges, `.verified-fill`, `.hidden`, badge variants, `.card-header`/`.card-icon`) — **pending**; (7) update `browser-check.mjs` — **pending**; (8) run check/verify/smoke/build/browser-check — **pending**; (9) commit — **pending**.
- Note: `InstructionWizard.svelte` on disk is still the **old simplified** (dropdown-based) version; it must be replaced by the faithful port.
- Planned `repo.js` additions (not yet written): `nextAccountId`/`nextContactId`/`nextPropertyId` (MAX(id)+1); `resolveClientAccounts({clientName, legalEntity})` (find-or-create Brand/Group + Legal Entity, LE parent = brand; if `legalEntity` blank fall back to clientName as Legal Entity); `resolveContact({contactName, accountId})` (find-or-create by name); `resolveOfficeId(office)` (city → country-code → first); `resolveProperty({address, city, postcode, country, sector})` (name = joined parts, find-or-create, sector default 'Other'); `mapServiceLine`.
- `browser-check.mjs` plan: drive the new wizard by type cards + mock client lookup + step pills; fill Property fields **directly** (no live Loqate network call, to stay deterministic) and assert the Loqate UI is present.

### Blocked
- (none)

## Next Move
1. Add the resolver functions to `POC-EuroWIP-Vault/POC/wip-poc/src/lib/repo.js` (`resolveClientAccounts`, `resolveContact`, `resolveOfficeId`, `resolveProperty`, `mapServiceLine`, `next*Id`).
2. Rewrite `POC-EuroWIP-Vault/POC/wip-poc/src/components/InstructionWizard.svelte` as the faithful reference port (type-card grid, mock client directory + free text, Loqate Property box, dynamic per-type Details, mock-office Terms w/ negotiators + currency, readiness + review + Accept that both freezes payload and calls `createInstruction` via the mapping), then update `app.css`, `browser-check.mjs`, run checks, and commit.

## Relevant Files
- `C:\Source\Obsidian\Projects\POC-Instructions\POC-Instructions-Vault\POC\instruction-wizard.html`: reference wizard (read-only source of the "same form", mocks, Loqate).
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/wizardConfig.js`: **created** — TYPES/mocks/steps/required labels/service-line map.
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/loqate.js`: **created** — Loqate Find/Verify + address mapping.
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/repo.js`: `createInstruction`/`createWip` + getters; **to extend** with resolvers.
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/InstructionWizard.svelte`: **to rewrite** as faithful port with DB-writing accept.
- `POC-EuroWIP-Vault/POC/wip-poc/src/components/CreatePanel.svelte`: mode switch + `#wip-line-form` (rewritten in `27008ad`; may need only prop/version tweaks).
- `POC-EuroWIP-Vault/POC/wip-poc/src/app.css`: global theme + wizard CSS (added; **needs Loqate/type-card/badge additions).
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/browser-check.mjs`: **to update** to drive the new wizard.
- `POC-EuroWIP-Vault/POC/wip-poc/src/lib/schema.js`, `seed.js`, `db.js`: schema (`SCHEMA_VERSION = 4`), seed, query/tx primitives.
- `POC-EuroWIP-Vault/POC/wip-poc/src/App.svelte`: tabs, `version` invalidation, `viewInWip`.
- `POC-EuroWIP-Vault/POC/wip-poc/scripts/smoke.mjs`, `verify.mjs`: domain/schema test suites (`npm test`).
- `POC-EuroWIP-Vault/AGENTS.md`: commit-after-changes rule + vault housekeeping exclusions.Let me verify the module APIs I just used match what's actually exported.APIs line up. Now let me check how `CreatePanel` mounts the wizard (prop names/version) and what wizard CSS already exists.Most wizard classes exist; I need to add the header, badge, type-card detail, and Loqate blocks.Now the browser check. Let me read it.Now let me confirm `createInstruction`'s expected parameters before I trust the accept mapping.Parameter names match. Now rewriting the createFlow in the browser check to drive the new wizard.Let me update the task list and run the checks.Clean. Now the domain suites.76 checks pass. Now the production build.Build ok. Now start the preview server and run the browser check.PASS end to end. Let me stop the preview server and review what will be committed.Staging only the app files (excluding the vault housekeeping files).Done. The Create tab is now the reference wizard (option A), committed as `c871194`.

**What changed**

- **`InstructionWizard.svelte`** — rewritten as the faithful port: 13 type cards, mock-client directory lookup with free-text fields, Loqate **Find + Verify** on the Property tab (including the API-key override and raw-response panel), per-type dynamic Details fields (with the lettings weekly→monthly→annual recalc and the "management fee" hidden unless management type), and Terms with the 10 mock offices, auto-defaulted currency and office-scoped negotiators. Readiness list, review grid and Accept are unchanged in spirit.
- **`wizardConfig.js`** (new) — TYPES/STEPS/REQUIRED_LABELS, the service-line name map, the 15 mock clients and 10 mock offices.
- **`loqate.js`** (new) — Find/Batch-Verify transport plus the verify-match → `{address,city,postcode,country}` mapping.
- **`repo.js`** — added the resolver layer that turns the collected names into rows: `resolveClientAccounts` (Brand/Group + Legal Entity), `resolveContact`, `resolveOfficeId` (city → country → first), `resolveProperty`, and `nextId`.
- **`app.css`** — card headers, badges, type-card icon/desc, and the Loqate panel styles.

**The key wiring (why WIP lines still attach)**

Accept doesn't just freeze the reference JSON — it resolves onto the relational model and calls the existing `createInstruction`, so `kf_serviceline` maps through `mapServiceLine`, the office maps to a `business_unit`, and the property is find-or-created. The frozen `{kf_Instruction, kf_<entity>}` payload is kept alongside, per your option A.

**Verification (all green)**

- `npm run check` — 0 errors, 0 warnings
- `npm test` — 76 checks (31 verify + 45 smoke)
- `npm run build` — ok
- browser-check — **PASS**: drove the new wizard via the mock client lookup and Loqate UI, accepted `INS-000009`, then created `WIP-000017` and confirmed it routed to the WIP tab.

One thing to confirm when convenient: the Loqate key is hardcoded to the POC-Address key `BY92-NN99-ER43-XT19` with an on-screen override. If that key is no longer live, the Find/Verify calls will fail at runtime — the check deliberately fills the fields directly so it stays offline-deterministic and wouldn't catch a dead key. Say the word and I'll swap in a current one.
[Timestamp: 2026/10/09 15:08:19]

**user**: use that key
[Timestamp: 2026/10/09 15:16:44]

**ai**: It's already the configured default (`LOQATE_DEFAULT_KEY` in `loqate.js`), so no code change is needed. Let me confirm the key is actually live rather than assume.Confirmed — that key is live and already in use. `LOQATE_DEFAULT_KEY = 'BY92-NN99-ER43-XT19'` has been the default in `loqate.js` since I created it, so no code change is needed.

The live probe against the Find endpoint returned real matches:

| Type | Text | Description |
| --- | --- | --- |
| Address | 1 Liverpool Street London EC2M 7NH | |
| Postcode | SG2 7NH | Stevenage - 12 Addresses |

So the Property tab's Find + Verify will work against the real API. Nothing to commit — the previous commit `c871194` already ships this key. If you ever want to point it at a different key without touching code, the API-key override under the Loqate box persists to `localStorage`.
[Timestamp: 2026/10/09 15:16:44]

**user**: the wip tab should not have the 'totals by' sections
[Timestamp: 2026/10/09 15:19:57]

**ai**: The WIP tab shares an `overview` snippet with the Dashboard, which bundles the KPI bar and the three "Totals by" tables. I'll split them so the WIP tab keeps the KPIs but drops the breakdowns.Let me also lock this in with a browser-check assertion, then run the suite.Now I have a duplicate WIP-tab log line. Let me check the surrounding region.PASS — KPI bar stays, "totals by" sections gone. Let me stop the server and commit.Done, committed as `12ffdb0`.

**Change**

- Actually the "Totals by status / office / service line" tables were shared: both the Dashboard and the WIP tab rendered one `overview` snippet that bundled the KPI bar *and* those three tables. I split it into a `kpis()` snippet and a `totals()` snippet. The Dashboard renders both; the WIP tab now renders only the KPI bar.

**Verification**

- `npm run check` — 0 errors, 0 warnings
- `npm run build` — ok
- browser-check — **PASS**, with a new explicit assertion: on the WIP tab, `KPI bar: shown` and `"totals by" sections: absent`. The Dashboard still reports `breakdown tables: status yes, office yes, service line yes`.

The WIP tab now leads straight from the KPI bar into the filtered line list and detail panel.
[Timestamp: 2026/10/09 15:19:57]