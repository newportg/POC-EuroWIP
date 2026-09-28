---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Stage Gates

`kf_StageGateRule` is the configuration table for business process validation. It is
mostly a CRM concern, but it gates WIP entry, so the WIP project depends on it.

## Purpose

> *"Configuration table for BPF stage gate validation rules. Allows Layer 6/7
> solutions to register regulatory gates **without modifying the Layer 5 validator**."*

This is an extensibility mechanism. France-specific and EIT-specific gates register
as configuration rows rather than code changes, so a regulatory gate can be added
without a release.

## Specification

| Column | Type | Description |
| --- | --- | --- |
| `kf_stageGateRuleid` | GUID (PK) | Primary key |
| `kf_rulename` | Text (200) | Human-readable, e.g. *"CM – Mandate requires KYC cleared"* |
| `kf_targettable` | Choice | Table the rule applies to (`kf_Deal` / `kf_SalesInstruction` / `kf_Engagement` / `kf_ValuationInstruction` / …) |
| `kf_stage` | Choice | BPF stage the rule gates (e.g. Mandate / Exchange / Completion) |
| `kf_validationcondition` | Text (500) | Rule expression or plain-English condition, e.g. `"kf_KYCRecord.kf_kycstatus = Cleared"` |
| `kf_validationtype` | Choice | **Hard Block / Soft Warning / Info Only** |
| `kf_errormessage` | Text (500) | Message shown on failure |
| `kf_layer` | Choice | Layer 2 Core / Layer 5 Service Line / Layer 6 Regional / Layer 7 EIT |
| `kf_serviceline` | Choice | One of twelve, or All |
| `kf_region` | Choice | Global / UK / France / EMEA / APAC |
| `kf_isactive` | Yes/No | Active flag — toggle without deletion |
| `kf_effectivefrom` | Date | Date rule becomes effective |
| `kf_effectiveto` | Date | Expiry (null = no expiry) |
| `kf_priority` | Whole Number | Execution order when multiple rules hit the same stage |
| `kf_createdby` | Lookup → SystemUser | Rule author |
| `kf_approvedby` | Lookup → SystemUser | Business owner who approved |
| `kf_notes` | Multi-line Text | Rationale and context |

## WIP-relevant gates

The source does not enumerate any WIP-specific stage gate rules. The requirement
below is inferred from the two WIP fields that carry a hard dependency on process
state, and from `kf_invoicenumber` being *required at Billed*.

| Candidate gate | Stage | Condition | Type | Why |
| --- | --- | --- | --- | --- |
| WIP entry requires mandate | Mandate | `kf_Instruction.kf_instructionstatus = Active` and `kf_signeddate` populated | Hard Block | A WIP line with no signed instruction is unbillable |
| Invoice entity required | Billed | `kf_Instruction.kf_legalentityaccountid` populated | Hard Block | *"The entity on the fee letter and invoice"* — filtered lookup F5 enforces this on selection, but not on billing |
| Fee basis agreed | Billed | `kf_grossfee > 0` | Soft Warning | Billing a zero-value line is almost always a data error |

> [!warning] Not in the source
> The gate list above is **inferred**, not specified. `kf_StageGateRule` is
> documented as gating BPF stage transitions on service-line tables, and WIP
> operations are not BPF stages. Whether stage gates can target `kf_WIP` or
> `kf_Instruction` at all is unconfirmed — `kf_targettable` is a free choice list but
> no WIP table appears in its examples. See [[wip-open-questions]].

## The existing CM gates

For context, the CM BPF is 8 stages and the source references gating at S1 and S3:

- `kf_Deal.kf_accountid` — Brand/Group client — *"Required from Origination (S1)"*
- `kf_Deal.kf_legalentityaccountid` — *"**Required before Mandate stage (S3)**"*
  The choice value in the source is literally *"No (required by S3)"*

Full BPF: Origination → Pitch → Mandate → Marketing → Bidding → DD → Exchange →
Completion.

So a legal entity must exist by Mandate. WIP billing is downstream of that, which
means the WIP project inherits a dependency that is already live in the CM phase.

`kf_DealProperty.kf_dealid` is described as *"secondary parent for CM deal form
sub-grid and **BPF gate validation**"* — so property-level gate validation runs off
the junction table too.

## Other service line BPFs

Each service line has its own BPF, which will need its own gate rules as those
service lines activate (Phase 3+). Recorded in [[wip-rollout-plan]].

| Service line | BPF stages |
| --- | --- |
| Capital Markets | Origination → Pitch → Mandate → Marketing → Bidding → DD → Exchange → Completion |
| Residential Sales | Instruction → Prep → Marketing Live → Viewings → Under Offer → SSTC → Exchange → Completion |
| Residential Lettings | Instruction → Prep → Marketing → Viewings → Let Agreed → Tenancy Start |
| Residential Buying | Brief Agreed → Search → Shortlist → Viewings → Negotiation → Exchange → Completion |
| OSS | Scoping → Proposal → Active → Delivery → Complete |
| Leasing | Marketing → Viewing → Heads of Terms → Legal → Completion → Active Lease |
| Valuations | Received → Conflict Check → Inspection → Draft → Review → Issued |
| ESG | Instruction → Baseline → Analysis → Report → Implementation |
| Building Consult | Instruction → Desktop Review → Inspection → Draft → Review → Issued |
| Development | Appraisal → Planning → Design → Procurement → Construction → Completion |
| Capital Advisory | Instruction → Borrower Pack → Lender Longlist → Term Sheets → Negotiation → Credit Approval → Drawdown → Monitoring |
| Property Mgmt | Proposal → Onboarding → Active Management → Renewal / Exit |
| Investor Advisory | Instruction → Analysis → Strategy → Recommendations → Implementation → Review |
| Workplace | Instruction → Data Collection → Analysis → Recommendations → Implementation → POE |

Phase 3 explicitly introduces *"new Layer 5 solutions for Occupier Strategy and
Valuations **with their own BPFs**"*.

## Rule authoring governance

Two fields exist purely for governance and are worth insisting on:

- `kf_approvedby` — *"Business owner who approved the rule"*
- `kf_effectivefrom` / `kf_effectiveto` — dated validity

Combined with `kf_layer` and `kf_region`, this means a gate can be introduced in a
jurisdiction on a date without a deployment. Regional compliance can therefore ship
its own gates (Layer 6 France, Layer 7 EIT) independently of the core releases.
