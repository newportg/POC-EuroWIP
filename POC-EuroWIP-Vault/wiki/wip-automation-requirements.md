---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Automation Requirements

Source: `EU CRM Data Model.xlsx` → **"15. Marketing & Support"**, section
**"AUTOMATION & LOGIC: kf_WIP"** — *"Plugins, Flows, and Business Rules for `kf_WIP`
management"*.

This is a complete, numbered catalogue. All four groups are in scope for the WIP
project.

## Plugins (PL)

| ID | Purpose |
| --- | --- |
| PL-1 | Validate exactly 1 parent lookup populated; auto-set `kf_parenttype` |
| PL-2 | Auto-populate classification fields from parent on create |
| PL-3 | Track probability changes; set `kf_previousprobability` |
| PL-4 | Enforce period lock — reject edits to locked fields |

### PL-1 — parent validation

Under the current Core Shared Tables design `kf_WIP` has exactly one parent
(`kf_instructionid`), so PL-1 collapses to: *require `kf_instructionid`; set
`kf_parenttype = Instruction`*. The wording "exactly 1 parent lookup populated" is
left over from the 13-lookup design. The rules that matter in practice are now on
`kf_Instruction` instead: *"Exactly one populated per record, determined by
`kf_serviceline`."* See [[wip-open-questions]].

### PL-2 — classification denormalisation

Auto-populate on create, from the parent Instruction: `kf_serviceline`,
`kf_sector`, `kf_clientaccountid`, `kf_negotiatorid`, `kf_owningoffice`,
`kf_transactiontype`, and the transaction currency. This is what makes flat finance
reporting possible without joins. Note `kf_instructionid` itself must exist before
PL-2 can run — requires creating the Instruction first, then creating the WIP record. Create Instruction before Create WIP.

### PL-3 — probability change tracking

Before any update to `kf_probability`, write the old value to
`kf_previousprobability`. This is a **pre-image capture** and is a precondition for
FL-5. Without it, probability-gaming detection has no baseline.

### PL-4 — period lock enforcement

Reject edits to locked fields when `kf_periodlocked = Yes`. Field-level detail
(the exact locked set) is not specified in the source — logged in
[[wip-open-questions]].

## Flows (FL)

| ID | Purpose | Cadence |
| --- | --- | --- |
| FL-1 | Weekly stale WIP alert to Finance Admin | Weekly |
| FL-2 | Cascade parent Lost → child WIP lines set to Lost | On parent status change |
| FL-3 | Same cascade for non-Deal parents | On parent status change |
| FL-4 | Monthly period lock (15th of following month) | Monthly |
| FL-5 | Probability gaming alert (Billed from <30%) | On status change |
| FL-6 | Monthly WIP update reminder | Monthly |

### FL-1 and FL-4 — the aging loop

FL-4 locks the period on the **15th of the month following** the reporting month.
FL-1 then alerts on every record where `kf_isstale` is true — i.e. still `WIP`, with
a completion month more than 30 days past. Together these are the discipline
mechanism that replaces the spreadsheet: the spreadsheet was *self-enforcing* because
you had to open the right tab; the flow has to supply that pressure externally.

Note the tension: FL-4 locks the period on the 15th, but stale detection looks at
`completionmonth + 30 days`. A WIP line can go stale after its period is locked. The
source does not define what happens then — logged in [[wip-open-questions]].

### FL-2 and FL-3 — loss cascade

When a parent Instruction is set to `Withdrawn`/Lost, all child WIP lines are set to
`Lost`. FL-2 is worded for Deal parents; FL-3 generalises to the other twelve parent
types. Both are required because `kf_Instruction` carries thirteen different parent
lookups.

### FL-5 — probability gaming

Flag any WIP line that moves to `Billed` from a probability below 30%. This is a
control against fee being recognised on work that was never genuinely probable.
Depends on PL-3 having captured `kf_previousprobability`. Threshold of 30% is the
only quantified control threshold in the whole WIP spec.

### FL-6 — update reminder

Monthly nudge to update WIP lines, counterbalancing FL-1's alert-only design.

## Business rules (BR)

Source records these as a single range, **BR-1–6**, described as:
*"Invoice field requirements, probability lock, currency warning, VAT default, period
lock enforcement"*. The individual IDs are not broken out.

| Rule | Derived requirement |
| --- | --- |
| BR — invoice field requirements | `kf_invoicenumber` at Billed/Paid; `kf_invoiceduedate` at Billed; `kf_datepaidinfull` at Paid; `kf_fin_localsystemref` at Billed |
| BR — probability lock | Lock `kf_probability` once status leaves WIP (per the status transition) |
| BR — currency warning | Warn on mixed or unexpected transaction currency |
| BR — VAT default | Default `kf_vatpercent` by business unit: **FR = 20, ES = 21, UK = 20** |
| BR — period lock enforcement | Client-side counterpart to PL-4 |

> [!note] Certainty
> The source summarises BR-1…6 as a range rather than defining each rule. The
> expansion above is derived from the "Required" / "Conditional" notes in the
> `kf_WIP` column spec. The individual rule IDs should be confirmed — see
> [[wip-open-questions]].

## Duplicate detection (DD-1)

> **DD-1** — *"Warn on same parent + completion month + status"*

Warns on create where a WIP line already exists for the same parent Instruction,
same completion month, and same status. This is the WIP-level duplicate control.

The Account-level duplicate rules (D1–D3: fuzzy name+city, exact registration number,
duplicate legal entity under same parent) are CRM concerns — see
[[wip-crm-dependencies]].

## Supporting infrastructure

`kf_IntegrationLog` is the logging target for all of the above. Required fields for
WIP automation traceability: `kf_flowname`, `kf_flowrunid`, `kf_correlationid`,
`kf_triggerrecord`, `kf_direction`, `kf_targetsystem`, `kf_status`, `kf_timestamp`,
`kf_retrycount`, `kf_recordsprocessed`, `kf_recordsfailed`, `kf_environment`.

`kf_IntegrationLog.kf_targetsystem` includes **Finance** as a choice value — the WIP
flows write there. Note the source carries **two different column definitions** for
this table (Master Table Index #38 vs Marketing & Support §5.2); the Master Table
Index version is the fuller one and is used here.

## Implementation notes

- All automation writes must be idempotent — FL-4 and FL-6 are scheduled and will
  re-fire.
- PL-2, PL-3 and FL-1/FL-5 are all record-triggered; they need registration against
  the create/update events on `kf_WIP`.
- PL-4 must reject at the platform level, not only in the form, or API and flow
  writes will bypass it.
