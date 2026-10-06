---
epoch: 1791281585056
mode: agent
backendId: opencode
projectId: "debe6f1a-9d0f-437b-b8db-43703f81ca1f"
sessionId: "ses_eef4d6416ffe81GfQYxLXEc6Wv"
agentLabel: "Answering open questions from PDF"
usage: '{"usedTokens":70846,"contextWindow":200000,"updatedAt":1791294753454}'
tags:
  - copilot-conversation
---

**user**: can you read the pdf file in the raw directory and answer any of the outstanding questions
[Timestamp: 2026/10/06 11:13:05]

**ai**: Extracted the PDF (Copilot Plus isn't active for the bundled reader, so I fell back to `pypdf` — 35 pages, full text captured). Here's what it says against the open questions.

## What the architecture review PDF answers

**Q10 — the nine Phase 7 flows (partially answered, biggest gain).** Page 24 has a slide "HOW THE INTEGRATION FLOWS RUN" that names six behaviours for the first time:

- **Flow 1** — at S3, the Finance project is created
- Each stage change updates % complete in Finance
- Deal won raises a draft invoice request
- Invoice and payment data returns within hours
- A monthly batch refreshes WIP balance and ageing
- A credit hold alerts the broker in Teams

Six behaviours, only `Flow 1` numbered — still not a canonical list of nine. Page 23 adds the mapping table behind them: `kf_WIP` line ↔ D365 project, `kf_FeeSchedule` ↔ project budget/contract line, BPF stage ↔ % complete, Won ↔ milestone/invoice request, Account ↔ customer (debtor).

**Q4 — MVP activation (decision now has a documented basis).** Two direct quotes put WIP inside the MVP:

- CRM Lite requirements: *"Full pipeline visibility with built-in WIP data"*
- Capital Markets requirements: *"WIP aging alerts and monthly reconciliation"*

So the omission from the activation list is a list error, not a scope statement — both tables should be activated in Phase 0/1.

**Q1 — ERP cross-reference home (evidence favours keeping it on `kf_WIP`).** The deck's own `KF_WIP` field list includes `kf_fin_localsystemref`, alongside `kf_wipid`, `kf_parenttype`, `kf_instructionid`, `kf_netfeetogroup`, `kf_officeretained`, `kf_probability`, `kf_grossfee`, `kf_reportingmonth`, `kf_wipstatus`, `kf_invoicenumber`. It's a third, slide-level variant (it omits `kf_feescheduleid` too), so not a spec — but the architecture review sides with option A: put the field back on `kf_WIP`.

**Questions it does *not* answer:** 2, 3, 5, 6, 7, 8, 11, 13, 14 — no mention of period locks, staleness, KPI fields, `kf_Instruction` definitions, or the SharePoint cutover. Two incidental data points: page 6 puts finance at *"Manual (Finance Admin)"* in MVP with *"Centralised EU ERP"* as future (slight tension with the D365 Finance flows on pages 23–24), and page 30 shows all regulatory gates firing on the deal BPF stages, not on WIP tables (bears on Q9).

Now merging this into the questions note:



Now committing per the vault rule (commit after meaningful changes):

Done. The PDF was `raw/European CRM Architecture Review 2.pdf` — a 35-page "working architecture hypothesis" deck for the European CRM. I extracted it via `pypdf` (the Copilot Plus PDF reader isn't active, so I used my own fallback), read it cover to cover, and cross-referenced it against the 14 questions in [[wip-open-questions]].

**Questions the PDF answers or substantially advances:**

| # | Question | Verdict from the PDF |
| --- | --- | --- |
| 1 | Where does the ERP ref go? | The deck's own `KF_WIP` field list **includes `kf_fin_localsystemref`** — a third, slide-level definition that sides with keeping it on `kf_WIP` (option A). It also omits `kf_feescheduleid`, so it's evidence, not a spec. |
| 4 | WIP missing from MVP list | WIP is explicitly in MVP scope — *"Full pipeline visibility with built-in WIP data"* (CRM Lite) and *"WIP aging alerts and monthly reconciliation"* (CM). The omission is a list error, not a scope statement. |
| 10 | The nine Phase 7 flows | Six flow behaviours are now named for the first time: **Flow 1** (Finance project created at S3), % complete updates, draft invoice request on win, invoice/payment return, monthly WIP balance + ageing refresh, credit-hold Teams alert. Still no canonical list of nine, and a numbering gap to reconcile. |
| 9 | Stage gates on WIP? | All regulatory gates fire on the **deal BPF stages** (S2–S8), and WIP is *driven by* the BPF (% complete per stage) — the design leans to rules-on-BPF, not WIP-targeted gates. |
| 12 | `kf_parenttype` | Still carried in the deck with no values or purpose — question stands. |

**Not answered** (no mention anywhere in the deck): Q2, Q3, Q5, Q6, Q7, Q8, Q11, Q13, Q14 — no period-lock fields, no staleness rules, no KPI derivations, no `kf_Instruction` spec, no SharePoint cutover.

One new tension worth flagging: the deck puts MVP finance as *"Manual (Finance Admin)"* with the D365 Finance integration as a *future* phase — yet pages 23–24 describe the D365 project/flow mechanics as the working design. The workbook's Phase 7 dependency needs a phase owner to reconcile.

I've logged all of this into [[wip-open-questions]] under each affected question (plus a summary note), keeping them open — this is evidence, not resolution. Committed as `evidence: log architecture review PDF findings against WIP open questions`.
[Timestamp: 2026/10/06 11:13:05]

**user**: can you create a page which describes the high level workflow
[Timestamp: 2026/10/06 14:49:08]

**ai**: 



The workflow picture is complete: the workbook's status ladder + automation rules, and the deck's BPF→% complete drive and integration flows. I'll create the page in the wiki and wire it into the overview's entry points.Now wiring it into the overview's entry points:Created **[[wip-high-level-workflow]]** — the page is at `wiki/wip-high-level-workflow.md`, committed as `docs: add high-level WIP workflow page`.

What it covers:

- **A rendered mermaid diagram** of the full journey: mandate signed → WIP line created → monthly accrual → reconcile / period lock → billed → paid / lost, plus the two exception paths (stale → re-forecast/close out, parent-loss cascade) and the BPF → % complete drive.
- **Stage-by-stage table** — each step with its trigger, what happens, and the controls (PL-1/PL-2, FL-4/PL-4, FL-5, invoice field requirements, VAT defaults).
- **The two clocks** — the `kf_wipstatus` ladder (finance control) vs the 8-stage deal BPF (the deck's S1 5% → S8 100% automation drive), which is the new material from the PDF.
- **The monthly drumbeat** — FL-1 / FL-6 / month-end / lock cadences, pointing to the [[wip-monthly-cycle]] diagram for dynamics.
- **Phase 7 target state** — the six integration-flow behaviours from the deck in a table, with the CRM→Finance mapping, flagged that the nine still aren't enumerated (Q10).
- **Blocking section** — Q1, Q2, Q6, Q9 mapped onto the specific workflow steps they break.

Two things I logged along the way rather than glossing over:

1. **A new stage-name discrepancy** — the workbook BPF (Origination → Pitch → Mandate → … → Exchange → Completion) vs the deck's stages (S2 *Pitch & Mandate*, S3 *Instruction*, S6 *Exclusivity*, S7 *Due Diligence*). Same functional shape, different names — flagged as a callout because stage gates will be registered against stage names.
2. The deck's present-tense D365 flows vs its own *"Manual (Finance Admin)"* MVP finance row (already noted under Q10 in [[wip-open-questions]]).

I also added the new page at the top of the entry points in [[wip-project-overview]], so it's reachable from the hub. The Dashboard's wiki index will pick it up automatically (it's typed `spec`).
[Timestamp: 2026/10/06 14:49:08]