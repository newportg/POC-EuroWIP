---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Project Overview

Extracted from `raw/EU CRM Data Model.xlsx`. CRM is treated here as a supporting
dependency only — see [[wip-crm-dependencies]].

## What "WIP" means in this programme

WIP = **work in progress and billing**. It is the finance-side record of fee-earning
work that has been instructed but not yet invoiced and collected. The programme
delivers it as two Dataverse tables at Layer 2 (`KF_Global_Core` / `KF_Core`),
category **Finance**:

| Table | Role |
| --- | --- |
| `kf_Instruction` | Mandate / engagement master. The parent. |
| `kf_WIP` | Shared WIP & billing tracker. The child. |

Everything else in the model (deals, engagements, leases, valuations, mandates) is
CRM. These two are the finance spine that hangs fee, billing and revenue-recognition
data off every service line.

## The single architectural rule

> `kf_WIP` has **no** service-line lookups. All service-line context is reached
> through `kf_Instruction`.

This is stated three times in the source and is the most important WIP design
decision:

- Relationships Summary, "WIP/Billed Line Relationships (kf_WIP)": *"`kf_Instruction
  ~ kf_WIP` One-to-Many via `kf_WIP.kf_instructionid` — **The only service-line
  path**. All service-line context is reached via Instruction."*
- The same sheet adds: *"Service-line records (kf_Deal, kf_Engagement, kf_Lease,
  etc.) connect to `kf_WIP` **indirectly** via `kf_Instruction`. Example path:
  `kf_Deal → kf_Instruction → kf_WIP`. There are no direct service-line lookups on
  `kf_WIP`."*
- Every service-line tab (Capital Markets, OSS, Residential, Valuations, Property
  Mgmt, Leasing, Development, Capital Advisory, Investor Advisory, Building
  Consult, ESG Consultancy, Workplace) lists `kf_WIP` identically: *"Finance
  (L2, KF_Global_Core) — Finance — WIP/billing tracking; linked via
  `kf_Instruction`."*

Consequence: adding a new service line requires **no change to `kf_WIP`**. It
requires a new 1:1 parent lookup on `kf_Instruction`. See
[[wip-instruction-model]].

## Why it exists — the driver

`kf_WIP` **replaces the SharePoint "WIP & Billed" template**. Source, Marketing &
Support tab:

> "Note: This replaces the SharePoint WIP & Billed template. **Hard cutover** —
> remove SP write access on go-live day."

So the deliverable is not just a table. It is a **migration with a hard cutover**:
the SharePoint template must be decommissioned on the same day the Dataverse table
goes live, and reporting month is a field on the record rather than a spreadsheet
tab.

`kf_reportingmonth` is documented as *"Reporting month (1st of month) — **replaces
spreadsheet monthly tabs**"*. That is the concrete mechanism for retiring the
spreadsheet structure.

## Why it is not yet an ERP

ERP integration is explicitly deferred. The Account ↔ D365 Finance `CustTable`
bidirectional sync is annotated *">> deferred to future phases"*, and the
consolidated Finance ERP sits in **Phase 7**, which *"activates 9 integration
flows"*.

So the WIP design deliberately carries the ERP cross-reference fields now
(`kf_fin_localsystemname`, `kf_invoicenumber`, `kf_invoiceduedate`,
`kf_datepaidinfull`) and populates them manually until Phase 7. See
[[wip-finance-erp-integration]].

> [!note] Inference, not stated in source
> The source does not say how WIP lines are created between Phase 1 and Phase 7.
> The most consistent reading is that invoice/payment data is keyed in by hand
> during that window. Logged as an open question in [[wip-open-questions]].

## Service line coverage

`kf_WIP` and `kf_Instruction` are mapped ✅ to **all twelve** service lines in the
Master Table Index:

Capital Markets · Residential · OSS · Valuations · ESG Consultancy · Building
Consultancy · Development · Capital Advisory · Property Management · Investor
Advisory · Workplace Consulting · Leasing

Marketing is the only column marked ❌.

## Activation phasing

From "Phase Definitions", category Finance, both tables are marked **MVP**. The
Master Table Index repeats `MVP` for `kf_WIP` (Layer 2 – Finance) and `kf_Instruction`
(Layer 2, KF_Global_Core).

Caveat: the "TABLES BY ACTIVATION PHASE" table in Phase Definitions enumerates the
Phase 0 and Phase 1 MVP tables and **omits `kf_WIP` and `kf_Instruction` entirely**,
while the Master Table Index marks both as MVP. Recorded in
[[wip-open-questions]].

## In-scope definition

| In scope for the WIP project | Out of scope (CRM, dependency only) |
| --- | --- |
| `kf_WIP` table build and column spec | Deal lifecycle and 8-stage BPF |
| `kf_Instruction` table build | Property/Site asset register |
| Status lifecycle WIP → Billed → Paid / Lost | KYC, NDA, Bid, DD, Red Flag, Pitch |
| Period lock and stale detection | Investor profiles, data rooms |
| Weighted office retained, VAT, probability | Client and property taxonomies |
| Fee schedule linkage | Marketing lead journeys |
| ERP cross-reference fields | |
| WIP automation (plugins, flows, business rules) | |
| WIP reporting and KPIs | |
| SharePoint cutover | |

## Entry points

- [[wip-simple-workflow]] — the plain-English version, no jargon
- [[wip-high-level-workflow]] — the end-to-end workflow, from mandate to paid
- [[wip-table-specification]] — every `kf_WIP` column, status lifecycle, conditional requirements
- [[wip-instruction-model]] — the parent, and the 13 service-line lookups
- [[wip-mandate-components]] — what a mandate requires before it is valid
- [[wip-automation-requirements]] — PL-1…4, FL-1…6, BR-1…6, DD-1
- [[wip-period-locking-and-aging]] — reporting month, period lock, stale flags
- [[wip-finance-erp-integration]] — invoice fields, VAT, local systems, Phase 7
- [[wip-stage-gates]] — gating WIP entry at BPF transitions
- [[wip-reporting-and-kpis]] — Power BI and WIP KPIs
- [[wip-rollout-plan]] — phases, MVP activation, cutover
- [[wip-crm-dependencies]] — the CRM the WIP leans on
- [[wip-taxonomy-inputs]] — sector and industry codes WIP inherits
- [[wip-open-questions]] — contradictions in the source, unresolved
- [[wip-delivery-backlog]] — the task register that drives [[Dashboard]]

## ArchiMate views

Start at [[wip-archimate-index]].

- [[wip-application-composition]] — the data model and the single-parent rule
- [[wip-lifecycle]] — the WIP → Billed → Paid / Lost ladder
- [[wip-monthly-cycle]] — close, lock, alert, chase
- [[wip-system-landscape]] — what WIP touches now, and what it defers to Phase 7
