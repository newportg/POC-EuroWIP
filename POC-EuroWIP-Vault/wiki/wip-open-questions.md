---
type: open-questions
area: wip
status: open
source: raw/EU CRM Data Model.xlsx
also: raw/European CRM Architecture Review 2.pdf
extracted: 2026-09-28
pdf-evidence: 2026-10-06
---

# WIP Open Questions and Spec Conflicts

The source workbooks contradict themselves in several places. Per the vault rule
*when uncertain, log it rather than guessing*, these are recorded rather than
resolved. Each needs an owner and a decision before build.

Ordered by impact on the WIP build.

---

## 1. `kf_WIP` has two incompatible definitions — blocking

| | Master Table Index #42 | Core Shared Tables §1.6 |
| --- | --- | --- |
| Table name | `kf_WIPBilledLine` | `kf_WIP` |
| PK | `kf_wipbilledlineid` | `kf_wipid` |
| Parent lookups | **13** service-line lookups + `kf_instructionid` + `kf_feescheduleid` | `kf_instructionid` + `kf_feescheduleid` only |
| `kf_fin_localsystemref` | Present — required at Billed | **Absent** |
| `kf_fin_localsystemname` | Present — auto from BU | **Absent** |

The Core Shared Tables version is the newer one — it carries the rename note *"Renamed
from kf_wipbilledlineid"* — and is treated as authoritative throughout this wiki.

**The problem:** under the Core definition, a WIP line at status `Billed` has no field
for the ERP cross-reference, yet the required-at-Billed rule is one of the stated
WIP business rules. The conditional invoice requirements have no home.

**Decision needed:** add `kf_fin_localsystemref` (and probably
`kf_fin_localsystemname`) back to `kf_WIP`, or move the required-at-Billed ERP
reference onto `kf_Instruction`.

---

## 2. PL-1 and the loss cascades assume the old 13-lookup parent model — blocking

| ID | Stated purpose | Problem |
| --- | --- | --- |
| PL-1 | *"Validate exactly 1 parent lookup populated; auto-set kf_parenttype"* | There is now only one parent. The validation is vacuous and `kf_parenttype` is vestigial |
| PL-2 | *"Auto-populate classification fields from parent on create"* | Which parent? |
| FL-2 | *"Cascade parent Lost → child WIP lines set to Lost"* | WIP parent is an Instruction, not a Deal |
| FL-3 | *"Same cascade for non-Deal parents"* | The Deal/non-Deal split no longer exists on `kf_WIP` |

**Decision needed:** restate these against the `kf_Instruction` parent. The
equivalent validations belong on `kf_Instruction` — *"Exactly one populated per
record, determined by `kf_serviceline`"* — and are not currently specified anywhere
as an automation ID.

---

## 3. `kf_Instruction` has two incompatible definitions — high

| | Master Table Index #43 / Marketing Table 6 | Core Shared Tables §1.7 |
| --- | --- | --- |
| Status field | `kf_status` — Active / Won / Lost | `kf_instructionstatus` — Active / Completed / On Hold / Withdrawn |
| `kf_name` | Text (200), *"Instruction display name"* | Text (Auto-number), `INS-{SEQNUM:6}` |
| Service-line lookups | `kf_dealid` only | **13** lookups |
| `kf_transactiontype` | Present | Absent |
| `kf_sector` | Present | Absent |
| `kf_negotiatorid` | Present | Absent |
| `kf_currency` | Present | Absent |
| `kf_instructiontype` | Absent | Present (Mandate / Engagement / Instruction) |
| `kf_startdate` / `kf_signeddate` / `kf_enddate` | Absent | Present |
| `kf_expectedrevenue` | Absent | Present |
| `kf_terminationreason` | Absent | Present |
| `kf_primarycontactid` | Absent | Present |

The Core definition is explicitly declared authoritative: the Capital Markets tab
ends with *"kf_Instruction — See '2. Core Shared Tables' tab, Section 1.7 for the
authoritative definition."*

**The problem:** the Core version drops `kf_sector`, `kf_serviceline`-adjacent
classification and currency — but `kf_WIP.kf_sector` and `kf_WIP.kf_transactiontype`
are specified as **auto-populated from the parent**. If the parent no longer holds
them, PL-2 has nothing to copy.

**Decision needed:** reconcile the two versions into one `kf_Instruction` spec, and
confirm the WIP denormalisation sources.

---

## 4. `kf_WIP` and `kf_Instruction` are missing from the MVP activation list — high

"TABLES BY ACTIVATION PHASE" in Phase Definitions lists the Phase 0 and Phase 1 MVP
tables. **Neither finance table appears in either list**, while the Master Table Index
marks both as `MVP ~ Finance`.

WIP cannot function in Phase 1 without `kf_Instruction` as its parent, and the Phase 1
list is otherwise the complete CM deep-build table set.

**Decision needed:** confirm both tables are activated in Phase 0 (alongside the other
Layer 2 tables), and add them to the list.

---

## 5. Which fields does the period lock freeze? — high

PL-4 says *"Enforce period lock — reject edits to locked fields"* but the field set is
never specified.

Reasonable reading: the financial and status set — `kf_grossfee`, `kf_netfeetogroup`,
`kf_officeretained`, `kf_weightedofficeretained`, `kf_probability`, `kf_vatpercent`,
`kf_wipstatus`, `kf_reportingmonth`, and the invoice fields. **Inference, not stated.**

Also unstated: whether the lock is reversible, who may unlock, and whether unlocking
is logged.

---

## 6. Stale detection and period lock conflict — high

Two clocks:

- **FL-4** — period locks on the **15th of the following month**
- **`kf_staledate`** — `completionmonth + 30 days`

A line with `completionmonth` = 1 August goes stale on 31 August. The August period
locks on 15 September. Between 15 and 30 September the line is **both stale and in a
locked period**. If the lock covers `kf_wipstatus` or `kf_probability`, the standard
remedy for a stale line — re-forecast it or close it out — is blocked.

**Decision needed:** define the precedence. Either exclude `kf_completionmonth` from
the lock, or allow status/probability edits on stale lines in locked periods, or align
the lock date with the staleness threshold.

---

## 7. Three KPI definitions reference fields that do not exist — medium

| KPI | Source field | Status |
| --- | --- | --- |
| WIP Aging Distribution | `kf_Deal.kf_fin_wipagingdays` | Field absent from the `kf_Deal` spec |
| Outstanding Receivables | `kf_Deal.kf_fin_outstanding` | Field absent from the `kf_Deal` spec |
| Fee Revenue | `kf_FeeSchedule.kf_agreedfee` | Field absent — `kf_FeeSchedule` has `kf_feeamount` / `kf_feepercent` |
| Win Rate | `kf_Pitch.kf_pitchoutcome` | Field absent — `kf_Pitch` has `kf_outcome`; "No Longer Selling" is not in the `kf_dealstatus` choice set |

All four KPIs look like they were written against an earlier field naming. The WIP
and receivables KPIs almost certainly belong on `kf_WIP`/`kf_Instruction`, which are
**also absent from the Power BI semantic model table list** — so the WIP reporting
requirement is unowned.

**Decision needed:** confirm the WIP/receivables derivations. These are finance
definitions, not data-modelling calls.

---

## 8. `kf_StageGateRule`, `kf_IntegrationLog`, `kf_GDPRRequest`, `kf_AuditExport` each have two definitions — medium

| Table | Master Table Index | Marketing & Support |
| --- | --- | --- |
| `kf_StageGateRule` | 16 fields: `kf_targettable`, `kf_validationtype`, `kf_layer`, `kf_region`, `kf_effectivefrom/to`, `kf_priority`, `kf_approvedby` | 9 fields: `kf_entity`, `kf_bpfstage`, `kf_fieldname`, `kf_validationtype`, `kf_severity`, `kf_serviceline` |
| `kf_IntegrationLog` | 22 fields, `kf_correlationid` **required**, `kf_flowrunid`, `kf_maxretries`, `kf_environment` | 7 fields, no correlation ID, adds `kf_integrationname` (Yardi / MRI / D365 Finance / PropStream / External API) |
| `kf_GDPRRequest` | 20 fields incl. verification, `kf_systemsaffected`, `kf_actionstaken` | 9 fields, `kf_datasubjectid`, `kf_duedate` |
| `kf_AuditExport` | 20 fields incl. `kf_destinationtype`, `kf_schedulefrequency`, `kf_dataclassification`, `kf_retentiondays` | 8 fields, `kf_destinationurl` = Power BI dataset URL |

The Master Table Index versions are used in this wiki as the fuller set. The
Core Shared Tables tab also defines all four, agreeing with the Master Table Index
version rather than the Marketing one — two against one.

**Note:** `kf_StageGateRule` is defined three times with three different column sets
(Core Shared Tables §1.8, Master Table Index #37, Marketing §5.1).

---

## 9. WIP-specific stage gates are not specified — medium

`kf_StageGateRule.kf_targettable` examples are all service-line tables (`kf_Deal`,
`kf_SalesInstruction`, `kf_Engagement`, `kf_ValuationInstruction`). No WIP table
appears, and WIP status transitions are not BPF stages.

Candidate gates inferred in [[wip-stage-gates]] — mandate signed before WIP entry,
legal entity required before billing — are **not in the source**.

**Decision needed:** can stage gates target `kf_WIP`/`kf_Instruction`, or must the
equivalent controls be implemented as business rules instead?

---

## 10. The nine Phase 7 integration flows are not enumerated — medium

Phase 7 is described only as *"Consolidated Finance ERP, activates 9 integration
flows"*. The flows are not listed anywhere. For the WIP project this is the
definition of the target state.

---

## 11. Service line choice set does not match the service line sheets — medium

`kf_globalchoice_serviceline` has 14 values including **Industrial Agency, Retail
Agency, Project Management**, which have no Layer 5 sheet. The data model has twelve
sheets including **Building Consultancy, Workplace, Investor Advisory**, which do not
appear verbatim in the 14.

`kf_WIP.kf_serviceline` is auto-populated from `kf_Instruction.kf_serviceline`, so
the mapping determines the primary WIP reporting dimension. Not given.

---

## 12. `kf_parenttype` purpose is unresolvable — low

Retained on `kf_WIP` with note *"Parent object type — auto-set by plugin"*, but the
parent is now a single `kf_Instruction`. The choice values are not given.

---

## 13. The SharePoint cutover has no plan — low as stated, high as risk

*"Hard cutover — remove SP write access on go-live day."* No migration scope, no
volumes, no owner, no date, no reconciliation approach. The largest planning gap in
the WIP scope even though the least specified.

---

## 14. `kf_grossfee` derivation not specified — low

Nothing states how `kf_grossfee` is calculated from `kf_FeeSchedule`
(`kf_feeamount` / `kf_feepercent` / `kf_tierstructure` / `kf_minimumfee` /
`kf_cappedamount`) for Fixed / % of Value / Tiered / Hourly bases. Assumed manual
entry; PL-2 covers only the classification fields, not the financials.

---

## Summary

| # | Question | Impact | Owner needed |
| --- | --- | --- | --- |
| 1 | Which `kf_WIP` definition, and where does the ERP ref go? | Blocking | Data model owner |
| 2 | Restate PL-1/PL-2/FL-2/FL-3 for the Instruction parent | Blocking | Data model owner |
| 3 | Reconcile the two `kf_Instruction` specs | High | Data model owner |
| 4 | MVP activation list omits both finance tables | High | Programme |
| 5 | Which fields does the period lock freeze? | High | Finance |
| 6 | Stale detection vs period lock precedence | High | Finance |
| 7 | WIP / receivables / fee KPI derivations | Medium | Finance + BI |
| 8 | Four tables with two definitions each | Medium | Data model owner |
| 9 | Can stage gates target WIP tables? | Medium | Data model owner |
| 10 | The nine Phase 7 flows | Medium | Programme |
| 11 | Service line choice set vs sheets | Medium | Data model owner |
| 12 | `kf_parenttype` purpose | Low | Data model owner |
| 13 | SharePoint migration plan | Risk | Programme |
| 14 | `kf_grossfee` derivation | Low | Finance |
