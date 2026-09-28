---
type: diagram
area: wip
view: Business Flow
status: draft
source: wiki/wip-table-specification.md, wiki/wip-automation-requirements.md
extracted: 2026-09-28
---

# WIP — Lifecycle

The `kf_wipstatus` choice set: **WIP → Billed → Paid**, with **Lost** reachable
from either side. Each transition carries a mandatory field set — that is the whole
of the billing control.

Supports [[wip-table-specification]] and [[wip-automation-requirements]].

```plantuml
@startuml
' ArchiMate elements are declared directly, with the layer stereotype and colour
' on each element, rather than pulled from the ArchiMate stdlib. This diagram
' therefore renders on any PlantUML server, including hosts where that stdlib
' is not installed.

title kf_WIP Lifecycle — Business Flow (ArchiMate)

left to right direction

circle "Mandate signed\nkf_Instruction\nkf_signeddate" as signed <<Business Event>> #A9DCDF
rectangle "Create WIP line\nPL-2 auto-populates\nclassification" as create <<Business Process>> #A9DCDF
rectangle "kf_WIP record\nWIP-{SEQNUM:6}\nkf_reportingmonth required" as rec <<Business Object>> #A9DCDF

circle "Status = WIP" as wip <<Business Event>> #A9DCDF
rectangle "Accrue\nprobability · fee · VAT\nofficeretained" as accrue <<Business Process>> #A9DCDF
rectangle "kf_weightedofficeretained\n= officeretained\n× probability / 100" as weighted <<Business Object>> #A9DCDF

circle "Status = Billed\nInvoice issued" as billed <<Business Event>> #A9DCDF
rectangle "kf_invoicenumber\nkf_invoiceduedate\nkf_fin_localsystemref" as inv <<Business Object>> #A9DCDF
circle "Status = Paid" as paid <<Business Event>> #A9DCDF
rectangle "kf_datepaidinfull" as settle <<Business Object>> #A9DCDF
circle "Status = Lost" as lost <<Business Event>> #A9DCDF

rectangle "FL-2 / FL-3\nCascade from parent\nInstruction" as cascade <<Business Process>> #A9DCDF
rectangle "FL-5\nProbability gaming alert\nBilled from <30%" as gaming <<Business Process>> #A9DCDF
circle "Period locked\nFL-4 · 15th of\nfollowing month" as lock <<Business Event>> #A9DCDF

signed --> create
create --> rec
rec --> wip
wip --> accrue
accrue --> weighted
weighted --> billed : "BR probability lock"
billed --> paid : "payment received"
billed --> lost : "cancelled post-invoice"
wip --> lost : "work abandoned"

inv ..> billed : ""
settle ..> paid : ""

rec --> cascade : "parent Lost"
cascade --> lost

billed --> gaming
weighted --> gaming
gaming ..> rec : "flag"

lock ..> rec : "PL-4 rejects\nlocked-field edits"

note right of billed
  <b>Required at Billed</b>
  · kf_invoicenumber
  · kf_invoiceduedate
  · kf_fin_localsystemref
  --
  <b>Required at Paid</b>
  · kf_datepaidinfull
  --
  <b>Lost</b> — no invoice
  fields required
end note

note bottom of lock
  FL-4 locks on the 15th of
  the month following the
  reporting month. PL-4 then
  rejects edits to locked
  fields at platform level.
  --
  <b>Open conflict (Q6):</b>
  kf_staledate fires at
  completionmonth + 30 days,
  which can fall inside a
  locked period.
end note

note bottom of gaming
  Depends on PL-3 capturing
  kf_previousprobability on
  every change. Without the
  pre-image there is no
  baseline to detect against.
end note

@enduml
```

## The ladder

| From | Event | Mandatory fields | Automation |
| --- | --- | --- | --- |
| — | Mandate signed | `kf_Instruction.kf_signeddate`, active status | PL-1, PL-2 |
| WIP | Invoice issued | `kf_invoicenumber`, `kf_invoiceduedate`, `kf_fin_localsystemref` | BR invoice field requirements, BR probability lock |
| Billed | Payment received | `kf_datepaidinfull` | — |
| WIP or Billed | Parent lost / withdrawn | none | FL-2, FL-3 cascade |
| any | Period lock | — | FL-4, PL-4 |

`kf_invoicenumber` is required at **both** Billed and Paid — it is never cleared once
set.

## The control that protects it

FL-5 flags any line billed from a probability below 30%. That is the only quantified
control threshold in the whole WIP specification, and it exists because
`kf_weightedofficeretained` is the pipeline figure finance reports on. Billing a line
that was parked at a low probability inflates nothing but conceals a deal that was
never probable.

## Blocking gap

The **Billed** transition is the one that breaks. The authoritative `kf_WIP`
definition has no `kf_fin_localsystemref` field, so the required-at-Billed rule has
nowhere to write. This is Q1 in [[wip-open-questions]] and it must be settled before
this flow can be implemented.

---

Related: [[wip-archimate-index]] · [[wip-application-composition]] · [[wip-monthly-cycle]]
