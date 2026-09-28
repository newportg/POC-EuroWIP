---
type: diagram
area: wip
view: Application Composition
status: draft
source: wiki/wip-table-specification.md, wiki/wip-instruction-model.md
extracted: 2026-09-28
---

# WIP — Application Composition

The data model behind the WIP project. Shows the rule that matters most:
**`kf_WIP` has no service-line lookups.** All service-line context is reached
through `kf_Instruction`.

Supports [[wip-table-specification]] and [[wip-instruction-model]].

```plantuml
@startuml
' ArchiMate elements are declared directly, with the layer stereotype and colour
' on each element, rather than pulled from the ArchiMate stdlib. This diagram
' therefore renders on any PlantUML server, including hosts where that stdlib
' is not installed.

title WIP Data Model — Application Composition (ArchiMate)

package "Finance layer — Layer 2, KF_Global_Core" as FIN {
  rectangle "kf_Instruction\nMandate / Engagement Master" as instr <<Application Component>> #ADD8E6
  rectangle "kf_WIP\nShared WIP & Billing Tracker" as wip <<Application Component>> #ADD8E6
  rectangle "kf_IntegrationLog" as ilog <<Application Component>> #ADD8E6
}

package "Shared core — Layer 2" as CORE {
  rectangle "Account\nBrand/Group + Legal Entity" as acct <<Application Component>> #ADD8E6
  rectangle "kf_DealProperty\nuniversal property junction" as le <<Application Component>> #ADD8E6
  rectangle "kf_Property" as prop <<Application Component>> #ADD8E6
  rectangle "kf_Site" as site <<Application Component>> #ADD8E6
  rectangle "BusinessUnit" as bu <<Application Component>> #ADD8E6
}

package "Capital Markets — Layer 5, Phase 1" as CM {
  rectangle "kf_Deal" as deal <<Application Component>> #ADD8E6
  rectangle "kf_FeeSchedule" as fee <<Application Component>> #ADD8E6
}

package "Other 11 service lines — Phase 3+" as SL {
  rectangle "kf_Engagement\nOSS" as eng <<Application Component>> #ADD8E6
  rectangle "kf_ValuationInstruction\nValuations" as val <<Application Component>> #ADD8E6
  rectangle "kf_Lease\nLeasing" as lease <<Application Component>> #ADD8E6
  rectangle "kf_PropertyMandate\nProperty Mgmt" as pm <<Application Component>> #ADD8E6
  rectangle "8 further parent tables\nDevelopment · Capital Advisory\nBuilding Consult · Workplace\nInvestor Advisory · Residential\nSales + Lettings · ESG" as rest <<Application Component>> #ADD8E6
}

package "Automation touching kf_WIP" as AUTO {
  rectangle "PL-2\ndenormalise on create" as pl2 <<Application Function>> #ADD8E6
  rectangle "PL-4\nenforce period lock" as pl4 <<Application Function>> #ADD8E6
  rectangle "FL-4\nlock on 15th" as fl4 <<Application Function>> #ADD8E6
  rectangle "FL-1\nweekly stale alert" as fl1 <<Application Function>> #ADD8E6
}

instr "1" -- "0..*" wip : "kf_instructionid\nTHE ONLY\nservice-line path"
instr "1" -- "0..1" deal : "kf_dealid"
instr "1" -- "0..1" eng : "kf_engagementid"
instr "1" -- "0..1" val : "kf_valuationinstructionid"
instr "1" -- "0..1" lease : "kf_leaseid"
instr "1" -- "0..1" pm : "kf_propertymandateid"
instr "1" -- "0..1" rest : "8 more lookups"
instr "1" -- "0..*" le : "universal parent"
instr "1" -- "0..*" acct : "kf_clientaccountid\nkf_legalentityaccountid"

wip "0..*" -- "0..1" fee : "kf_feescheduleid\noptional"
wip "0..*" -- "0..1" acct : "kf_clientaccountid\nauto"
wip "0..*" -- "0..1" bu : "kf_owningoffice\nauto"
wip "0..*" -- "0..1" prop : "kf_propertyid"
'  no kf_DealProperty lookup on kf_WIP -- reached via kf_Instruction

le "0..*" -- "0..1" prop : ""
prop "0..*" -- "0..1" site : "kf_siteid"
deal "1" -- "0..*" le : "CM extension"

pl2 ..> wip : "kf_serviceline · kf_sector\nkf_clientaccountid\nkf_negotiatorid"
fl4 ..> pl4 : ""
pl4 ..> wip : "reject edits"
fl1 ..> wip : "read kf_isstale"
pl2 ..> ilog : ""
fl4 ..> ilog : ""

note right of wip
  <b>Only 5 relationships.</b>
  kf_WIP reaches the rest of
  the model through
  kf_Instruction. Adding a
  service line is a one-column
  change on kf_Instruction,
  never a change here.
end note

note bottom of le
  Replaces the retired
  kf_MandateProperty
  (decision 26/08/2026).
  Base at Layer 2; CM and PM
  extend it at Layer 5.
end note

legend right
  |= Layer |= Elements |
  | Application | Data model, automation |
  | Phase 1 | Paris Capital Markets live |
  | Phase 3+ | Remaining service lines |
end legend

@enduml
```

## Reading it

- **The single path.** `kf_Instruction → kf_WIP` is the only route to a
  service-line record. Everything on the right of the diagram hangs off
  `kf_Instruction`, not off `kf_WIP`.
- **Denormalisation.** `kf_clientaccountid`, `kf_owningoffice`, `kf_serviceline`,
  `kf_sector` and `kf_negotiatorid` are copied onto WIP by PL-2 so finance can
  report without joins. If PL-2 is wrong, WIP reporting diverges from the CRM of
  record silently — the fields are auto and read-only.
- **Property reach.** `kf_WIP.kf_propertyid` holds one property. Portfolio work goes
  `kf_Instruction → kf_DealProperty → kf_Property`. Fee granularity is the
  Instruction; the property link is presentational.
- **Optional fee link.** `kf_feescheduleid` is optional and `kf_FeeSchedule` is
  Capital Markets only, so the other eleven service lines key fee amounts directly.

## Known gaps visible here

- No element carries the ERP cross-reference. Q1 in [[wip-open-questions]] — the
  authoritative `kf_WIP` definition drops `kf_fin_localsystemref`, yet the
  required-at-Billed rule needs it.
- The service-line grouping is 13 lookups, but the reporting choice set
  `kf_globalchoice_serviceline` has 14 values that do not match the 12 sheets
  (Q11).

---

Related: [[wip-archimate-index]] · [[wip-lifecycle]] · [[wip-system-landscape]]
