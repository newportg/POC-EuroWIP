# WIP pipeline — proof of concept

A working model of the EuroWIP `kf_Instruction` / `kf_WIP` design: lifecycle,
automation rules, period locking and reporting, as a real relational database
with the rules enforced in the schema rather than in the UI.

## What it is

The point of this POC is that the business rules are **database constraints and
triggers**, not application-level validation. Bill a line without an invoice
number and the write is rejected, whether it came from this UI, a SQL console,
or a future reporting tool. The rules hold regardless of which client writes.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
npm run test           # schema, seed, rules and domain layer (60 assertions)
npm run check          # svelte-check
npm run build          # static output in dist/
npm run browser-check  # loads the built app in headless Chrome and reads the page
```

`browser-check` expects a served build. With `npm run build` done, run
`npx vite preview --port 4173` in one terminal and `npm run browser-check` in
another. It asserts that the app mounts, the seed renders, all four tabs load,
that creating an Instruction and then a WIP line under it works through the real
form, and that no uncaught exception is thrown.

## The database

SQLite compiled to WebAssembly (`sql.js`), running entirely in the browser and
mirrored into IndexedDB, so edits survive a reload. GitHub Pages can only serve
static files, so there is no server process; the whole database is a byte array
in memory.

This is a real relational engine — foreign keys, check constraints, triggers,
views, generated columns. It is not a mock. It is also per-browser, so two
visitors do not share data. For a shared POC the swap is to a hosted Postgres
(Neon, Supabase) and reimplementing the bottom of `src/lib/db.js`; every screen
talks to `src/lib/repo.js` and neither knows which engine is underneath.

## What is enforced

| Rule | Behaviour |
| --- | --- |
| PL-1 | A WIP line hangs off exactly one parent, stamped at creation |
| PL-2 | Service line, sector, brand, negotiator, office and VAT denormalise from the Instruction on create |
| PL-3 | Every probability change captures a pre-image before applying |
| PL-4 | A locked period rejects edits to fee, probability, status and invoice fields |
| FL-2 | Withdrawing an Instruction cascades its open WIP lines to Lost |
| FL-3 | A cascade into a closed period is refused rather than rewriting history |
| FL-4 | The period locks on the 15th of the following month |
| FL-5 | Billing from under 30% probability raises a gaming alert |
| F5 | The invoice entity must be classified as a Legal Entity |
| BR | WIP → Billed → Paid, with Lost. Paid and Lost are terminal |
| BR | Invoice number, due date and ERP reference required at Billed |
| BR | Date paid in full required at Paid; invoice number never cleared |
| BR | Probability freezes once status leaves WIP |
| BR | Fee schedule is a Capital Markets table and links nowhere else |

## Things worth trying

- On the **Create** tab, create an Instruction, then create a WIP line under it.
  The parent dropdown fills in from what you just created, and the new line
  appears in the WIP list filtered to itself. PL-2 fills service line, sector,
  brand, negotiator, office and VAT from the parent, so you never enter them.
- Open a line, press **Bill it** with the fields empty. The invoice-requirement
  trigger rejects the write and explains why.
- Fill the fields and bill a line that is still under 30% probability. It
  succeeds — and the FL-5 alert appears on the Controls tab.
- Lock a reporting month on the Controls tab, then try to edit one of its lines.
- Withdraw an Instruction that owns a line in a closed period. The cascade is
  correct in principle, and FL-4 refuses to let it rewrite a locked period.

## Known gaps, carried from the wiki

These are unresolved in the source material and are surfaced in the app rather
than papered over:

- **Q1** — `kf_fin_localsystemref` has no authoritative source table. Stubbed as
  a WIP field here.
- **Q2** — PL-1/FL-2/FL-3 still describe the retired 13-lookup parent model. This
  POC models the single-Instruction parent instead.
- **Q3** — Staleness has no Dataverse equivalent. Implemented as a view column
  plus a UI flag.
- **Q7** — Reporting KPIs reference `kf_Deal.kf_fin_outstanding`, which does not
  exist. Aged receivables here is an inferred derivation from billed lines, and
  the KPI bar warns that mixed currencies are summed without conversion.

## Layout

```
src/lib/schema.js   tables, views, triggers  — the model
src/lib/seed.js     demonstration data, transitioned so triggers fire
src/lib/db.js       sql.js lifecycle + IndexedDB persistence
src/lib/repo.js     domain queries and commands
scripts/verify.mjs     schema, seed and rule checks against raw sql.js
scripts/smoke.mjs      every query and command in repo.js, with browser shims
scripts/browser-check.mjs  end-to-end render check in headless Chrome
```

The seed is deliberately written as live transitions rather than finished rows:
inserting a line straight into `Billed` would skip the invoice checks and the
gaming alert, which are the parts worth demonstrating.

## Deployment

This app is a subdirectory of a larger repository, so its Pages workflow lives at
the **repository root** in `.github/workflows/pages.yml` — GitHub only discovers
workflows there. Every step that touches the app is directed at this folder with
`defaults.run.working-directory`, and the build gates on `verify`, `smoke`,
`check` and `browser-check` before publishing `dist/`.

Pages must be enabled with **Settings → Pages → Build and deployment → Source:
GitHub Actions**. Nothing deploys until that is set.
