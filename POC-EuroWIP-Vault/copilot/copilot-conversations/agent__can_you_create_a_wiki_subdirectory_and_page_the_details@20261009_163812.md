---
epoch: 1791560292757
mode: agent
backendId: opencode
sessionId: "ses_edeb15713ffeQFay2QIWeehb2H"
agentLabel: "App dashboard wiki page"
usage: '{"usedTokens":90440,"contextWindow":200000,"updatedAt":1791560485976}'
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