---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# kf_Instruction — The WIP Parent Model

Authoritative source: `EU CRM Data Model.xlsx` → **"2. Core Shared Tables" §1.7**,
*"kf_Instruction (Core Finance Layer — Mandate / Engagement Master)"*.

The Capital Markets tab closes with an explicit pointer: *"kf_Instruction — See
'2. Core Shared Tables' tab, Section 1.7 for the authoritative definition."* The
Master Table Index (#43) and Marketing & Support (Table 6) carry an older, narrower
version — see [[wip-open-questions]].

**Layer:** 2 — Finance (`KF_Global_Core`)
**Category:** Finance
**Service lines:** all twelve
**OOB/Custom:** Custom

## Core fields

| Column | Type | Description | Notes |
| --- | --- | --- | --- |
| `kf_instructionid` | GUID (PK) | Primary key | |
| `kf_name` | Text (Auto-number) | Auto-numbered reference `INS-{SEQNUM:6}` | Auto |
| `kf_instructiontype` | Choice | Mandate / Engagement / Instruction | **Required** |
| `kf_serviceline` | Choice (Global) | Service line | **Required** — drives which parent lookup is used |
| `kf_clientaccountid` | Lookup → Account | Client account **at Brand/Group level** | **Required** |
| `kf_legalentityaccountid` | Lookup → Account | Legal entity account **for invoicing** | Filtered to Legal Entity only |
| `kf_primarycontactid` | Lookup → Contact | Primary contact | |
| `kf_propertyid` | Lookup → `kf_Property` | Primary property reference | Optional — for portfolios |
| `kf_owningoffice` | Lookup → BusinessUnit | Owning office | **Required** — security scoping |
| `kf_instructionstatus` | Choice | Active / Completed / On Hold / Withdrawn | **Required** |
| `kf_startdate` | Date | Instruction start date | **Required** |
| `kf_enddate` | Date | Instruction end date | |
| `kf_signeddate` | Date | Date instruction was signed | |
| `kf_expectedrevenue` | Currency | Expected revenue | |
| `kf_terminationreason` | Choice | Client request / KF withdrawal / Completed / Other | Conditional — required when status = Withdrawn |
| `kf_comments` | Multi-line Text (2000) | General comments | |
| `kf_fin_localsystemref` | Text (100) | ERP cross-reference | |
| `kf_fin_localsystemname` | Choice | Paris GL / Madrid Accounting / SAP / Other | |
| `kf_fin_projectid` | Text (50) | Finance project ID | |

## The two-account problem

`kf_Instruction` splits the client into two roles, and this is the single most
important non-WIP-table design decision that WIP inherits:

- **`kf_clientaccountid`** — the Brand/Group. *"Client organisation at Brand/Group
  level. This is the relationship owner — the ultimate parent company or fund
  manager. Used for relationship reporting."* Drives cross-sell and relationship
  reporting.
- **`kf_legalentityaccountid`** — *"The Legal Entity account (SPV, fund vehicle, JV)
  that is the contractual party on the instruction. **The entity on the fee letter
  and invoice.**"* Filtered lookup F5 restricts it to `kf_accountclassification =
  Legal Entity`.

Finance therefore invoices the legal entity; relationship reporting counts the brand.
WIP auto-populates `kf_clientaccountid` from this record.

Filtered lookup F5: `kf_Instruction.kf_legalentityaccountid` → filter
`kf_accountclassification = Legal Entity` → *"Invoice entity must be Legal Entity"*.

## Service-line parent lookups

The source specifies: **"Exactly one populated per record, determined by
`kf_serviceline`"**. This is the mechanism that lets one table serve twelve service
lines.

| Column | Lookup target | Service line |
| --- | --- | --- |
| `kf_dealid` | `kf_Deal` | Capital Markets |
| `kf_engagementid` | `kf_Engagement` | OSS |
| `kf_valuationinstructionid` | `kf_ValuationInstruction` | Valuations |
| `kf_leaseid` | `kf_Lease` | Leasing |
| `kf_propertymandateid` | `kf_PropertyMandate` | Property Management |
| `kf_developmentprojectid` | `kf_DevelopmentProject` | Development |
| `kf_debtmandateid` | `kf_DebtMandate` | Capital Advisory |
| `kf_buildingsurveyid` | `kf_BuildingSurvey` | Building Consultancy |
| `kf_workplaceassessmentid` | `kf_WorkplaceAssessment` | Workplace |
| `kf_investormandateid` | `kf_InvestorMandate` | Investor Advisory |
| `kf_salesinstructionid` | `kf_SalesInstruction` | Residential Sales |
| `kf_lettingsinstructionid` | `kf_LettingsInstruction` | Residential Lettings |
| `kf_esgassessmentid` | `kf_ESGAssessment` | ESG Consultancy |

All are One-to-One from the service-line table's perspective. Capital Markets is the
one with a live pipeline in Phase 1; the other twelve are Phase 3+.

## Relationships

| From | To | Type | FK column |
| --- | --- | --- | --- |
| Account | `kf_Instruction` | One-to-Many | `kf_clientaccountid` — Brand/Group level |
| Account | `kf_Instruction` | One-to-Many | `kf_legalentityaccountid` — Legal Entity, filtered |
| Contact | `kf_Instruction` | One-to-Many | `kf_primarycontactid` |
| `kf_Property` | `kf_Instruction` | One-to-Many | `kf_propertyid` |
| BusinessUnit | `kf_Instruction` | One-to-Many | `kf_owningoffice` |
| `kf_Deal` | `kf_Instruction` | **One-to-One** | `kf_dealid` |
| … | … | One-to-One | one per service line (13 total) |
| `kf_Instruction` | `kf_WIP` | **One-to-Many** | `kf_WIP.kf_instructionid` |

## The universal property junction

`kf_Instruction ↔ kf_Property` is **Many-to-Many, implemented via `kf_DealProperty`**.

`kf_MandateProperty` was **retired and merged into `kf_DealProperty`** — decision date
**26/08/2026**. `kf_DealProperty` is now the single universal junction between any
engagement and one or more properties:

| Column | Type | Notes |
| --- | --- | --- |
| `kf_dealpropertyid` | GUID (PK) | |
| `kf_name` | Text (Auto-number) | `DP-{SEQNUM:6}` |
| `kf_instructionid` | Lookup → `kf_Instruction` | **Universal parent, populated by all service lines** — Required |
| `kf_propertyid` | Lookup → `kf_Property` | Required |
| `kf_dateadded` | Date | |
| `kf_dateremoved` | Date | |
| `kf_status` | Choice | Active / Removed / Sold — Required |
| `kf_notes` | Multi-line Text | |

Two Layer 5 extensions hang off the Layer 2 base:

- **CM extension** — `kf_DealProperty → kf_Deal` (Many-to-One): *"secondary parent for
  CM deal form sub-grid and BPF gate validation"*. Single-asset deals have exactly
  one.
- **PM extension** — `kf_DealProperty → kf_PropertyMandate` (Many-to-One): *"PM-specific
  parent for managed portfolio tracking"*.

This matters to WIP because `kf_WIP.kf_propertyid` is a single optional property
reference. Portfolio work reaches multiple properties via
`kf_Instruction → kf_DealProperty → kf_Property`, not via the WIP record. For fee
reporting the Instruction is the correct granularity; the property link is
presentational.

## Downstream CRM

`kf_DealProperty` also anchors two optional CM children that are WIP-adjacent:
`kf_DDMilestone.kf_dealpropertyid` and `kf_RedFlag.kf_dealpropertyid` — both
*"property-specific"* within a portfolio deal.

---

See [[wip-mandate-components]] for what the **Mandate** subtype of this table
requires in practice.
