---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# kf_WIP — Table Specification

Authoritative source: `EU CRM Data Model.xlsx` → **"2. Core Shared Tables" §1.6**,
titled *"kf_WIP (Core — Finance Layer, Shared WIP & Billing Tracker)"*. The Master
Table Index still carries this table under its old name `kf_WIPBilledLine`; the Core
Shared Tables tab is the newer and authoritative version (see
[[wip-open-questions]]).

**Layer:** 2 — Finance (`KF_Global_Core` / `KF_Core`)
**Category:** Finance — *"Finance integration tables for WIP, billing, and revenue recognition"*
**Service lines:** all twelve
**OOB/Custom:** Custom

## Identity and parentage

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_wipid` | GUID (PK) | Primary key | **Renamed from `kf_wipbilledlineid`** |
| `kf_name` | Text (Auto-number) | Auto-numbered reference `WIP-{SEQNUM:6}` | Auto |
| `kf_parenttype` | Choice | Parent object type | Auto — set by plugin |
| `kf_instructionid` | Lookup → `kf_Instruction` | Link to parent Instruction | **The only service-line path** |
| `kf_feescheduleid` | Lookup → `kf_FeeSchedule` | Optional Fee Schedule link | |

`kf_parenttype` is a vestige: the old design gave `kf_WIP` thirteen service-line
parent lookups and used this field to record which one was populated. The current
Core definition has a single parent (`kf_Instruction`). PL-1 still validates *"exactly
1 parent lookup populated"* — see [[wip-open-questions]].

## Classification — denormalised for flat reporting

All auto-populated from the parent Instruction.

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_serviceline` | Choice (Global) | Service line | Auto — auto-populated from parent |
| `kf_transactiontype` | Choice (Global) | Transaction type | |
| `kf_sector` | Choice (Global) | Property sector | Auto — auto-populated from parent |
| `kf_clientaccountid` | Lookup → Account | Client account | Auto — auto-populated from parent |
| `kf_spvaccountid` | Lookup → Account | SPV entity | |
| `kf_propertyid` | Lookup → `kf_Property` | Property reference | |
| `kf_negotiatorid` | Lookup → SystemUser | Lead negotiator | Auto |

The denormalisation is deliberate: it lets finance report on service line, sector and
client without walking the relationship chain. Plugin PL-2 enforces the
auto-population.

## Financials

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `transactioncurrencyid` | Lookup → Currency | Transaction currency | Auto |
| `kf_netfeetogroup` | Currency | Net fee to group | |
| `kf_officeretained` | Currency | Office retained portion | |
| `kf_probability` | Decimal | Probability % | 0–100 |
| `kf_weightedofficeretained` | Currency | officeretained × probability / 100 | **Calculated** |
| `kf_vatpercent` | Currency rate (Decimal) | VAT rate | Defaults by BU: **FR = 20, ES = 21, UK = 20** |
| `kf_grossfee` | Currency | Gross fee amount | |

`kf_weightedofficeretained` is the pipeline-value field. It is the WIP equivalent of
weighted pipeline: office-retained fee discounted by confidence. Business rule
BR set includes a **currency warning** — a mixed-currency aggregate across a
pan-Euro estate is a known reporting hazard.

## Timeline

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_reportingmonth` | Date | Reporting month (1st of month) | **Required** — *replaces spreadsheet monthly tabs* |
| `kf_completionmonth` | Date | Expected completion month | |
| `kf_staledate` | Date | `completionmonth + 30 days` | **Calculated** |
| `kf_isstale` | Yes/No | `wipstatus = WIP AND today > staledate` | **Calculated** |

## Status and lifecycle

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_wipstatus` | Choice | `WIP → Billed → Paid / Lost` | **Required** |
| `kf_wipstatuschangedon` | DateTime | Status change timestamp | Auto |
| `kf_previousprobability` | Decimal | Previous probability | Auto |

The choice set is four values: **WIP, Billed, Paid, Lost**. The arrow notation in the
source encodes a directed progression, not a strict linear chain — `Lost` is
reachable from `WIP`, and `Paid` is the terminal success state.

Plugin PL-3 tracks probability changes and writes `kf_previousprobability` before
each update. This exists to make the FL-5 "probability gaming" detection possible —
see [[wip-automation-requirements]].

## Invoice and ERP

| Column | Type | Description | Requirement |
| --- | --- | --- | --- |
| `kf_invoicenumber` | Text (50) | Invoice number | **Conditional — required at Billed/Paid** |
| `kf_invoiceduedate` | Date | Invoice due date | **Conditional — required at Billed** |
| `kf_datepaidinfull` | Date | Date paid in full | **Conditional — required at Paid** |
| `kf_fin_localsystemref` | Text (100) | ERP cross-reference | **Conditional — required at Billed** |

> [!warning] Spec conflict
> The Master Table Index carries `kf_fin_localsystemref` and
> `kf_fin_localsystemname` on `kf_WIP`; the newer Core Shared Tables definition
> **omits both**, leaving them only on `kf_Instruction`. Since `kf_fin_localsystemref`
> is documented as *required at Billed status*, a WIP line at Billed has nowhere to
> put the ERP reference under the Core definition. Logged in
> [[wip-open-questions]].

`kf_fin_localsystemname` is a choice of **Paris GL / Madrid Accounting / SAP /
Other**, auto-defaulted from the owning business unit.

## Governance — period lock

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_owningoffice` | Lookup → BusinessUnit | Owning office | Auto — inherited from parent |
| `kf_periodlocked` | Yes/No | Period locked flag | Auto — set by monthly scheduled flow |
| `kf_lockedby` | Lookup → SystemUser | User who locked period | |
| `kf_lockedon` | DateTime | Lock timestamp | |
| `kf_comments` | Multi-line Text (2000) | General comments | |

Full behaviour in [[wip-period-locking-and-aging]].

## Relationships

| From | To | Type | FK column |
| --- | --- | --- | --- |
| `kf_Instruction` | `kf_WIP` | One-to-Many | `kf_WIP.kf_instructionid` |
| Account | `kf_WIP` | One-to-Many | `kf_WIP.kf_clientaccountid` |
| `kf_Property` | `kf_WIP` | One-to-Many | `kf_WIP.kf_propertyid` |
| BusinessUnit | `kf_WIP` | One-to-Many | `kf_WIP.kf_owningoffice` |
| `kf_FeeSchedule` | `kf_WIP` | One-to-Many | `kf_WIP.kf_feescheduleid` |

No direct service-line relationships. See [[wip-project-overview]].

## Auto-numbering

`WIP-{SEQNUM:6}` — six-digit zero-padded sequence. This is the record reference that
finance will quote in correspondence, so the format is a contractual artefact, not a
cosmetic choice.
