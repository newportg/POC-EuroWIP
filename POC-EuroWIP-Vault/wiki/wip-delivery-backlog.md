---
type: backlog
area: wip
status: active
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Delivery Backlog

Task register for the WIP project. Rendered on [[Dashboard]] via Dataview.

Tasks are derived from the requirements in this wiki. **T** = build task, **D** =
decision needed, **G** = gap to close. Each carries two inline fields:
`stream::` (model, automation, finance, reporting, cutover, decisions, done) and
`phase::` (P0, P1, P2, future). Decision tasks also carry `blocking::`.

## Decisions — blocking

Gate the build. Full detail in [[wip-open-questions]].

- [ ] D-01 Decide which `kf_WIP` definition is authoritative and where `kf_fin_localsystemref` lives (Q1) [stream:: decisions] [phase:: P0] [blocking:: true]
- [ ] D-02 Restate PL-1, PL-2, FL-2, FL-3 against the `kf_Instruction` parent (Q2) [stream:: decisions] [phase:: P0] [blocking:: true]
- [ ] D-03 Reconcile the two `kf_Instruction` specs and confirm the denormalisation source for `kf_sector` and `kf_transactiontype` (Q3) [stream:: decisions] [phase:: P0] [blocking:: true]
- [ ] D-04 Confirm `kf_WIP` and `kf_Instruction` activate in Phase 0 (Q4) [stream:: decisions] [phase:: P0] [blocking:: true]
- [ ] D-05 Define the locked field set, unlock rights and unlock logging (Q5) [stream:: decisions] [phase:: P0] [blocking:: true]
- [ ] D-06 Resolve precedence between the FL-4 period lock and `kf_staledate` (Q6) [stream:: decisions] [phase:: P0] [blocking:: true]

## Decisions — non-blocking

- [ ] D-07 Confirm the WIP aging, receivables and fee revenue KPI derivations (Q7) [stream:: decisions] [phase:: P1]
- [ ] D-08 Pick one column definition each for `kf_StageGateRule`, `kf_IntegrationLog`, `kf_GDPRRequest`, `kf_AuditExport` (Q8) [stream:: decisions] [phase:: P0]
- [ ] D-09 Confirm whether stage gates can target `kf_WIP` / `kf_Instruction`, or whether WIP controls become business rules (Q9) [stream:: decisions] [phase:: P1]
- [ ] D-10 Enumerate the 9 Phase 7 consolidated ERP integration flows (Q10) [stream:: decisions] [phase:: future]
- [ ] D-11 Map the 14 `kf_globalchoice_serviceline` values onto the 12 service line sheets (Q11) [stream:: decisions] [phase:: P1]
- [ ] D-12 Resolve or remove the vestigial `kf_parenttype` field (Q12) [stream:: decisions] [phase:: P0]
- [ ] D-13 Scope, resource and schedule the SharePoint WIP & Billed migration (Q13) [stream:: decisions] [phase:: P1]
- [ ] D-14 Define the `kf_grossfee` derivation from `kf_FeeSchedule` for all four fee bases (Q14) [stream:: decisions] [phase:: P1]

## Phase 0 — model build

- [ ] T-01 Create `kf_Instruction` with the authoritative column set [stream:: model] [phase:: P0]
- [ ] T-02 Add the 13 service-line parent lookups to `kf_Instruction` [stream:: model] [phase:: P0]
- [ ] T-03 Create the `kf_Instruction` → service-line table One-to-One relationships [stream:: model] [phase:: P0]
- [ ] T-04 Create `kf_WIP` with the authoritative column set [stream:: model] [phase:: P0]
- [ ] T-05 Add the `kf_Instruction` → `kf_WIP` One-to-Many relationship [stream:: model] [phase:: P0]
- [ ] T-06 Add `kf_WIP` → Account, `kf_Property`, BusinessUnit, `kf_FeeSchedule` relationships [stream:: model] [phase:: P0]
- [ ] T-07 Configure auto-numbering: `INS-{SEQNUM:6}` and `WIP-{SEQNUM:6}` [stream:: model] [phase:: P0]
- [ ] T-08 Configure the `kf_wipstatus` choice: WIP / Billed / Paid / Lost [stream:: model] [phase:: P0]
- [ ] T-09 Configure the `kf_instructionstatus` choice: Active / Completed / On Hold / Withdrawn [stream:: model] [phase:: P0]
- [ ] T-10 Configure the `kf_instructiontype` choice: Mandate / Engagement / Instruction [stream:: model] [phase:: P0]
- [ ] T-11 Configure `kf_fin_localsystemname`: Paris GL / Madrid Accounting / SAP / Other [stream:: model] [phase:: P0]
- [ ] T-12 Build the `kf_staledate` calculated field (`completionmonth + 30 days`) [stream:: model] [phase:: P0]
- [ ] T-13 Build the `kf_isstale` calculated field (`wipstatus = WIP AND today > staledate`) [stream:: model] [phase:: P0]
- [ ] T-14 Build the `kf_weightedofficeretained` calculated field (`officeretained × probability / 100`) [stream:: model] [phase:: P0]
- [ ] T-15 Apply required-field rules: `kf_reportingmonth`, `kf_wipstatus`, `kf_instructionid`, `kf_serviceline`, `kf_clientaccountid`, `kf_owningoffice`, `kf_startdate` [stream:: model] [phase:: P0]
- [ ] T-16 Apply conditional requirements: `kf_invoicenumber` at Billed/Paid, `kf_invoiceduedate` at Billed, `kf_datepaidinfull` at Paid [stream:: model] [phase:: P0]
- [ ] T-17 Build the DD-1 duplicate detection rule: warn on same parent + completion month + status [stream:: model] [phase:: P0]
- [ ] T-18 Configure filtered lookup F5: `kf_legalentityaccountid` limited to `kf_accountclassification = Legal Entity` [stream:: model] [phase:: P0]
- [ ] T-19 Confirm `kf_ultimateparentname` is calculated on Account (feeds the WIP fee roll-up) [stream:: model] [phase:: P0]
- [ ] T-20 Verify `kf_sector` maps through the HILUCS bridge, not the raw regulatory layer [stream:: model] [phase:: P1]

## Phase 0 — automation

- [ ] T-21 Build PL-1: validate the parent lookup and set `kf_parenttype` [stream:: automation] [phase:: P0]
- [ ] T-22 Build PL-2: auto-populate classification fields from parent on create [stream:: automation] [phase:: P0]
- [ ] T-23 Build PL-3: capture `kf_previousprobability` on every probability change [stream:: automation] [phase:: P0]
- [ ] T-24 Build PL-4: reject edits to locked fields on a locked period [stream:: automation] [phase:: P0]
- [ ] T-25 Build FL-1: weekly stale WIP alert to Finance Admin [stream:: automation] [phase:: P0]
- [ ] T-26 Build FL-2: cascade parent Lost → child WIP lines to Lost [stream:: automation] [phase:: P0]
- [ ] T-27 Build FL-3: loss cascade for non-CM parents [stream:: automation] [phase:: P0]
- [ ] T-28 Build FL-4: monthly period lock on the 15th of the following month [stream:: automation] [phase:: P0]
- [ ] T-29 Build FL-5: probability gaming alert on Billed from <30% [stream:: automation] [phase:: P0]
- [ ] T-30 Build FL-6: monthly WIP update reminder [stream:: automation] [phase:: P0]
- [ ] T-31 Build the BR set: invoice field requirements, probability lock, currency warning, VAT default (FR 20 / ES 21 / UK 20), period lock enforcement [stream:: automation] [phase:: P0]
- [ ] T-32 Log all WIP flows to `kf_IntegrationLog` with `kf_correlationid` populated [stream:: automation] [phase:: P0]

## Phase 0/1 — finance readiness

- [ ] T-33 Confirm the manual keying process for invoice number, due date and date paid until Phase 7 [stream:: finance] [phase:: P0]
- [ ] T-34 Confirm BU → ERP local system defaulting for Paris and Madrid [stream:: finance] [phase:: P1]
- [ ] T-35 Confirm the Paris VAT default of 20% against the fee letters [stream:: finance] [phase:: P1]

## Phase 1 — reporting

- [ ] T-36 Add `kf_WIP` and `kf_Instruction` to the Power BI semantic model [stream:: reporting] [phase:: P1]
- [ ] T-37 Build the Date dimension table for time-based analysis [stream:: reporting] [phase:: P1]
- [ ] T-38 Build the `AccountPath` / `AccountLevel` / `TopLevelBrand` DAX calculated columns [stream:: reporting] [phase:: P1]
- [ ] T-39 Build the WIP by status report (WIP / Billed / Paid / Lost) [stream:: reporting] [phase:: P1]
- [ ] T-40 Build the WIP by reporting month report [stream:: reporting] [phase:: P1]
- [ ] T-41 Build the weighted pipeline report by service line, sector and owning office [stream:: reporting] [phase:: P1]
- [ ] T-42 Build the fee by client report rolled up to `TopLevelBrand` [stream:: reporting] [phase:: P1]
- [ ] T-43 Build the stale WIP report with age buckets (0-30 / 31-60 / 61-90 / 90+) [stream:: reporting] [phase:: P1]
- [ ] T-44 Build the aged receivables report [stream:: reporting] [phase:: P1]
- [ ] T-45 Set `kf_dataclassification` and `kf_retentiondays` on WIP exports [stream:: reporting] [phase:: P1]
- [ ] T-46 Wire `kf_AuditExport` as the monthly feed to Power BI [stream:: reporting] [phase:: P1]

## Phase 1 — cutover

- [ ] T-47 Extract historical WIP from SharePoint with original reporting month, completion month and status [stream:: cutover] [phase:: P1]
- [ ] T-48 Define the reconciliation check between migrated WIP and the SharePoint template [stream:: cutover] [phase:: P1]
- [ ] T-49 Write the hard cutover runbook including SharePoint write-access revocation [stream:: cutover] [phase:: P1]
- [ ] T-50 Run one full month end-to-end in a parallel period before cutover [stream:: cutover] [phase:: P1]

## Future phases

- [ ] T-51 Phase 2: confirm Madrid Accounting local system and Madrid VAT default [stream:: finance] [phase:: P2]
- [ ] T-52 Phase 3: configure OSS and Valuations WIP with their own BPFs [stream:: model] [phase:: future]
- [ ] T-53 Phase 4: configure Residential Sales and Lettings WIP [stream:: model] [phase:: future]
- [ ] T-54 Phase 5: extend VAT defaults and currencies for APAC, Americas, Middle East [stream:: finance] [phase:: future]
- [ ] T-55 Phase 7: build the 9 consolidated ERP integration flows [stream:: finance] [phase:: future]

## Definition of done

- [ ] T-56 `kf_WIP` and `kf_Instruction` exist in production with the authoritative column set [stream:: done]
- [ ] T-57 PL-1…4, FL-1…6, the BR set and DD-1 are registered and passing [stream:: done]
- [ ] T-58 One full Paris CM month closed, locked on the 15th, and reported [stream:: done]
- [ ] T-59 SharePoint write access revoked [stream:: done]
- [ ] T-60 WIP is in the Power BI semantic model and aging plus receivables reconcile to the Finance ledger [stream:: done]
