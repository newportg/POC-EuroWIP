---
type: diagram
area: wip
view: System Landscape
status: draft
source: wiki/wip-rollout-plan.md, wiki/wip-finance-erp-integration.md
extracted: 2026-09-28
---

# WIP — System Landscape

What the WIP project actually touches, and — more importantly — what it does not
touch yet. The gap between the finance tables and the finance systems is the whole
story of Phases 0 to 7.

Supports [[wip-rollout-plan]] and [[wip-finance-erp-integration]].

```plantuml
@startuml
' ArchiMate elements are declared directly, with the layer stereotype and colour
' on each element, rather than pulled from the ArchiMate stdlib. This diagram
' therefore renders on any PlantUML server, including hosts where that stdlib
' is not installed.

title WIP System Landscape (ArchiMate)

rectangle "Dataverse\nKF CRM environment\nLayers 2 to 7" as dv <<Node>> #8AA6C8

package "In scope — Phase 0 / 1" as NOW {
  rectangle "kf_WIP + kf_Instruction\nWIP & billing tracker" as wipc <<Application Component>> #ADD8E6
  rectangle "Account hierarchy\nBrand/Group → Legal Entity" as acctc <<Application Component>> #ADD8E6
  rectangle "BusinessUnit\nVAT + ledger defaults" as bu <<Application Component>> #ADD8E6
  rectangle "Power BI\nsemantic model" as pbi <<Application Component>> #ADD8E6
  rectangle "kf_AuditExport\nmonthly BI feed" as audit <<Application Service>> #ADD8E6
  rectangle "Paris GL\nlocal ledger\nKEYED BY HAND" as paris <<System Software>> #8AA6C8
}

package "Retiring — hard cutover Phase 1" as OLD {
  rectangle "SharePoint\nWIP & Billed template" as sp <<System Software>> #8AA6C8
}

package "Deferred — Phase 2" as P2 {
  rectangle "Madrid Accounting\nlocal ledger" as madrid <<System Software>> #8AA6C8
}

package "Deferred — Phase 7" as P7 {
  rectangle "Consolidated\nFinance ERP" as sap <<System Software>> #8AA6C8
}

package "CRM-side, not WIP scope" as CRMSIDE {
  rectangle "Loqate\naddress verification" as loq <<System Software>> #8AA6C8
  rectangle "World-Check /\nComplyAdvantage" as kyc <<System Software>> #8AA6C8
  rectangle "Hub\nPhase 6 API replacement" as hub <<Application Service>> #ADD8E6
}

dv ..> wipc : ""
dv ..> acctc : ""
dv ..> bu : ""
dv ..> pbi : ""
audit ..> pbi : "feeds"

wipc ..> sp : "REPLACES\nwrite access revoked\non go-live day"
sp ..> wipc : "historical data\nmigrated at cutover"

wipc ..> paris : "kf_fin_localsystemref\nMANUAL from Phase 1"
wipc ..> madrid : "from Phase 2\nMANUAL"
wipc ..> sap : "Phase 7\n9 integration flows"
bu ..> paris : "auto-default\nfrom BU"
bu ..> madrid : "auto-default\nfrom BU"

acctc ..> wipc : "kf_clientaccountid"
bu ..> wipc : "kf_owningoffice\nVAT default"

loq ..> dv : "site / address"
kyc ..> dv : "screening"
hub ..> dv : "deal source\nPhase 6"

note top of sp
  <b>Hard cutover.</b>
  Remove SharePoint write
  access on go-live day.
  --
  No migration scope, volumes,
  owner, date or reconciliation
  approach is given anywhere
  in the source. <b>Q13.</b>
end note

note bottom of sap
  Phase 7 is described only as
  "activates 9 integration
  flows". The nine flows are
  not enumerated anywhere.
  <b>Q10.</b>
  --
  Until then, invoice number,
  due date, date paid and the
  ERP cross-reference are keyed
  by hand.
end note

note right of pbi
  kf_WIP and kf_Instruction are
  <b>absent</b> from the documented
  semantic model table list,
  yet the aging and receivables
  KPIs are defined against
  kf_Deal.kf_fin_* fields that
  do not exist. <b>Q7.</b>
end note

note left of wipc
  Account sync to D365 Finance
  CustTable is explicitly
  "deferred to future phases".
  No bidirectional customer
  sync in Phase 0/1.
end note

legend right
  |= Phase |= Status |
  | 0–1 | In scope, ERP refs keyed by hand |
  | 1 | Paris GL ledger · SharePoint cutover |
  | 2 | Madrid ledger |
  | 6 | Hub API |
  | 7 | Consolidated ERP integration |
end legend

@enduml
```

## What this makes obvious

**WIP ships before it is integrated.** The table is live in Phase 0, Paris deals
bill from Phase 1, and the consolidated ERP does not arrive until Phase 7. The
`kf_fin_*` fields exist from day one precisely so the interim join key is already in
place when the integration lands.

**The cutover is the only irreversible item.** Everything else can be deferred,
re-scoped or re-run. Revoking SharePoint write access on go-live day cannot, which
makes the unmigrated-data risk the single largest unowned risk in the WIP scope.

**The reporting layer is currently unowned.** `kf_WIP` and `kf_Instruction` are not
in the semantic model, and two of the seven standard KPIs point at fields that do not
exist. WIP reporting is specified but assigned to nobody.

## Out of the WIP lane

Loqate, KYC screening and the Hub are shown for context only. They touch the CRM
tables, never `kf_WIP` or `kf_Instruction`. See [[wip-crm-dependencies]] for exactly
what WIP consumes.

---

Related: [[wip-archimate-index]] · [[wip-application-composition]] · [[wip-rollout-plan]]
