---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Finance and ERP Integration

Everything `kf_WIP` needs in order to become an invoicing and revenue-recognition
record, and the phased path to real ERP integration.

Category definition, Phase Definitions: *"Finance — Finance integration tables for
WIP, billing, and revenue recognition."*

## Invoice lifecycle requirements

Conditional fields on `kf_WIP`, keyed to status:

| Field | Required at | Purpose |
| --- | --- | --- |
| `kf_invoicenumber` | **Billed / Paid** | Invoice number (Text 50) |
| `kf_invoiceduedate` | **Billed** | Invoice due date |
| `kf_datepaidinfull` | **Paid** | Date paid in full |
| `kf_fin_localsystemref` | **Billed** | ERP cross-reference (Text 100) |

Business rules BR-1…6 include *"Invoice field requirements"* as the first named
rule — these conditional fields are what it enforces.

The status ladder is therefore:

```
WIP  ──(invoice issued)──►  Billed  ──(payment received)──►  Paid
 │                              │
 └──(work abandoned)──►  Lost   └──(cancelled post-invoice)──►  Lost
```

- `kf_invoiceduedate` is conditional at **Billed** but not at Paid — a paid line
  inherited the due date at billing.
- `kf_datepaidinfull` is only required at **Paid** — the terminal collection field.
- `kf_invoicenumber` is required at **both** Billed and Paid, i.e. it is never
  cleared once set.

## VAT

| Field | Rule |
| --- | --- |
| `kf_vatpercent` | Decimal, defaulted **by business unit** |

Defaults from the source: **FR = 20, ES = 21, UK = 20**. Implemented as business
rule *"VAT default"* in BR-1…6.

`kf_owningoffice` is inherited from the Instruction, so the VAT rate follows the
owning office, not the client's jurisdiction. A Paris office billing a Madrid client
still defaults to 20.

## Currencies

| Field | Rule |
| --- | --- |
| `transactioncurrencyid` | Lookup → Currency, auto — defaults from parent |

BR-1…6 include a *"currency warning"*. The pan-Euro estate runs EUR and GBP at
minimum (Paris GL, Madrid Accounting, SAP, plus UK at 20% VAT), and the reporting
aggregations in [[wip-reporting-and-kpis]] sum currency columns. Mixed-currency sums
are an explicit acknowledged risk.

## Local finance systems

| Field | Values | Rule |
| --- | --- | --- |
| `kf_fin_localsystemname` | **Paris GL / Madrid Accounting / SAP / Other** | Auto — defaults from business unit |

Present on `kf_Instruction` in the authoritative Core definition. Present on
`kf_WIP` in the older Master Table Index definition.

| Field | Rule |
| --- | --- |
| `kf_fin_localsystemref` | ERP cross-reference. On `kf_Instruction`: Text (100), no required flag. On `kf_WIP` (older spec): **required at Billed** |
| `kf_fin_projectid` | Text (50), Finance project ID. `kf_Instruction` only |

**The three-phase office landscape:** Phase 1 goes live in **Paris** (Paris CM Deep
Build), Phase 2 adds **Madrid** and EIT. The local-system choice anticipates that a
Create WIP record in Madrid books to a different ledger than one created in Paris.

## Deferred ERP integration

The source is explicit that integration is not in the early phases:

| Item | Status |
| --- | --- |
| Account ↔ D365 Finance `CustTable` bidirectional sync | **">> deferred to future phases"** |
| Consolidated Finance ERP | **Phase 7** — *"activates 9 integration flows"* |
| Full API integration replacing manual CRM ↔ Hub transition | Phase 6 |

Phase 1 scope (Paris CM Deep Build) does list *"Finance integration"*, which sits
alongside the general deferral. The nine integration flows activated at Phase 7 are
**not enumerated anywhere in the source** — see [[wip-open-questions]].

> [!note] Inference
> Given the Account sync is deferred and the consolidated ERP is Phase 7, WIP
> invoice and payment data is almost certainly keyed manually between Phase 1 and
> Phase 7, with `kf_fin_localsystemref` recorded by hand as the interim join key
> back to the ledger. The existence of the field — and its *"required at Billed"*
> rule — supports this. Not stated explicitly.

## `kf_IntegrationLog` — the integration control record

Target system choice includes **Finance**, so WIP flows log here. Fields relevant
to WIP integration:

| Field | Purpose |
| --- | --- |
| `kf_flowname` / `kf_flowrunid` | Flow identity and run trace |
| `kf_correlationid` | Links related log entries across systems — required |
| `kf_triggerrecord` / `kf_triggertable` | What fired it |
| `kf_direction` | Inbound / Outbound / Internal |
| `kf_targetsystem` | Finance / SharePoint / Power BI / External API / Outlook / Other |
| `kf_status` | Success / Failed / Partial / Retrying / Skipped |
| `kf_recordsprocessed` / `kf_recordsfailed` | Batch counts |
| `kf_retrycount` / `kf_maxretries` | Retry control |
| `kf_environment` | Production / UAT / Dev / Sandbox |

`kf_correlationid` being **required** is the mechanism for tracing a WIP record
across CRM → ledger. It should be populated on the WIP record or derivable, or the
Phase 7 integration will have no reliable join.

> [!note] Spec conflict
> The source carries two conflicting column definitions for `kf_IntegrationLog`:
> Master Table Index #38 (22 fields, includes `kf_correlationid` as required) and
> Marketing & Support §5.2 (7 fields, no correlation ID, adds
> `kf_integrationname` = Yardi / MRI / D365 Finance / PropStream / External API).
> The Master Table Index version is used here as the fuller one. See
> [[wip-open-questions]].

## Fee schedule linkage

| Field | Rule |
| --- | --- |
| `kf_FeeSchedule.kf_dealid` | Parent deal (CM) — required |
| `kf_WIP.kf_feescheduleid` | **Optional** Fee Schedule link |

`kf_FeeSchedule` is a Capital Markets table (Layer 5), and the WIP link is
explicitly optional. This is how a WIP line gets its fee basis:

| Field | Values |
| --- | --- |
| `kf_feebasis` | Fixed / % of Value / Tiered / Hourly |
| `kf_feeamount` | Fixed fee amount |
| `kf_feepercent` | Fee percentage |
| `kf_tierstructure` | Tiered fee description |
| `kf_minimumfee` | Minimum fee floor |
| `kf_cappedamount` | Fee cap |
| `kf_triggerpoint` | **On Mandate / On Exchange / On Completion / Monthly / Quarterly** |
| `kf_invoiceduedays` | Payment terms (days) |
| `kf_feestatus` | Agreed / Draft / Under Negotiation / Superseded |
| `kf_approvedby` | Partner who approved |
| `kf_effectivedate` | Date fee schedule effective |

Two things to note:

1. **`kf_triggerpoint` with Monthly/Quarterly values implies recurring WIP lines.**
   A monthly-triggered fee schedule generates a WIP line per period, each with its
   own `kf_reportingmonth`. This is the mechanism by which retainer-style work enters
   the WIP tracker repeatedly rather than once.
2. **`kf_feescheduleid` is optional on `kf_WIP`, but `kf_FeeSchedule` is CM-only.**
   The other eleven service lines have no fee schedule table. Their WIP lines carry
   `kf_grossfee` / `kf_netfeetogroup` / `kf_officeretained` directly, keyed in by
   hand. The optional link is a Phase 1 convenience, not a cross-service-line
   mechanism.

## Related

- [[wip-table-specification]] — full column spec
- [[wip-automation-requirements]] — FL-5 probability gaming, VAT default rule
- [[wip-rollout-plan]] — Phase 7
