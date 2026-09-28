---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Reporting and KPIs

## Power BI semantic model

Source, Marketing & Support: *"The semantic model includes the following core
tables: `kf_Deal`, `kf_DealProperty`, `kf_Property`, `kf_Pitch`, `kf_NDA`, `kf_Bid`,
`kf_DDMilestone`, `kf_RedFlag`, `kf_FeeSchedule`, `kf_KYCRecord`, `kf_InvestorProfile`,
`kf_DataRoomAccess`, `kf_TransactionReport`, Account, Contact, Business Unit. It
mirrors the Dataverse entity relationships, star-schema optimised with a Date
dimension table for time-based analysis. All Capital Markets reports reference this
single semantic model."*

> [!warning] `kf_WIP` and `kf_Instruction` are not in the list
> Neither finance table appears in the semantic model, yet two of the seven
> standard KPIs below are defined against `kf_Deal.kf_fin_*` fields that do not
> exist on `kf_Deal`. The most likely intent is that the WIP and receivables KPIs
> are built on `kf_WIP` / `kf_Instruction` and that those two tables are simply
> missing from the list. This must be resolved before the model is built — see Q7
> in [[wip-open-questions]].

Star schema with a Date dimension is a stated requirement. The Date dimension is
also a precondition for aging buckets (0-30, 31-60, 61-90, 90+) and for the
reporting-month grouping.

## Standard KPIs

| KPI | Definition | Source field |
| --- | --- | --- |
| Pipeline Value by Stage | Sum of `kf_portfoliototalvalue` grouped by BPF stage | `kf_Deal.kf_portfoliototalvalue` |
| Win Rate | Count of Pitches Won ÷ total Pitches (excluding "No Longer Selling") | `kf_Pitch.kf_pitchoutcome` |
| Average Time-to-Close | Avg days from deal creation to completion date (Won deals) | `kf_Deal.createdon`, `kf_Deal.kf_completiondate` |
| Fee Revenue | Sum of `kf_agreedfee` for Won deals | `kf_FeeSchedule.kf_agreedfee` |
| **WIP Aging Distribution** | Active deals by aging bucket (0-30, 31-60, 61-90, 90+) | `kf_Deal.kf_fin_wipagingdays` |
| Deal Volume | Count of `kf_Deal` records | `kf_Deal` count |
| **Outstanding Receivables** | Sum of `kf_fin_outstanding` | `kf_Deal.kf_fin_outstanding` |

Three of these have broken field references:

| KPI | Problem | Probable intent |
| --- | --- | --- |
| WIP Aging Distribution | `kf_Deal.kf_fin_wipagingdays` does not exist | Should be derived from `kf_WIP.kf_staledate` / `kf_isstale`, or from `kf_Instruction.kf_startdate` |
| Outstanding Receivables | `kf_Deal.kf_fin_outstanding` does not exist | Should be computed from `kf_WIP` where status = Billed: sum of gross fee less payments received, using `kf_invoiceduedate` and `kf_datepaidinfull` |
| Fee Revenue | `kf_FeeSchedule.kf_agreedfee` does not exist | Should be `kf_FeeSchedule.kf_feeamount` (fixed) or `kf_feepercent` applied to value |

Also note `kf_Pitch.kf_pitchoutcome` does not match the `kf_Pitch` column spec, which
has `kf_outcome` and `kf_pitchtype`. And "No Longer Selling" does not appear in the
`kf_Deal.kf_dealstatus` choice set
(Active / On Hold / Completed / Withdrawn / Marketing / Pending / Under Offer /
Notarised).

> [!warning] Inference
> The three replacements above are inferred from the surrounding column specs. The
> correct derivations — particularly the receivables formula — are a finance
> decision, not a data-modelling one. Do not treat them as agreed.

## WIP-specific reporting requirements

The KPI table above is deal-centric. The WIP-specific reporting needs, derived from
the table spec, are:

| Report | Basis | Grouping |
| --- | --- | --- |
| WIP by status | `kf_wipstatus` | WIP / Billed / Paid / Lost |
| WIP by reporting month | `kf_reportingmonth` | Month — the direct replacement for the spreadsheet tabs |
| Weighted pipeline | `kf_weightedofficeretained` | By `kf_serviceline`, `kf_sector`, `kf_owningoffice` |
| Fee by client | `kf_clientaccountid` | Brand/Group roll-up via `kf_ultimateparentname` |
| Stale WIP | `kf_isstale` | By `kf_owningoffice`, by age bucket |
| Aged receivables | Billed lines, `kf_invoiceduedate` vs today | 0-30 / 31-60 / 61-90 / 90+ |
| Locked period variance | `kf_periodlocked` | Locked vs open periods |

The `kf_serviceline` / `kf_sector` / `kf_clientaccountid` / `kf_owningoffice` columns
exist on `kf_WIP` specifically so these reports do not require joining through
`kf_Instruction` to the service-line tables. PL-2 must be correct for this to work —
see [[wip-automation-requirements]].

## Account hierarchy in DAX

The client roll-up requires the Brand/Group hierarchy to be modelled in Power BI.
The source specifies the calculated columns:

```DAX
AccountPath    = PATH(Account[accountid], Account[parentaccountid])
AccountLevel   = PATHLENGTH(Account[AccountPath])
TopLevelBrand  = LOOKUPVALUE(Account[name], Account[accountid], PATHITEM(Account[AccountPath], 1))
```

And names the three measures to add:

- **Total Deals by Brand/Group** — aggregates all deals across child Legal Entities
- **Client Relationship Duration** — `DATEDIFF` from first deal to today at
  Brand/Group level
- **Cross-Sell Opportunities** — count of service lines engaged per Brand/Group

For WIP, the equivalent roll-up is the *fee* roll-up: `kf_WIP` by
`kf_clientaccountid` resolved to `TopLevelBrand`. This is the measure that makes the
two-account split on `kf_Instruction` (Brand/Group for relationship, Legal Entity for
invoice) work in reporting.

## Audit and export

`kf_AuditExport` is the staging table for monthly audit log exports to Power BI —
*"Staging table for monthly audit log exports to Power BI"*. This is how the
semantic model gets fed and refreshed.

| Field | Values |
| --- | --- |
| `kf_destinationtype` | Power BI / Azure Data Lake / SharePoint / Audit Archive |
| `kf_sourcetable` | Choice of Dataverse table (`kf_Deal` / Account / `kf_ValuationInstruction` / …) |
| `kf_exportstatus` | Queued / In Progress / Completed / Failed |
| `kf_triggeredby` | Scheduled / Manual / Event-Driven |
| `kf_schedulefrequency` | Daily / Weekly / Monthly / Quarterly / Ad Hoc |
| `kf_dataclassification` | Internal / Confidential / **Restricted** |
| `kf_retentiondays` | Days before auto-purge of exported file |
| `kf_correlationid` | Links to `kf_IntegrationLog` for traceability |

`kf_dataclassification` and `kf_retentiondays` matter to WIP exports specifically:
WIP and receivables extracts are commercially sensitive and must be purged on a
defined retention period rather than accumulating in a data lake.

## Two competing `kf_AuditExport` definitions

The source carries two conflicting versions — Master Table Index #40 (CM tab
version, 20 fields with destination/schedule/retention) and Marketing & Support §5.4
(8 fields, simpler, with `kf_destinationurl` = Power BI dataset URL). The fuller
Master Table Index version is used here. See [[wip-open-questions]].
