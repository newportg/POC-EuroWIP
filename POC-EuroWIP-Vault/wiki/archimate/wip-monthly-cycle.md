---
type: diagram
area: wip
view: Business Process
status: draft
source: wiki/wip-period-locking-and-aging.md, wiki/wip-automation-requirements.md
extracted: 2026-09-28
---

# WIP — Monthly Cycle

The discipline mechanism that replaces the SharePoint spreadsheet. The spreadsheet
was self-enforcing — you had to open the right month's tab. These flows have to
supply that pressure externally.

Supports [[wip-period-locking-and-aging]] and [[wip-automation-requirements]].

```plantuml
@startuml
' ArchiMate elements are declared directly, with the layer stereotype and colour
' on each element, rather than pulled from the ArchiMate stdlib. This diagram
' therefore renders on any PlantUML server, including hosts where that stdlib
' is not installed.

title WIP Monthly Cycle — Business Process (ArchiMate)

top to bottom direction

rectangle "Reporting month open\nkf_reportingmonth = 1st of month\nreplaces spreadsheet tabs" as openmonth <<Business Object>> #A9DCDF
rectangle "Trade the month\ncreate WIP lines\nupdate probability" as trade <<Business Process>> #A9DCDF
circle "Month end" as me <<Business Event>> #A9DCDF
rectangle "Reconcile and report\nPower BI aging + receivables" as reconcile <<Business Process>> #A9DCDF
circle "15th of following month" as l15 <<Business Event>> #A9DCDF
rectangle "FL-4\nLock the period\nkf_periodlocked = Yes" as fl4 <<Business Process>> #A9DCDF
rectangle "kf_lockedby\nkf_lockedon" as lockrec <<Business Object>> #A9DCDF
rectangle "PL-4\nReject edits to locked fields" as pl4 <<Business Process>> #A9DCDF

circle "Each week" as tick <<Business Event>> #A9DCDF
rectangle "FL-1\nStale WIP alert\nto Finance Admin" as fl1 <<Business Process>> #A9DCDF
circle "kf_isstale = Yes\nwipstatus = WIP\nAND today > staledate" as stale <<Business Event>> #A9DCDF
rectangle "Re-forecast or close out\ncompletionmonth / status / probability" as remedy <<Business Process>> #A9DCDF

circle "Each month" as mtick <<Business Event>> #A9DCDF
rectangle "FL-6\nWIP update reminder" as fl6 <<Business Process>> #A9DCDF

circle "Status → Billed" as gamedet <<Business Event>> #A9DCDF
rectangle "FL-5\nProbability gaming alert\nBilled from <30%" as fl5 <<Business Process>> #A9DCDF
rectangle "Finance review" as fix <<Business Process>> #A9DCDF

rectangle "kf_staledate\ncompletionmonth + 30 days" as staledate <<Business Object>> #A9DCDF

openmonth --> trade
trade --> me
me --> reconcile
reconcile --> l15
l15 --> fl4
fl4 --> lockrec
fl4 --> pl4

tick --> fl1
staledate --> fl1
fl1 --> stale
stale --> remedy
remedy --> trade

mtick --> fl6
fl6 --> trade

gamedet --> fl5
fl5 --> fix
fix --> reconcile

stale ..> lockrec : "may fall inside\na locked period"
reconcile ..> trade : "next month"

note right of stale
  <b>Two clocks.</b>
  --
  FL-4 locks the period on the
  15th of the following month.
  --
  kf_staledate fires at
  completionmonth + 30 days.
  --
  A line with a 1 Aug
  completion month goes stale
  on 31 Aug, but August locks
  on 15 Sep. Between those
  dates it is both stale and
  locked.
  --
  If PL-4 freezes kf_wipstatus
  or kf_probability, the only
  remedy for a stale line is
  blocked.
  --
  <b>Q6 — needs a decision.</b>
end note

note bottom of fl4
  Lock is attributable, so it
  is presumably overridable —
  but by whom, and whether
  unlocking is logged, is not
  stated. <b>Q5.</b>
end note

note left of fl5
  Needs PL-3 to have captured
  kf_previousprobability
  before the change. No
  pre-image, no baseline.
end note

@enduml
```

## The three cadences

| Cadence | ID | Trigger | Target |
| --- | --- | --- | --- |
| Weekly | FL-1 | Schedule | Finance Admin, on `kf_isstale` |
| Monthly | FL-4 | 15th of following month | Sets `kf_periodlocked` |
| Monthly | FL-6 | Schedule | Negotiators |
| On event | FL-5 | Status → Billed | Finance review |
| On event | PL-4 | Any write | Rejects locked-field edits |

## Why FL-1 and FL-6 are both needed

FL-1 is an **alert** — it tells finance a line has overrun its own forecast by more
than 30 days. FL-6 is a **reminder** — it tells the negotiator to update. The
spreadsheet achieved both at once because the tab changed. Now they are separate
flows pointing at different people, which is why both are specified.

## The unresolved collision

This is the diagram's real content. FL-4 and `kf_staledate` run on different clocks
and the source never reconciles them. Three ways out, none chosen:

1. Exclude `kf_completionmonth` from the locked field set, so a stale line can be
   re-forecast.
2. Allow status and probability edits on stale lines even in a locked period.
3. Move the lock to align with the staleness threshold.

Q6 in [[wip-open-questions]]. It needs a finance answer, not a modelling one.

---

Related: [[wip-archimate-index]] · [[wip-lifecycle]] · [[wip-reporting-and-kpis]]
