---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Period Locking, Reporting Month and Ageing

This is the requirement set that replaces the mechanics of the SharePoint "WIP &
Billed" template. It governs *when* a WIP number becomes final.

## Reporting month

| Column | Type | Rule |
| --- | --- | --- |
| `kf_reportingmonth` | Date | **Required.** 1st of month. *Replaces spreadsheet monthly tabs.* |

The spreadsheet's structure was: one tab per month, users typed into the current
month's tab. The Dataverse equivalent is a date column. Every WIP line carries the
month it was reported in, and that month is what determines when it locks.

- **Required** on the record — this is the one non-conditional required date.
- Set to the 1st of the month (no day component), so it groups cleanly.
- Stored per record, not per view, so history is preserved without a new tab per
  period.

## Stale detection

| Column | Type | Rule |
| --- | --- | --- |
| `kf_staledate` | Date | **Calculated:** `completionmonth + 30 days` |
| `kf_isstale` | Yes/No | **Calculated:** `kf_wipstatus = WIP AND today > kf_staledate` |

Both are calculated fields, not user input. The logic:

1. Take the expected completion month.
2. Add 30 days — the grace period.
3. If the line is **still** `WIP` past that date, it is stale.

FL-1 fires weekly on `kf_isstale` to alert the Finance Admin.

### Reading the rule

The 30-day threshold is the only explicit tolerance in the WIP spec. It applies from
`kf_completionmonth`, which is the *expected* completion month — so a line is flagged
when it has overrun its own forecast by more than a month, not when it has been open
for a month. A deal with a completion month six months out is never stale.

## Period lock

| Column | Type | Rule |
| --- | --- | --- |
| `kf_periodlocked` | Yes/No | Auto — set by monthly scheduled flow |
| `kf_lockedby` | Lookup → SystemUser | User who locked the period |
| `kf_lockedon` | DateTime | Lock timestamp |

Enforcement is two-sided:

- **PL-4** (plugin) — *"Enforce period lock — reject edits to locked fields"*.
  Platform-level rejection.
- **BR — period lock enforcement** (business rule) — form-level counterpart.

The plugin must reject, not merely warn, or API writes and flow updates will bypass
it.

### The lock schedule

**FL-4** — *"Monthly period lock (15th of the following month)"*.

So the month of August 2026 locks on **15 September 2026**. The 15th is a deliberate
buffer: it gives finance roughly two weeks to reconcile the month before the numbers
are frozen, while still closing before the following month's reporting cycle begins.

### What "locked" means

> [!warning] Under-specified
> The source does not state **which fields** are locked. Reasonable reading is the
> financial and status set — `kf_grossfee`, `kf_netfeetogroup`, `kf_officeretained`,
> `kf_weightedofficeretained`, `kf_probability`, `kf_vatpercent`, `kf_wipstatus`,
> `kf_reportingmonth`, and the invoice fields — but this is inference. Logged in
> [[wip-open-questions]].

It is also not stated whether the lock is reversible, or who may unlock. Given
`kf_lockedby` and `kf_lockedon` are captured, the lock is clearly attributable and
therefore presumably overridable by an admin — but by whom, and whether unlocking is
logged elsewhere, is unstated.

### Interaction with stale detection — open

FL-4 locks on the 15th of the following month. `kf_staledate` is
`completionmonth + 30 days`. These two clocks can conflict:

- A line with `completionmonth` = 1 August goes stale on 31 August.
- The August period locks on 15 September.
- Between 15 and 30 September the line is **both stale and in a locked period**.

If the lock covers `kf_wipstatus` and `kf_probability`, the remediation for a stale
line (update or re-forecast it) is blocked. The source does not resolve this. This
needs a decision before build — see [[wip-open-questions]].

## Governance fields

| Column | Type | Rule |
| --- | --- | --- |
| `kf_owningoffice` | Lookup → BusinessUnit | Auto — inherited from parent Instruction |
| `kf_comments` | Multi-line Text (2000) | General comments |

`kf_owningoffice` is inherited from the Instruction and drives the VAT default
(FR/ES/UK), the ERP local system default, and security row-level scoping. It is
therefore load-bearing for period locking, not just a reporting dimension.

## Pipeline value

| Column | Type | Rule |
| --- | --- | --- |
| `kf_probability` | Decimal | 0–100, user input while `WIP` |
| `kf_weightedofficeretained` | Currency | **Calculated:** `officeretained × probability / 100` |
| `kf_previousprobability` | Decimal | Auto — set by PL-3 on every change |

Weighted office retained is the WIP pipeline value. Business rule *"probability
lock"* stops probability moving once status leaves `WIP`, and PL-3's pre-image
capture plus FL-5 (Billed from <30%) together detect someone who parked a line at a
low probability and then billed it.

## Summary of the monthly cycle

| When | What | Owner |
| --- | --- | --- |
| Throughout month | WIP lines created, probabilities updated | Negotiators |
| Month end | Reporting month closed off; lines expected to complete | Finance + negotiators |
| 15th of following month | **Period locked** (FL-4) | Automated |
| Weekly | Stale alerts raised (FL-1) | Finance Admin |
| Monthly | WIP update reminder (FL-6) | Automated |
| Ongoing | Aging reported in Power BI (see [[wip-reporting-and-kpis]]) | Finance |
