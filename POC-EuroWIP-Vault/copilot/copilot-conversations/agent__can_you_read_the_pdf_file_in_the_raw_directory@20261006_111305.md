---
epoch: 1791281585056
mode: agent
backendId: opencode
projectId: "debe6f1a-9d0f-437b-b8db-43703f81ca1f"
sessionId: "ses_eef4d6416ffe81GfQYxLXEc6Wv"
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
[Timestamp: 2026/10/06 11:13:05]