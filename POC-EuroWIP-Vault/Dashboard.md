# Dashboard (Initial Screen) — EuroWIP

Requirements extracted from `raw/EU CRM Data Model.xlsx` (26/08/2026). WIP focus;
CRM treated as dependency only.

Start at [[wip-project-overview]].

## Progress by phase

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed
GROUP BY phase
SORT key ASC
```

## Progress by stream

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed
GROUP BY stream
SORT key ASC
```

## Blocking decisions

Six decisions gate the build. Full detail in [[wip-open-questions]].

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed AND blocking
SORT file.name ASC
```

## All open decisions

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed AND stream = "decisions"
SORT file.name ASC
```

## All open tasks

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed
SORT file.name ASC
```

## Definition of done

```dataview
TASK
FROM "wiki/wip-delivery-backlog"
WHERE !completed AND stream = "done"
SORT file.name ASC
```

## Wiki index

```dataview
TABLE area, status, file.mtime AS "Updated"
FROM "wiki"
WHERE type = "spec" OR type = "open-questions" OR type = "backlog" OR type = "diagram"
SORT file.name ASC
```

## Open questions by impact

14 unresolved items. Two are **blocking**.

| # | Question | Impact |
| --- | --- | --- |
| Q1 | Which `kf_WIP` definition is authoritative, and where does `kf_fin_localsystemref` live? | Blocking |
| Q2 | PL-1, PL-2, FL-2, FL-3 assume a 13-lookup parent model that no longer exists | Blocking |
| Q3 | Two incompatible `kf_Instruction` specs; WIP denormalisation sources unconfirmed | High |
| Q4 | MVP activation list omits both finance tables | High |
| Q5 | Which fields does the period lock freeze? Unlock rights? | High |
| Q6 | FL-4 period lock and `kf_staledate` can conflict | High |
| Q7 | Four KPIs reference fields that do not exist | Medium |
| Q8 | Four tables each have two column definitions | Medium |
| Q9 | Can stage gates target WIP tables? | Medium |
| Q10 | The nine Phase 7 integration flows are not enumerated | Medium |
| Q11 | Service line choice set (14) does not match the service line sheets (12) | Medium |
| Q12 | `kf_parenttype` purpose unresolvable | Low |
| Q13 | The SharePoint cutover has no migration plan | Risk |
| Q14 | `kf_grossfee` derivation from `kf_FeeSchedule` not specified | Low |

Full detail, including the conflicting definitions side by side, is in
[[wip-open-questions]].

---

> [!example]- Legacy dashboard queries (pre-existing, empty)
> These were on the Dashboard before the WIP extraction. They point at `bugs`,
> `specs` and `decisions` folders that do not exist in this vault, so they render
> empty. Kept for reference — delete if not wanted.
>
> ```dataview
> TABLE status, file.mtime as "Last updated" FROM "bugs" WHERE status = "open" SORT file.mtime DESC
> ```
>
> ```dataview
> TABLE status FROM "specs" WHERE status != "done"
> ```
>
> ```dataview
> TABLE file.mday as "Date" FROM "decisions" SORT file.mday DESC LIMIT 5
> ```
