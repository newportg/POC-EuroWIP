---
type: spec
area: wip
status: draft
source: raw/European_CRM_Client_Industry_Master_Taxonomy.xlsx, raw/European_CRM_Property360_Master_Taxonomy.xlsx
extracted: 2026-09-28
---

# WIP Taxonomy Inputs

Two of the three raw workbooks are taxonomies. Neither is a WIP requirement in its
own right, but two choice sets that `kf_WIP` depends on are defined in them, so this
note records only what WIP consumes.

## What WIP actually needs

`kf_WIP` carries two classification columns, both inherited from the parent by
plugin PL-2:

| Column | Source of the value | Taxonomy behind it |
| --- | --- | --- |
| `kf_serviceline` | `kf_Instruction.kf_serviceline` | Global choice, 14 values |
| `kf_sector` | `kf_Instruction.kf_sector` / `kf_Property.kf_sector` | `kf_globalchoice_sector` + HILUCS Property 360 |

Plus one more that matters indirectly:

| Column | Note |
| --- | --- |
| `kf_clientaccountid` → `Account.kf_industry` | SIC-mapped client industry, used for client-sector fee roll-up |

So the taxonomies reach WIP through exactly three columns. Everything else in the
two taxonomy workbooks is CRM-side classification with no WIP consequence.

## Service line choice set

`kf_globalchoice_serviceline` — new, 14 values:

Capital Markets · Valuation & Advisory · Consultancy · Occupier Strategy &
Solutions · Industrial Agency · Retail Agency · Property Management · Project
Management · Residential · Capital Advisory · ESG · Investor Advisory · Workplace
Consulting · Other

This is the primary WIP reporting dimension. Note it is **coarser than the twelve
service-line sheets** in the data model — Industrial Agency, Retail Agency and
Project Management appear here but have no Layer 5 sheet, while the twelve sheets
map into fewer than 14 values. The mapping is not given. Logged in
[[wip-open-questions]].

## Sector choice set

`kf_globalchoice_sector` — extended with **3 new values**: **Automotive, Life
Sciences, Data Centre**, added to the existing sector list.

The base list appears in `kf_Deal.kf_sector` and `kf_Property.kf_sector`:

Offices · Hotels and Hospitality · Industrial and Logistics · Retail · Residential /
Living Sectors · Data Centres · Vineyards · Mixed-use · Healthcare

The three additions exist because HILUCS has no native equivalent — see below.

## Property 360 / HILUCS — the sector bridge

`raw/European_CRM_Property360_Master_Taxonomy.xlsx` bridges HILUCS (the INSPIRE land
use hierarchy, a spatial planning and regulatory standard) to Knight Frank's
enterprise sectors.

| Level | Layer | Count |
| --- | --- | --- |
| 1 | HILUCS L1 — regulatory | 6 categories |
| 2 | HILUCS L2 — regulatory sub-layer | 43 categories |
| 3 | KF Enterprise Sector — business layer | 53 sectors |
| 4 | KF Asset Classes — granular | Multiple per sector |

HILUCS L1 categories:

| Code | Description | L2 | KF sectors | Primary use |
| --- | --- | --- | --- | --- |
| 1 | Primary Production | 5 | 5 | Rural, Agricultural & Natural Resources |
| 2 | Secondary Production | 5 | 5 | Manufacturing, Industrial & Energy Production |
| 3 | Tertiary Production | 14 | 17 | Services: Retail, Office, Hotels, Healthcare, Leisure |
| 4 | Transport, Logistics & Utilities | 9 | 11 | Infrastructure, Logistics & Storage |
| 5 | Residential Use | 4 | 9 | All forms of residential and living sectors |
| 6 | Other Uses | 6 | 6 | Development land, Brownfield & Strategic holdings |
| | **Total** | **43** | **53** | |

The stated challenge: *"HILUCS was designed for spatial planning and land use
regulation, not modern institutional real estate investment."* Four asset classes do
not exist explicitly in HILUCS:

- **Data Centres** — mapped via Information & Communication Services
- **Life Sciences** — mapped via Professional Technical & Scientific Services
- **Build to Rent / PBSA / Senior Living** — mapped via Residential categories
- **Self Storage** — mapped via Logistical & Storage Services

The enterprise layer bridges that gap. This is why `kf_globalchoice_sector` gained
Data Centre, Life Sciences and Automotive.

> [!note] WIP relevance
> These four gap classes are precisely where a pan-Euro WIP portfolio will
> concentrate its fee value. If `kf_sector` is mapped to HILUCS rather than to the
> enterprise layer, Data Centre and Life Sciences fees will be misclassified and the
> sector-level WIP reports in [[wip-reporting-and-kpis]] will be wrong.

`kf_Property.kf_sector` also carries a standing alignment note: *"Need to align to
ISO 19512 / INSPIRE Land-Use as per North Star Integration Guidelines."*

## Client industry — the SIC bridge

`raw/European_CRM_Client_Industry_Master_Taxonomy.xlsx` bridges UK SIC 2007 / EU
NACE Rev. 2 to Knight Frank client industry sectors.

| Level | Layer | Count |
| --- | --- | --- |
| 1 | SIC Section (A–U) | 21 |
| 2 | SIC Division | 88 |
| 3 | KF Client Industry Sector | 35 |
| 4 | KF Client Sub-Segments | Multiple per sector |

SIC has no native home for seven strategically important client types, which the
enterprise layer absorbs:

- Sovereign Wealth Funds → Financial Service Activities
- Family Offices → Financial Service Activities / Households
- Special Purpose Vehicles → Activities of Holding Companies
- REITs → split between Real Estate Activities and Financial Services
- PropTech → Computer Programming & Consultancy
- Infrastructure Funds → Other Financial Service Activities

The 20 strategic client sectors are: Private Equity & Funds · Sovereign Wealth ·
Banking & Financial Services · Insurance & Pensions · Real Estate · Real Estate
Development · Technology · Life Sciences & Pharmaceuticals · Logistics & Distribution
· Retail & Consumer · Hotels & Hospitality · Food & Beverage Operators · Government
& Public Sector · Healthcare · Care & Senior Living · Education · Energy & Utilities
· Manufacturing · Telecommunications · UHNW & Family Office.

## WIP relevance

Two WIP reporting dimensions are affected:

1. **Fee by client sector** — `Account.kf_industry` → `kf_SICCode` (section, division
   and class levels) rolls up to the KF client industry layer. UHNW & Family Office
   and Sovereign Wealth are both SIC gaps, and both are significant WIP clients —
   the latter particularly in Phase 4's Private Office work.
2. **Fee by asset sector** — `kf_WIP.kf_sector` rolls up through the HILUCS bridge.

Neither taxonomy is on the WIP critical path for Phase 1 (Paris Capital Markets is
offices and industrial). Both become load-bearing as the service lines and regions
widen.

## Out of scope

The full taxonomies — 89 client-sector rows, 53 property-sector rows, the SIC
section overview, the HILUCS gap register — are CRM reference data. They are not
reproduced here. If WIP reporting needs the full mapping, read the workbooks
directly.
