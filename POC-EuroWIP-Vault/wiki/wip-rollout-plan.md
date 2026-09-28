---
type: spec
area: wip
status: draft
source: raw/EU CRM Data Model.xlsx
extracted: 2026-09-28
---

# WIP Rollout Plan

Source: `EU CRM Data Model.xlsx` → **"0. Phase Definitions"**.

## The eight phases

| Phase | Label | Duration | Scope | WIP relevance |
| --- | --- | --- | --- | --- |
| **0** | Foundation ("CRM Lite") | c.8–10 weeks | Environments, Layers 2–4 (global data model, regional/country compliance), security, SharePoint, Power BI foundation | **`kf_WIP` + `kf_Instruction` are Layer 2 Finance tables — built here** |
| **1** | Paris CM Deep Build | c.12–16 weeks | Layer 5 (8-stage BPF, **Finance integration**, Marketing handoff) + Layer 6 (`KF_CM_France`), Copilot for Sales pilot | **First real WIP volume: Paris Capital Markets** |
| **2** | Madrid + EIT CM Deep Build | c.10–14 weeks | Layer 6 (`KF_CM_Spain`) + Layer 7 (`KF_EIT`), cross-border portfolios, Hub coexistence | Second market; Madrid Accounting becomes a live local system |
| 3 | Additional Service Lines | Future | `KF_OSS_Core`, `KF_Valuations_Core` — new Layer 5 solutions **with their own BPFs** | OSS and Valuations WIP start |
| 4 | Residential / Private Office | Future | `KF_Private_Office` at Layer 7 — operates across Capital Markets, Residential, Valuations for ultra-high-net-worth individuals | Residential Sales + Lettings WIP start |
| 5 | Regional Expansion | Future | New Layer 3 regional solutions (`KF_APAC`, `KF_Americas`, `KF_MiddleEast`) | New currencies, new VAT regimes |
| 6 | Hub Replacement | Future | Full API integration replacing the manual CRM ↔ Hub transition, pending Hub roadmap evaluation | Data source change on `kf_Deal.kf_datasource` |
| 7 | **Consolidated Finance ERP** | Future | *"Consolidated Finance ERP, activates 9 integration flows"* | **The point at which WIP becomes an integrated finance record** |

## Key dates and dependencies

- **Phase 0** — `kf_WIP` and `kf_Instruction` are Layer 2 Finance tables and are
  marked **MVP** in the Master Table Index. The SharePoint WIP & Billed template is
  still the system of record at this point; the Dataverse table is built alongside it.
- **Phase 1** — *"Finance integration"* is named in scope. This is the phase where
  Paris Capital Markets WIP goes live and the SharePoint hard cutover happens.
- **Phase 7** — real ERP integration. Until then the cross-reference fields are
  maintained manually (see [[wip-finance-erp-integration]]).

## The hard cutover

> *"Note: This replaces the SharePoint WIP & Billed template. **Hard cutover** —
> remove SP write access on go-live day."*

This is a single, non-negotiable milestone. Requirements implied:

1. All Paris CM WIP data must be migrated from the SharePoint template into
   `kf_WIP` records before go-live.
2. Historical WIP lines must be loaded with their original `kf_reportingmonth`,
   `kf_completionmonth` and `kf_wipstatus` — otherwise period-locking and aging
   history are meaningless.
3. SharePoint write access is revoked on go-live day, not phased out.
4. The monthly-tab structure becomes `kf_reportingmonth` values.

> [!warning] Not in the source
> The source does not define the migration scope, the data volumes, who performs
> the migration, or the cutover date. Only the *"hard cutover"* constraint and the
> *"go-live day"* reference are given. This is the largest planning gap in the WIP
> scope.

## MVP table activation — a gap

"TABLES BY ACTIVATION PHASE" enumerates the MVP tables:

| Phase (Active) | Tables activated |
| --- | --- |
| MVP — Phase 0 | Account, Contact, `kf_Property`, `kf_EnergyRating`, `kf_GDPRRequest`, `kf_AuditExport`, `kf_SICCode` |
| MVP — Phase 1 | `kf_Deal`, `kf_DealProperty`, `kf_Pitch`, `kf_NDA`, `kf_Bid`, `kf_DDMilestone`, `kf_RedFlag`, `kf_FeeSchedule`, `kf_KYCRecord`, `kf_InvestorProfile`, `kf_DataRoomAccess`, `kf_TransactionReport`, `kf_StageGateRule`, `kf_IntegrationLog`, Lead |

**Neither `kf_WIP` nor `kf_Instruction` appears in either list**, despite the Master
Table Index marking both as **MVP / Finance**. A WIP record cannot exist in Phase 1
without its parent Instruction, and the Phase 1 list is otherwise the complete CM
deep-build table set.

Most likely reading: both tables are intended to be activated in Phase 0 alongside the
other Layer 2 tables, and the Phase 0 list is incomplete. But this determines whether
WIP exists before or at the same time as the CM tables, and it needs confirming. See
[[wip-open-questions]].

## Service line activation for WIP

`kf_WIP` and `kf_Instruction` are mapped ✅ to all twelve service lines, but only
Capital Markets has a Phase 1 build. WIP volume arrives in waves:

| Phase | Service lines producing WIP | WIP characteristics |
| --- | --- | --- |
| 1 | Capital Markets (Paris) | `kf_feescheduleid` available; full 8-stage BPF; 8-year CM fee structures |
| 2 | Capital Markets (Madrid) + EIT | Second local ledger; cross-border; conflict checks |
| 3 | OSS, Valuations | New BPFs; no fee schedule table — fees keyed directly |
| 4 | Residential Sales, Residential Lettings | New BPFs; high instruction volume |
| 5+ | All remaining | Layer 3 regional solutions |

## Dependencies WIP inherits

| Dependency | Needed for | Available |
| --- | --- | --- |
| `kf_Instruction` | Every WIP line | Phase 0 (Layer 2) |
| `kf_Deal` | CM parent lookup | Phase 1 |
| `kf_FeeSchedule` | Optional fee basis | Phase 1 |
| Account hierarchy (Brand/Group → Legal Entity) | `kf_clientaccountid`, `kf_legalentityaccountid`, filtered lookups | Phase 0 |
| `kf_StageGateRule` | BPF gating | MVP |
| `kf_IntegrationLog` | Flow logging | MVP |
| `kf_AuditExport` | Power BI feed | Phase 0 |
| Local finance systems (Paris GL, Madrid Accounting) | `kf_fin_localsystemname` | Phase 1 / 2 |
| Consolidated Finance ERP | `kf_fin_localsystemref` automation | **Phase 7** |

## Definition-of-done indicators

Not stated in the source. Reasonable set, flagged as inference:

1. `kf_WIP` and `kf_Instruction` exist in the production environment with the
   authoritative column set from [[wip-table-specification]] and
   [[wip-instruction-model]].
2. PL-1…4, FL-1…6, BR-1…6 and DD-1 are registered and passing.
3. A full Paris CM month has been closed, locked on the 15th, and reported.
4. SharePoint write access is revoked.
5. WIP appears in the Power BI semantic model and the aging / receivables reports
   reconcile to the Finance ledger.
