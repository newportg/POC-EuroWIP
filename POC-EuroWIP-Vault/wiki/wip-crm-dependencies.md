---
type: spec
area: crm-dependency
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# CRM Dependencies for the WIP Project

CRM is **not** the focus of the WIP project, but WIP cannot function without it.
This note records only what WIP actually consumes. Everything else in the CRM
data model — deal lifecycle, KYC, data rooms, investor profiles, taxonomies — is
out of scope.

## Hard dependencies — WIP breaks without these

### 1. `Account` hierarchy (Brand/Group → Legal Entity)

WIP inherits the two-account split from [[wip-instruction-model]]:

- `kf_WIP.kf_clientaccountid` — auto-populated from the Instruction's Brand/Group
  account
- `kf_Instruction.kf_legalentityaccountid` — the invoicing entity, filtered

Fields WIP depends on:

| Field | Why WIP needs it |
| --- | --- |
| `kf_accountclassification` | Choice: Brand/Group \| Legal Entity \| Individual. Drives filtered lookup F5 and the fee roll-up |
| `parentaccountid` | Self-referential. Brand/Group at top, Legal Entity below, Individual standalone |
| `kf_ultimateparentname` | Auto-populated top-level Brand/Group name — the WIP fee roll-up dimension |
| `kf_registrationnumber` | *"Underpins KYC and invoicing"* — SIREN/SIRET (FR), HRB (DE), Registro Mercantil (ES), KRS (PL) |
| `kf_entitytype` | Fund / SPV / JV / Holding Company / Operating Company / Trust / Other |
| `kf_jurisdictionofincorporation` | AML regime and VAT context |
| `owningbusinessunit` | Security scoping and BU-based defaults |

The Brand/Group → Legal Entity pattern:

- **Brand/Group** accounts sit at the top, `parentaccountid` = null
- **Legal Entity** accounts are children, `parentaccountid` → Brand/Group
- **Individual** accounts are standalone, no parent

Filtered lookup F5: `kf_Instruction.kf_legalentityaccountid` →
`kf_accountclassification = Legal Entity` → *"Invoice entity must be Legal Entity"*.

### 2. `kf_Property` and `kf_Site`

WIP carries `kf_propertyid` (optional, single property). Portfolio work reaches
multiple properties via `kf_Instruction → kf_DealProperty → kf_Property`.

| WIP-relevant field | Notes |
| --- | --- |
| `kf_Property.kf_propertyname` | Required |
| `kf_Property.kf_sector` | Choice — inherited onto `kf_WIP.kf_sector` by PL-2, which is what makes sector-level fee reporting possible |
| `kf_Property.kf_propertystatus` | Available / Under Offer / Let / Sold / Withdrawn / Off Market — **Required** |
| `kf_Property.kf_propertyid` → `kf_Site` | Canonical physical building record; Loqate-verified address |
| `kf_DealProperty` | Universal junction, retired `kf_MandateProperty`, decision 26/08/2026 |

`sector` matters more to WIP than the rest of the property record, because it is one
of four dimensions denormalised onto every WIP line for flat reporting.

### 3. `kf_DealProperty` — the universal property junction

Base at Layer 2, extended at Layer 5 by CM (`kf_dealid`) and PM
(`kf_propertymandateid`). Full spec in [[wip-instruction-model]].

### 4. `kf_StageGateRule`, `kf_IntegrationLog`, `kf_AuditExport`

Supporting infrastructure. Full detail in [[wip-stage-gates]] and
[[wip-reporting-and-kpis]].

## Soft dependencies — needed for Phase 1, not for the WIP table to exist

### `kf_FeeSchedule` (Capital Markets, Layer 5)

WIP's `kf_feescheduleid` is **optional** and `kf_FeeSchedule` is CM-only. Fee basis
for the other eleven service lines is keyed directly onto `kf_WIP.kf_grossfee` /
`kf_netfeetogroup` / `kf_officeretained`.

Relevant because `kf_triggerpoint` supports **Monthly / Quarterly**, implying
recurring WIP lines — see [[wip-finance-erp-integration]].

### `kf_Deal` (Capital Markets, Layer 5)

Reached only via `kf_Instruction.kf_dealid` (1:1). WIP never references a Deal
directly. Two Deal fields matter to WIP indirectly:

- `kf_legalentityaccountid` — *"the entity on the NDA, fee letter, and invoice"*,
  required before Mandate stage S3
- `kf_dealstatus` — drives the FL-2/FL-3 loss cascade

### Business unit / owning office

`kf_owningoffice` is inherited from the Instruction and drives:

- VAT default (FR = 20, ES = 21, UK = 20)
- ERP local system default (Paris GL / Madrid Accounting / SAP / Other)
- Security row-level scoping
- Period-lock attribution

## Explicitly out of scope for WIP

| CRM area | Why excluded |
| --- | --- |
| 8-stage CM BPF and its gates | Process validation on the Deal, not on WIP operations |
| `kf_Pitch`, `kf_NDA`, `kf_Bid`, `kf_DDMilestone`, `kf_RedFlag` | Deal process records |
| `kf_KYCRecord`, `kf_DataRoomAccess` | Compliance process, gated before Mandate |
| `kf_InvestorProfile`, `kf_DealInvestorTarget` | Relationship intelligence |
| `kf_TransactionReport` | Post-completion reporting |
| `kf_GDPRRequest` | Compliance, deployed Phase 0 but unrelated to WIP |
| Lead and Customer Insights journeys | Marketing |
| `kf_EnergyRating`, `kf_SICCode`, HILUCS taxonomy | Classification — see [[wip-taxonomy-inputs]] |
| Duplicate detection D1–D3 (Account level) | Account hygiene, distinct from WIP's DD-1 |
| `kf_ResProperty` and the residential chain | Phase 4 |

## The one CRM thing WIP must get right

PL-2 must correctly denormalise `kf_serviceline`, `kf_sector`, `kf_clientaccountid`,
`kf_negotiatorid`, `kf_owningoffice` and `transactioncurrencyid` onto every WIP
record at create. That single requirement is the whole reason the WIP table carries
duplicated CRM data. If PL-2 is wrong, WIP reporting silently diverges from the CRM
of record with no error surfaced — because the denormalised values are Auto and
read-only.
