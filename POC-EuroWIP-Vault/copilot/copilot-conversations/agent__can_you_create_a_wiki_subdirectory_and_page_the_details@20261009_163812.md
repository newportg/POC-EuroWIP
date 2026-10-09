---
epoch: 1791560292757
mode: agent
backendId: opencode
sessionId: "ses_edeb15713ffeQFay2QIWeehb2H"
agentLabel: "App dashboard wiki page"
usage: '{"usedTokens":47387,"contextWindow":200000,"updatedAt":1791561456327}'
tags:
  - copilot-conversation
---

**user**: can you create a wiki subdirectory and  page the details the app dashboard page. It should explain what the dashboard is showing, give a representation of the datastructure, and what queries are necessary to produce the tables
[Timestamp: 2026/10/09 16:38:12]

**ai**: I'll start by understanding the vault structure and finding any existing information about the app dashboard.Let me explore the wiki, projects, and POC folders to understand the structure and find dashboard-related content.The vault `Dashboard.md` is a vault-level dashboard. The user likely means the **app's** dashboard page. Let me explore the POC app.This is a Svelte app. Let me read the key source files to understand the dashboard.Now let me read the query layer, the dashboard components, and seed data.Let me read the seed data and the relevant existing wiki notes to match terminology and conventions.Let me check the wiki subdirectory conventions and search for existing POC/app references.Let me check the tour slides (which describe the dashboard) and the application-composition diagram conventions.Let me read the tour's dashboard description to capture the intended narrative accurately.I have a thorough understanding now. Let me check the Obsidian plugin config to match diagram conventions, then plan the page.I have everything I need. The vault uses the PlantUML plugin, and the wiki convention is kebab-case files with YAML frontmatter. Let me set up a plan and create the page.Now let me verify the file and commit it, per the vault's commit rule.Only my new page plus unrelated auto-generated files changed. I'll stage just the wiki page.Created the subdirectory and page, and committed it.

## What I did

- **New subdirectory:** `wiki/wip-poc/`
- **New page:** `wiki/wip-poc/dashboard.md` (308 lines, committed as `wiki: add WIP POC dashboard page (data structure + queries)`)

I sourced it from the app itself in `POC/wip-poc/src` — `App.svelte`, `repo.js`, `schema.js`, `KpiBar.svelte`, `TotalsTables.svelte` — which is the source of truth for the running app.

## What the page covers

**What the dashboard shows** — the `Dashboard` tab is the read-only summary of the pipeline, scoped by the header's global reporting-month selector:
- The 7-tile **KPI bar** (in hand, weighted retained, billed, paid, lost, stale lines, locked lines) plus the mixed-currency warning, with the expression behind each tile.
- **Totals by status** — always all four lifecycle states (zero rows are back-filled), with Share computed in JS.
- **Totals by office** and **Totals by service line** — one row per group, every lifecycle state side by side, ordered by total.
- A note on what is *not* here (alerts, receivables ageing and the event log are on `Controls`).

**Data structure** — a PlantUML ER diagram (the vault has the obsidian-plantuml plugin, so it renders) showing `v_wip` as the read model flattening `wip ← instruction ← business_unit / account / service_line_parent`. Plus a table of the exact columns the dashboard reads, and two modelling notes: service line comes from the **PL-2-denormalised** `wip.service_line` (not a join), and money is summed **without currency conversion**.

**Queries** — the four reads from `repo.js` verbatim:
- `getKpis` (single row, `SUM(CASE ...)` per status)
- `getTotalsByStatus` (with the JS re-projection to four fixed states)
- `GROUP_TOTALS_SQL` factory behind `getTotalsByOffice` / `getTotalsByServiceLine`, including both `dimensionExpr` substitutions
- the `? IS NULL OR reporting_month = ?` month-scoping idiom, plus what's computed in JavaScript (Share, footers, currency warning)

It also includes a `UI element → component → repo function → SQL` mapping table and links to [[wip-reporting-and-kpis]], [[wip-table-specification]], [[wip-automation-requirements]], [[wip-application-composition]] and [[wip-open-questions]].

Two deliberate choices worth flagging: I disambiguated this from the vault's existing [[Dashboard]] (the Dataview index) at the top, and I left existing notes untouched rather than adding a backlink — say the word if you'd like an entry added to [[wip-project-overview]]'s entry-points list.
[Timestamp: 2026/10/09 16:38:12]

**user**: can you remove the — its very AI. I prefer to bold the statement then a comma, and the text after the comma in normal font
[Timestamp: 2026/10/09 16:47:36]

**ai**: I'll rewrite the page replacing every em-dash construction with your preferred pattern: bold statement, comma, then plain text.Let me verify no em-dashes remain.Confirmed: zero em-dashes (U+2014) remain. The 3 earlier "matches" were a false positive from a mangled regex — the file now has only the multiplication sign `×` (3×) and one legitimate en-dash in the numeric range `0–100`.

Let me commit the revision.Done. Every em-dash separator is gone, replaced with your pattern: **bold statement**, then the plain-text continuation.

The changes:

| Was | Now |
| --- | --- |
| `# WIP POC — Dashboard` | `# WIP POC Dashboard` |
| `Nothing here writes data — the billing…` | `**Nothing here writes data**, the billing…` |
| `It is a text note only — the sums are not converted…` | `**It is a text note only**, the sums are not converted…` |
| `One row per lifecycle state, **always all four** — a state…` | `**One row per lifecycle state, always all four**, a state…` |
| Headings `### KPI bar — getKpis(month)` etc. | `### KPI bar: getKpis(month)` (colon, since a heading isn't a statement) |
| Bullet `**Office** groups on…` | `**Office**, groups on…` |
| Related list `- [[x]] — description` | `- **[[x]]**, description` |
| Table placeholder cells `—` | `n/a` |
| PlantUML title/note `—` | colon / plain wording |

Two things I deliberately left, so you can veto them:

- **The `0–100` range** keeps its en-dash (`–`, U+2013), which is a normal typographic range and matches the vault's existing [[wip-table-specification]]. Only em-dashes were removed. Tell me if you want plain hyphens there too.
- **The multiplication signs `×`** in the KPI table and the weighted-retained expression are untouched.

Committed as `wiki: drop em-dashes from WIP POC dashboard page`.
[Timestamp: 2026/10/09 16:47:36]

**user**: can you repeat the documentation  for the rest of the app tabs. It should explain what the dashboard is showing, give a representation of the datastructure, and what queries are necessary to produce the tables
[Timestamp: 2026/10/09 16:52:22]

**ai**: I'll document the remaining four tabs (Create, WIP, Controls, Model & questions) in the same style. Let me read all the relevant components and support modules first.Now the Create tab and support modules.I have everything. The tabs are: **Create**, **WIP**, **Controls**, **Model & questions**. I also confirmed one real code/data mismatch to flag: the Controls event log reads `e.event_time` but the `event_log` column is `logged_on`.## Objective
- Document each tab of the WIP POC app (`POC/wip-poc`) in the vault wiki, one page per tab, each explaining what the tab shows, a representation of the data structure, and the queries needed to produce its tables.
- Dashboard tab page is done; user now wants the same treatment repeated for the remaining tabs (Create, WIP, Controls, Model & questions).

## Important Details
- Vault root: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault`; app lives at `POC/wip-poc` (Svelte + sql.js in-browser SQLite mirrored to IndexedDB).
- Wiki conventions: kebab-case filenames, YAML frontmatter (`type: spec`, `area: wip`, `status: draft`, `source:`, `extracted:`), wikilinks, one topic per file (per `AGENTS.md`).
- Diagrams use ```plantuml (vault has `obsidian-plantuml` plugin); Dataview is also enabled.
- **User style preference: no em-dashes.** Replace `<statement> — <explanation>` with **bold statement**, comma, then plain text. Headings use a colon instead. Already applied to `dashboard.md`.
- Source of truth for the app docs is the code, not existing wiki notes.
- Vault is a git repo; commit after meaningful changes. Recent commit style: `wiki: ...`, `poc: ...`, `vault backup: ...`. Stage only the intended files (auto-generated churn exists in `.obsidian/workspace.json`, `.copilot/model-catalog-cache.json`).
- Disambiguation: the app's Dashboard page is different from the vault's own `Dashboard.md` (a Dataview index).
- App dashboard reads all aggregates from the SQLite view `v_wip`; four repo reads drive it (`getKpis`, `getTotalsByStatus`, `GROUP_TOTALS_SQL` factory behind `getTotalsByOffice` / `getTotalsByServiceLine`); month scoping idiom is `? IS NULL OR reporting_month = ?` with `month` bound twice; Share % and footer totals are computed in JS.
- Possible bug found: `SidePanels.svelte` renders `e.event_time?.slice(5, 16)` but `repo.getEvents` returns raw `event_log` rows whose column is `logged_on` — the "When" column likely renders empty. Note as a discrepancy rather than guessing.
- App tabs: `dashboard`, `create`, `wip`, `controls`, `model` (App.svelte holds `tab` and `month` state; derived reads key off a `version` counter bumped on every mutation).

## Work State
### Completed
- Created `wiki/wip-poc/` subdirectory and `wiki/wip-poc/dashboard.md` (308 lines) documenting the Dashboard tab.
- Committed `wiki: add WIP POC dashboard page (data structure + queries)` (ca6d807).
- Rewrote `dashboard.md` removing all em-dashes (U+2014 = 0 remaining) per user style; committed `wiki: drop em-dashes from WIP POC dashboard page` (3327e9f).
- Verified: 1 en-dash remains in range `0–100` (deliberate, matches vault convention), 3 multiplication signs `×` (deliberate), no em-dashes.

### Active
- Reading remaining tab components/support modules to write the four remaining pages. Read so far: `WipTable.svelte`, `WipDetail.svelte`, `SidePanels.svelte`, `ModelPanel.svelte`, `CreatePanel.svelte`, `InstructionWizard.svelte` (partial), `wizardConfig.js` (partial), `db.js` (partial).
- Todo list set: read components → write `wiki/wip-poc/create.md` → `wip.md` → `controls.md` → `model.md` → commit.

### Blocked
- (none)

## Next Move
1. Finish reading `InstructionWizard.svelte`, `wizardConfig.js`, `loqate.js`, `CountrySelect.svelte`, `flags.js`, and the rest of `db.js`.
2. Write `wiki/wip-poc/create.md`, then `wip.md`, `controls.md`, `model.md` in the same style as `dashboard.md` (what it shows / data structure with PlantUML / queries), then commit with a `wiki: ...` message.

## Relevant Files
- `wiki/wip-poc/dashboard.md`: the finished reference page; copy its structure and style for the remaining tabs.
- `POC/wip-poc/src/App.svelte`: tab + month state, wires all tab components.
- `POC/wip-poc/src/lib/repo.js`: all domain queries/commands (source for the "queries" sections).
- `POC/wip-poc/src/lib/schema.js`: `SCHEMA_VERSION = 4`, tables, triggers, views (`v_wip`).
- `POC/wip-poc/src/lib/seed.js`: seed data (all rows written as WIP then transitioned so triggers fire).
- `POC/wip-poc/src/lib/db.js`: query primitive layer (sql.js + IndexedDB).
- `POC/wip-poc/src/lib/wizardConfig.js`: Create-tab type/step/field config (ported from POC-Instructions wizard).
- `POC/wip-poc/src/lib/loqate.js`, `flags.js`, `src/components/CountrySelect.svelte`: Create-tab support (address lookup, flags).
- `POC/wip-poc/src/components/CreatePanel.svelte`, `InstructionWizard.svelte`: Create tab.
- `POC/wip-poc/src/components/WipTable.svelte`, `WipDetail.svelte`: WIP tab.
- `POC/wip-poc/src/components/SidePanels.svelte`: Controls tab (alerts, receivables buckets, periods, events).
- `POC/wip-poc/src/components/ModelPanel.svelte`: Model & questions tab (rules PL-1..FL-5, BR; questions Q1..).
- `POC/wip-poc/src/components/KpiBar.svelte`, `TotalsTables.svelte`: Dashboard tab (already documented).
- `wiki/archimate/wip-application-composition.md`, `wiki/archimate/wip-archimate-index.md`: PlantUML conventions to match.
- `wiki/wip-reporting-and-kpis.md`, `wiki/wip-table-specification.md`, `wiki/wip-automation-requirements.md`, `wiki/wip-open-questions.md`: existing notes to wikilink (dashboard.md links these).Two accuracy fixes needed in the WIP page: the real status set is `WIP, Billed, Paid, Lost`, and the Office/Weighted columns read `office_city` and `weighted_office_retained`.Done. The four remaining tab pages are written, cross-linked to [[dashboard]], and committed.

**New pages in `wiki/wip-poc/`**

- [[create]], the five-step instruction wizard. Documents the steps, the config fixtures it reads (`TYPES`, `MOCK_CLIENTS`, `MOCK_OFFICES`), the five tables it writes (`account`, `contact`, `property`, `instruction`, `wip`), and the six repo commands with their SQL (`nextRef`, `resolveClientAccounts`, `resolveContact`, `resolveOfficeId`, `resolveProperty`, `createInstruction`, `createWip`).
- [[wip]], the working list. Documents the filter bar, the ten table columns, the three flags (STALE, LOCKED, NO ERP), the `v_wip` view, and the `getWip` / `getWipLine` / `changeStatus` / `updateProbability` queries.
- [[controls]], the governance view. Documents the four panels (alerts, receivables, reporting periods, recent events), the `alert` and `event_log` tables plus `v_receivables`, and the `getAlerts` / `getReceivableBuckets` / `getReceivables` / `getPeriods` / `lockPeriod` / `unlockPeriod` / `getEvents` queries.
- [[model]], the self-description tab. Documents the relational diagram, the 14 database-enforced rules, the 4 open questions, and the two live reads (`getInstructions`, `getServiceLines`).

**Corrections I caught against the code while writing**

- The WIP status set is exactly `WIP, Billed, Paid, Lost` (schema `CHECK`), not a longer lifecycle. Fixed in the wip page.
- The WIP table's Office and Weighted columns read `office_city` and `weighted_office_retained`, not a "owning office" name or a generic weighted fee. Fixed.
- **Real bug flagged** in [[controls]]: `getEvents` selects `event_log`, whose timestamp column is `logged_on`, but `SidePanels.svelte` renders `e.event_time?.slice(5, 16)`. That expression is `undefined`, so the events "When" column renders blank. Logged as a discrepancy to verify rather than silently patched.

Each page follows the same shape as [[dashboard]] (what it shows, data structure with a PlantUML diagram and tables, queries, where it lives, related) and uses your no-em-dash style with the **bold statement**, comma convention.

Two things worth deciding:

- **Wikilink ambiguity.** The sibling pages link back with `[[dashboard]]`, but the vault also has a root `Dashboard.md`. Obsidian link resolution is case-insensitive, so that link could resolve to the wrong note. If you want it unambiguous I can qualify it as `[[wipt-poc/dashboard|dashboard]]`, or rename the app page to something like `wip-poc-dashboard.md` so nothing collides.
- **The `event_time` bug.** I left it as a documented discrepancy only. Say the word and I will fix the one line in `SidePanels.svelte` (use `e.logged_on`) in a separate `poc:` commit.
[Timestamp: 2026/10/09 16:52:22]