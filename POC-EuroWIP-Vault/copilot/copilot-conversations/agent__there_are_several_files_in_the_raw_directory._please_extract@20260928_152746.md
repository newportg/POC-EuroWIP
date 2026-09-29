---
epoch: 1790605666000
mode: agent
backendId: opencode
projectId: "debe6f1a-9d0f-437b-b8db-43703f81ca1f"
sessionId: "ses_f17985c76ffeK80ufObLfZZ6P2"
agentLabel: "Extract WIP requirements into wiki"
usage: '{"usedTokens":101348,"contextWindow":200000,"updatedAt":1790611476277}'
tags:
  - copilot-conversation
---

**user**: there are several files in the raw directory. please extract the specific requirements for the WIP project, emphasising the WIP aspects and not the CRM aspects. CRM is needed but is not the focus. The output should be in the wiki directory as Markdown files, and the dashboard should be populated with the tasks
[Timestamp: 2026/09/28 15:27:46]

**ai**: I'll start by exploring the project structure and the raw directory.Now the CRM dependency file and the taxonomy file:Now the open questions file — the most important one for actioning:Now the delivery backlog that will drive the Dashboard:Let me fix the Dataview inline field syntax (`key:: value`, not backticks) and expand the decision tasks to cover all 14 open questions:The Dataview inline fields need bracketed syntax for multiple fields per line — let me fix that:Done. 13 notes written to `/wiki`, Dashboard populated.

## What the raw files actually are

Three Excel workbooks, 26/08/2026. The WIP substance is almost entirely in **`EU CRM Data Model.xlsx`** — specifically sheet `2. Core Shared Tables` §1.6 (`kf_WIP`) and §1.7 (`kf_Instruction`), plus the automation catalogue in `15. Marketing & Support`. The other two workbooks (SIC client taxonomy, HILUCS Property 360) are classification reference data; they reach WIP through only three columns.

## The WIP scope, in one line

WIP is two Layer 2 finance tables — `kf_WIP` (work-in-progress and billing tracker) and `kf_Instruction` (mandate/engagement parent) — that **replace the SharePoint "WIP & Billed" template on a hard cutover**, serving all twelve service lines through a single path: `kf_Deal → kf_Instruction → kf_WIP`. `kf_WIP` carries **no** service-line lookups at all, so adding a service line is a one-column change on `kf_Instruction`, not on WIP.

## Notes created

| Note | Covers |
| --- | --- |
| [[wip-project-overview]] | Scope, the single-path rule, the SharePoint driver, what's in vs out |
| [[wip-table-specification]] | Every `kf_WIP` column, status ladder, calculated fields |
| [[wip-instruction-model]] | The parent, 13 service-line lookups, Brand/Group vs Legal Entity invoicing |
| [[wip-automation-requirements]] | PL-1…4, FL-1…6, BR-1…6, DD-1 |
| [[wip-period-locking-and-aging]] | Reporting month, stale detection, 15th-of-month lock |
| [[wip-finance-erp-integration]] | Invoice fields, VAT defaults, local ledgers, Phase 7 |
| [[wip-stage-gates]] | `kf_StageGateRule` and whether it can gate WIP at all |
| [[wip-reporting-and-kpis]] | Semantic model, KPIs, DAX, exports |
| [[wip-rollout-plan]] | Phases 0–7, MVP activation, cutover |
| [[wip-crm-dependencies]] | What WIP consumes from CRM, and what it explicitly ignores |
| [[wip-taxonomy-inputs]] | The three WIP columns the taxonomies feed |
| [[wip-open-questions]] | 14 contradictions in the source |
| [[wip-delivery-backlog]] | 60 build tasks + 14 decision tasks |

## The thing you should read first

The source contradicts itself, and two of the conflicts are **blocking**:

- **`kf_WIP` has two incompatible definitions.** The Master Table Index version (`kf_WIPBilledLine`) has 13 service-line parent lookups and carries `kf_fin_localsystemref` as *"required at Billed status"*. The newer Core Shared Tables version (`kf_WIP`) has one parent and **drops both ERP reference fields** — leaving the required-at-Billed rule with nowhere to live.
- **The automation catalogue still targets the old model.** PL-1 says *"validate exactly 1 parent lookup populated"* when there is now exactly one parent by construction; FL-2/FL-3 split on "Deal vs non-Deal parents", a distinction that no longer exists on the WIP table.

I treated the Core Shared Tables tab as authoritative throughout (it carries the rename note, and the CM tab explicitly defers to it for `kf_Instruction`), and logged the rest rather than guessing. Details with side-by-side definitions are in [[wip-open-questions]].

Two more worth flagging: `kf_WIP` and `kf_Instruction` are marked **MVP** in the Master Table Index but appear in **neither** Phase 0 nor Phase 1 activation list — and the period lock (15th of following month) can freeze a WIP line during the 30-day window in which it goes stale, blocking its own remediation.

## Dashboard

Rewritten around the backlog. Dataview is installed, so it renders live: progress by phase and stream, the six blocking decisions, all open tasks, and a wiki index. Tasks carry `[stream::]` and `[phase::]` inline fields — bracketed, which Dataview requires for multiple fields per line.

Your three original queries pointed at `bugs`, `specs` and `decisions` folders that don't exist in this vault, so they were rendering empty. I kept them in a collapsed callout at the bottom rather than deleting them — remove that block if you don't want it.

## Two things I did not do

- **Did not move the raw files to `/archive`.** `prompts/translate.md` calls for it, but your `AGENTS.md` hard rule 1 and the Out of Scope section both forbid editing `/raw` or `/archive`, and that file is more specific. Say the word if you want them moved.
- **Did not commit.** `AGENTS.md` says commit after meaningful changes, but this vault isn't a git repo — no `.git` anywhere up the tree, despite `README.md` saying it is. Worth a `git init` at some point.
[Timestamp: 2026/09/28 15:27:46]

**user**: can you create archimate diagrams to represent this system
[Timestamp: 2026/09/28 15:41:05]

**ai**: Let me check how the PlantUML plugin is configured, since that determines which ArchiMate syntax will render.The plugin uses the public PlantUML server, so native ArchiMate macros will work. Let me verify I can actually render them before writing five diagrams that might not compile.ArchiMate macros render. Let me build a validation harness so I can compile-check every diagram before handing it over.The POST body isn't reaching the server (identical encoding to the earlier test). Let me use the same GET encoding the plugin itself uses — hex-encoded raw deflate:Validation harness works. Now let me write the diagrams. Starting with the data model:Now the monthly cycle and system landscape:All five compile. Let me visually check the layout — a diagram that compiles but lays out badly is still a bad diagram.I can't view images, so let me verify layout numerically instead — a diagram that compiles but renders 4000px wide is unreadable in a note.## Objective
- Extract WIP-focused requirements from the raw Excel workbooks into the Obsidian wiki, populate the dashboard with tasks, and represent the system with ArchiMate diagrams.

## Important Details
- Workspace: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault`.
- WIP scope centres on Layer 2 tables `kf_WIP` and `kf_Instruction`; CRM is secondary.
- `kf_Instruction` is the only service-line path to `kf_WIP`; `kf_WIP` has no direct service-line lookups.
- `kf_WIP` replaces the SharePoint WIP & Billed template on a hard cutover. ERP consolidation is deferred to Phase 7.
- Core Shared Tables §1.6 and §1.7 are treated as authoritative; older Master Table Index definitions are retained as conflicts in [[wip-open-questions]].
- Fourteen source conflicts are logged; D-01 through D-06 are build-blocking.
- Dataview tasks use bracketed multiple inline fields: `[stream:: model] [phase:: P0]`.
- Dataview and `obsidian-plantuml` are installed. PlantUML defaults to `https://www.plantuml.com/plantuml`; ArchiMate standard-library includes compile successfully.
- Validation uses `~0` + Base64 raw DEFLATE. The custom `~h` approach failed with `Syntax Error? (Assumed diagram type: sequence)`.
- Raw files remain untouched in `raw`; nothing was moved to `archive`. The vault is not a Git repository despite `README.md` claiming it is.

## Work State
### Completed
- Parsed all three `.xlsx` workbooks with `openpyxl`.
- Created 13 top-level WIP wiki notes covering scope, data model, automation, period locking, finance/ERP, stage gates, reporting, rollout, CRM dependencies, taxonomies, open questions, and backlog.
- Replaced [[Dashboard]] with WIP-focused Dataview views while retaining the three empty legacy queries in a collapsed callout.
- Created a 74-task backlog: 60 delivery tasks plus 14 decision tasks; six decisions are marked blocking.
- Created five ArchiMate/PlantUML notes under `wiki\archimate`:
  - `wip-application-composition.md`
  - `wip-lifecycle.md`
  - `wip-monthly-cycle.md`
  - `wip-system-landscape.md`
  - `wip-archimate-index.md`
- All five PlantUML blocks compile successfully with zero validation failures.
- Rendered all five diagrams to PNG for layout review; only `wip-application-composition-1.png` has been visually opened so far.

### Active
- Visually reviewing the rendered diagrams for layout and semantic accuracy.
- Correct likely diagram issues before finalisation:
  - `wip-lifecycle.md` labels `PL-5 locks probability`; the source has no PL-5 and this should be the BR probability-lock rule.
  - `wip-system-landscape.md` currently groups Paris GL under Phase 7; verify it against the Paris Phase 1 scope and manual interim ledger model.
  - `wip-application-composition.md` visually implies a direct `kf_WIP`–`kf_DealProperty` relationship although no direct WIP lookup exists.
  - `wip-archimate-index.md` uses `rectangle`/`Artifact` rather than canonical ArchiMate element macros.
- `Dashboard.md` currently excludes `type: diagram` from its wiki-index query.
- `wip-project-overview.md` does not yet link to the new ArchiMate notes.

### Blocked
- No diagram-tooling blocker; rendering and validation work.
- WIP implementation remains blocked by source contradictions:
  - Q1: incompatible `kf_WIP` definitions and no authoritative home for `kf_fin_localsystemref` at Billed.
  - Q2: PL-1/PL-2 and FL-2/FL-3 still assume the retired 13-lookup WIP parent model.

## Next Move
1. Read the remaining four PNGs, inspect all layouts, and correct the listed semantic/ArchiMate issues.
2. Revalidate all PlantUML blocks, add `type: diagram` to the dashboard index, link the diagrams from [[wip-project-overview]], then report the completed diagram set.

## Relevant Files
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-application-composition.md`: Application Composition diagram and data-model narrative.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-lifecycle.md`: WIP status/business-flow diagram; contains the PL-5 label to correct.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-monthly-cycle.md`: Period-lock, stale-detection, and automation process diagram.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-system-landscape.md`: Dataverse, SharePoint, ledger, ERP, and BI landscape; Paris GL phase grouping needs review.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-archimate-index.md`: Diagram navigation and view map.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\Dashboard.md`: Task dashboard; diagram files are not yet included in its wiki index.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-project-overview.md`: Primary entry point and diagram-link integration point.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-open-questions.md`: Fourteen source conflicts and required decisions.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-delivery-backlog.md`: 74 dashboard-driven tasks.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\raw\EU CRM Data Model.xlsx`: Primary WIP source workbook.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\raw\European_CRM_Client_Industry_Master_Taxonomy.xlsx`: Secondary client taxonomy.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\raw\European_CRM_Property360_Master_Taxonomy.xlsx`: Secondary property taxonomy.
- `C:\Users\NEWPORTG\AppData\Local\Temp\opencode\validate-arch.ps1`: PlantUML validation harness.
- `C:\Users\NEWPORTG\AppData\Local\Temp\opencode\puml`: Extracted PlantUML blocks.
- `C:\Users\NEWPORTG\AppData\Local\Temp\opencode\png`: Rendered diagram PNGs for visual review.Widths carry a `px` suffix, so my regex missed them. Re-extracting with a corrected pattern:All five render at sane aspect ratios (1.15–1.67, none at the 790px clipping cap), so there are no pathological layouts. That closes the "is it readable" question numerically — I can't do a true visual pass, so I'll verify the known content defects directly in the source instead.Let me confirm each defect against the actual files before editing.Both defects confirmed. PL-5 exists nowhere except that label, and the wiki consistently says Paris GL is **Phase 1** (`wip-finance-erp-integration.md:83`, `wip-rollout-plan.md:100`) — not Phase 7. Reading the two files to fix:Fix 1: the PL-5 label. Let me confirm which rule actually locks probability before I relabel it.Confirmed — probability lock is a **BR** (business rule), not a plugin. PL-1…PL-4 is the complete plugin set. Fixing:Now fix 2: Paris GL is Phase 1, not Phase 7. It belongs in the in-scope package with a manual interim ledger, while the *integration* stays deferred to Phase 7.Now fix 3: the implied direct `kf_WIP`–`kf_DealProperty` relationship. Let me read that file.Line 73 is the contradiction: it draws a direct `kf_WIP`–`kf_DealProperty` link that the note at line 123–125 explicitly says does not exist. Removing it — the five real WIP relationships are Instruction, FeeSchedule, Account, BusinessUnit, Property:Likely a line-ending mismatch. Editing the single line instead:The raw line reads `0..1`, not `0..*` as displayed. Using the exact bytes:Now fix 4: the index note's non-canonical elements.`Artifact` is an ArchiMate Application-layer grouping element — wrong for "a note that documents a view". The honest fix is PlantUML's generic shape carrying the ArchiMate `<<View>>`/`<<Viewpoint>>` stereotypes. Let me check the encoding first so I don't corrupt the em-dashes:No BOM, LF endings. Splicing the block (lines 24–42) with stereotype-based elements:Now update the Conventions section, which still describes the old element types:Now the navigation fixes. Let me read the current index query and the overview's link section.Now re-extract and revalidate all five diagrams, since four were edited:403 is the public server rejecting urllib's default User-Agent — `curl` worked earlier. Falling back to curl:All five render. Since PlantUML returns a valid PNG even for a syntax error, let me verify properly via the SVG endpoint, which surfaces error text, and re-check final dimensions:All five are clean — no syntax errors. The `-1` files are stale leftovers from the earlier extraction; cleaning them up so future validation isn't ambiguous:Let me spot-check the spliced index block and confirm no `PL-5` or stale Paris grouping survives anywhere:All fixes verified. One cosmetic regression: my splice wrote ASCII hyphens where the vault uses em-dashes and arrows. Restoring the house style:Final revalidation after the cosmetic edits:The ArchiMate set is done. Here's what changed and what I found.

## Layout verification

I can't view images, so I verified readability numerically from the rendered SVGs. All five land between 790×458 and 790×686 — aspect ratios 1.15 to 1.72, none clipped at the width cap. No pathological layouts. That closes the "is it readable in a note" question, but it is not a true visual pass: element collisions, overlapping notes and connector routing still need your eye in Obsidian.

## Four substantive corrections

**1. `PL-5` did not exist.** [[wip-lifecycle]] labelled the WIP→Billed transition `"PL-5 locks probability"`, but the plugin set is PL-1…PL-4 only. The probability lock is a **business rule**, confirmed in two places — `wip-automation-requirements.md:106` ("BR — probability lock") and `wip-period-locking-and-aging.md:122` ("Business rule *probability lock*"). Relabelled to `BR probability lock` and added it to the ladder table's automation column.

**2. Paris GL was in the wrong phase.** [[wip-system-landscape]] had Paris GL inside the "Deferred — Phase 7" package. The wiki says otherwise in two places — `wip-finance-erp-integration.md:83` ("Phase 1 goes live in Paris") and `wip-rollout-plan.md:100` ("Local finance systems (Paris GL, Madrid Accounting) → Phase 1 / 2"). Moved it into the in-scope Phase 0/1 package marked `KEYED BY HAND`; what actually defers to Phase 7 is the *integration*, not the ledger. The relationship label changed from "MANUAL until Phase 7" to "MANUAL from Phase 1", and the legend now reads "1 | Paris GL ledger · SharePoint cutover".

**3. A relationship that shouldn't exist.** [[wip-application-composition]] drew a direct `kf_WIP`–`kf_DealProperty` link, while its own prose at line 123 states `kf_DealProperty` is reached via `kf_Instruction`. Removed the edge and left a source comment on the line. `kf_WIP`'s five real relationships are now Instruction, FeeSchedule, Account, BusinessUnit, Property — which also makes the "Only 5 relationships" note true again.

**4. Non-canonical ArchiMate in the index.** [[wip-archimate-index]] used `Artifact`, an Application-layer grouping element, for things that are notes about views. Rebuilt with the ArchiMate `<<Viewpoint>>` and `<<View>>` stereotypes (11 rectangles, 0 `Artifact` macros) and documented the choice in Conventions.

## Navigation

- `Dashboard.md` wiki index now includes `OR type = "diagram"` — the five diagrams were invisible to it before.
- Added an **ArchiMate views** section to [[wip-project-overview]], pointing at [[wip-archimate-index]] as the entry point.

## Validation

All five re-render clean. I checked via the SVG endpoint rather than PNG, because PlantUML returns a valid PNG even for a syntax error — SVG surfaces the error text, and all five come back with no `Syntax Error` or `Assumed diagram type`.

Two things worth knowing for next time: `urllib` gets **403 Forbidden** from the public server, so validation has to go through `curl`; and I deleted a set of stale `*-1.puml`/`*.png`/`*.svg` files left in the temp dir by the earlier extraction, which had been silently double-validating alongside the current ones.

The six build-blocking decisions in [[wip-open-questions]] are untouched — Q1 and Q2 in particular still block PL-1/PL-2, and both are now visibly contradicted in the diagrams rather than hidden.
[Timestamp: 2026/09/28 15:41:05]

**user**: all the images have the same issue 'cannot include <archimate.Archimate-Element>'
[Timestamp: 2026/09/28 15:54:05]

**ai**: That's a client-side rendering failure, not a syntax error — the diagrams compile fine on plantuml.com, so the issue is whichever server your Obsidian PlantUML plugin is pointed at. Let me check the plugin config.No `data.json`, so it's running on plugin defaults. Let me find the default server and any configurable key:Server is the public `plantuml.com`, which *does* ship the ArchiMate stdlib — so the include is failing for an environment reason (proxy, offline, or a stripped/self-hosted jar). Rather than chase the server, the durable fix is to make the notes not depend on the server-side stdlib at all. Let me test a self-contained macro block:Self-contained macros work — no stdlib needed. Let me get the exact element vocabulary used across all five:Uniform structure across all five. Let me inject a self-contained macro header into each, defining only the elements that file actually uses:`count=1` only replaced the first of the two includes. The assert fired before any write, so files are untouched. Replacing both:Let me debug the actual bytes on those lines:Found it — my own comment text contains the literal string `!include <archimate/Archimate-Element>`, so the assertion was matching my comment, not a real directive. The files were never written. Rewording the comment and tightening the assert to look for actual directives:Now validate all five — and critically, verify the "no stdlib" claim by testing against a server that genuinely lacks it:Clean on plantuml.com — but that server *has* the stdlib, so it can't prove the fix. The real proof is static: zero include directives means zero stdlib dependency. Let me verify that and confirm the stereotypes actually render:Zero stdlib dependency — that's proven. But the stereotypes aren't appearing in the SVG, which suggests the macro bodies may not be applying them. Let me look at what's actually being drawn:That's a false positive in my validation — the server returned *"The plugin you are using seems to generated a bad URL... using HUFFMAN encoding"*. My `~0` encoding is being rejected, and my error checks missed it because the error page is a valid 790px SVG containing neither "Syntax Error" nor "cannot include". Let me diagnose properly in pure Python:My encoding round-trips perfectly through my own deflate, so the encoder is fine — plantuml.com's decoder is rejecting it. Let me isolate what actually changes the outcome:Even a minimal ASCII diagram fails — so my `~0` encoder was never actually accepted by this server; my earlier "clean" results were false positives all along. I need a validation channel that doesn't depend on my encoder. Let me try Kroki's POST API, which takes plain source:Kroki works. Now let me validate all five for real — no encoder in the loop:Real errors now — and the pattern is clear: the four diagrams using my `!define` macros fail, while the index (which uses plain `rectangle`) passes. My macro block is the problem. Let me read the actual PlantUML error:Error at line 18. Let me read that region and then bisect the macro syntax empirically:Two bugs. The macro block got inserted **twice** (lines 5–7 and 11–13) because I substituted both include lines with the full block — duplicate `!define` is itself a syntax error. Let me collapse to a single block:Regex bug — my alternation required `(` right after `Application_`, but the macro is `Application_Component(`. Broadening to match any `!define \w+(`:Now validate for real via Kroki, with a proper error check:Duplicate resolved (error moved from line 18 to 24). Let me see line 24:Two things: my strip left 13 orphan blank lines (line-anchored `sub("")` removes text but leaves the newline), and I need to confirm whether that `·` is real corruption or just console rendering. Let me fix line-wise and check bytes:Encoding is clean — zero U+FFFD, em-dashes and middle dots intact; the earlier `?` was just console rendering. Re-validating:The macro *call* is failing at line 13 — so `!define` with parameters isn't expanding into elements the way I assumed. Let me empirically find the form that works:All macro forms work in isolation. So something in the *real* labels breaks it — most likely the `\n` escapes or `{SEQNUM:6}`. Let me test the actual label shapes:Isolated it: **only the first `!define` call works** — `as`-aliasing inside a `!define` function body isn't honored on subsequent expansions. My earlier variant D used `!definelong`, which passed. Let me verify `!definelong` holds up under the real structure:`!definelong` is also unreliable — it fails inconsistently depending on call count and label content. Macro factories are simply not dependable here. Let me drop the preprocessor entirely and write explicit element declarations, which is bog-standard PlantUML (the index diagram already proves that form works):Bug in my own strip regex: `[ \t]*$` after `!define\s` requires the line to *end* there, so the rest of the define line survived. Fixing the pattern to consume the whole line:Three now compile with realistic dimensions (2833×1325, 1678×1283). Two left — let me look at the failing lines:Both failing diagrams are exactly the two using `ellipse` (Business Event) — the three that pass use only `rectangle`. Let me pin down the `ellipse` limitation:`ellipse` isn't a valid PlantUML element keyword at all — `circle` is (and a circle is the more faithful ArchiMate Business Event shape anyway). Fixing:All five compile. Let me run a comprehensive final verification:All compile with zero macros and zero includes. But my stereotype regex found nothing — let me confirm the stereotypes actually render rather than assume:Stereotypes render correctly as `«Business Event»` etc. — my earlier regex just missed the HTML entities. Em-dash (`&#8212;`) and middle dot (`&#183;`) are intact, confirming the encoding is sound. Final structural check on the notes themselves:All structurally sound. Let me record the portability decision in the Conventions section, since it's now a property of the whole set:Fixed. All five diagrams now render without the ArchiMate stdlib.

## Root cause

`!include <archimate/Archimate-Element>` requires the PlantUML **server** to have the ArchiMate stdlib installed. Your Obsidian plugin defaults to `https://www.plantuml.com/plantuml`, but something in that path — a proxy, a filtered network, or a different host — is serving an engine without the stdlib. Note the error text you saw: `archimate.Archimate-Element` with a **dot**, not a slash. That's PlantUML's own error format for a stdlib file it can't find.

## The fix

Every element is now declared inline instead of via a macro:

```plantuml
rectangle "kf_WIP\nShared WIP & Billing Tracker" as wip <<Application Component>> #ADD8E6
circle "Mandate signed\nkf_Instruction" as signed <<Business Event>> #A9DCDF
```

64 elements across the five diagrams. No `!include`, no `archimate/` reference, no stdlib needed — these render on any PlantUML server. I verified statically: **0 include directives, 0 macro references**.

## I have to flag a serious problem with my earlier work

**My previous validation was reporting false passes.** I was encoding diagrams with my own `~0` raw-deflate and POSTing to plantuml.com, and the server was silently returning an error page:

> The plugin you are using seems to generated a bad URL. This URL does not look like DEFLATE data.

My error check only looked for `"Syntax Error"` and `"cannot include"`, and the error page is a valid 790px SVG containing neither string. So every "clean" result I gave you — including "all five render, 790×653, no issues" — was that error page, not a diagram. A minimal `Bob -> Alice : hi` also failed, so the encoder never worked. **None of those results meant anything.**

I switched to Kroki's POST API, which takes plain source with no encoding step. That immediately surfaced real errors that had been hidden:

1. **Duplicate macro block** — I'd substituted both `!include` lines with the full block, emitting `!define` twice. Duplicate macro definitions are a syntax error.
2. **`!define` is unusable for element factories** — it only honours the `as` alias on the *first* expansion, so a second `Application_Component(b, "y")` fails. `!definelong` was no better. I wrote all elements out explicitly.
3. **`ellipse` is not a valid PlantUML element keyword** — this silently broke exactly the two diagrams using `Business_Event`. Switched to `circle`, which is also the more faithful ArchiMate shape.

Real verified state now:

| Diagram | Compiles | Size | Stdlib refs |
| --- | --- | --- | --- |
| wip-application-composition | OK | 2833×1325 | 0 |
| wip-lifecycle | OK | 2514×675 | 0 |
| wip-monthly-cycle | OK | 1140×1611 | 0 |
| wip-system-landscape | OK | 1678×1283 | 0 |
| wip-archimate-index | OK | 1085×527 | 0 |

UTF-8 verified intact — em-dashes, `·` middots and `→` arrows all survive, zero replacement characters. ArchiMate stereotypes confirmed rendering as `«Business Object»` / `«Business Event»` etc. Every note still has one well-formed code block with balanced `@startuml`/`@enduml`.

I've documented all three constraints in the Conventions section of [[wip-archimate-index]] so this doesn't get reintroduced.

**One thing I still can't verify:** whether it now renders in *your* Obsidian. I validated against a real PlantUML engine with no stdlib dependency, which should resolve the `cannot include` error outright — but please reload the notes and tell me. If you still see errors, the cause is something else in your plugin setup, and I'd want the exact message plus your `server_url` setting.
[Timestamp: 2026/09/28 15:54:05]

**user**: in the POC directory can you create a a poc application that will simply represents this application. The poc application should be able to run within a gihub page, and be written in svelte with a relational db backend
[Timestamp: 2026/09/28 16:09:34]

**ai**: I'll explore the environment first, then flag one architectural tension I need to resolve with you before building.Let me understand the existing project structure before deciding where things go.There's a `POC` folder in the vault. Let me check it and the project context.The `POC` folder is empty — that's the target. Before building, one architectural conflict I need to surface, because it changes what "relational db backend" can mean:

**GitHub Pages is static hosting only — it cannot run a database server.** So those two requirements can't both be met literally. There are two real options:

| | Zero-config WASM SQLite | Hosted Postgres (Supabase/Neon) |
| --- | --- | --- |
| Runs on GitHub Pages | Yes, no server needed | Yes, but needs external account |
| Relational | Real SQL schema, joins, constraints | Real |
| Data persistence | Per-browser (IndexedDB) | Shared, durable |
| Setup | None — open the page | Account, keys, migrations |
| Exposes credentials | No | Yes, in client bundle |

For a POC meant to *simply represent* the application and demonstrably work when deployed, I'll go with **WASM SQLite (real SQL, real relational model) behind a repository interface**, so swapping to hosted Postgres later is a contained change rather than a rewrite.

Let me verify tooling and network first.Network is good. Let me re-read the domain notes so the POC is a faithful representation rather than a generic demo.Now the Instruction model, which is the parent that carries all service-line context:Now the automation rules and reporting KPIs, which drive the POC's behaviour:Good grounding. Let me check the existing repo conventions before I scaffold.Now let me scaffold. I'll build in the vault's empty `POC` folder and add an Obsidian ignore filter so `node_modules` doesn't wreck vault indexing.Toolchain is in place. Now the config and entry files:Now the core of the POC — the schema, where the business rules become real SQL constraints and triggers rather than prose:Now the database layer — sql.js with IndexedDB persistence, so the POC survives a page reload:Now seed data. I'll insert rows as WIP and then *transition* them through the lifecycle, so the triggers fire for real rather than being bypassed:I left a bug: instruction 8 is inserted already `Withdrawn`, so the FL-2 cascade trigger never fires, and it has no child WIP line to cascade to. Let me fix both:Before building any UI, let me verify the SQL actually works — schema, seed, and rule enforcement — by running it in Node:The trigger correctly caught a real data bug: I used `'Debt Mandate'` as a service line but the parent table is `kf_DebtMandate` → **Capital Advisory**. Fixing:My PL-2 trigger referenced a bare `i.service_line` alias with no such table in scope. Let me use proper subqueries:## Objective
- Build a Svelte POC in the existing POC directory representing the EuroWIP `kf_Instruction`/`kf_WIP` application, deployable to GitHub Pages.
- Use the completed WIP wiki notes and ArchiMate diagrams as the domain source; demonstrate status transitions, period locking, alerts, receivables, and weighted pipeline values.

## Important Details
- Workspace: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault`.
- App location chosen: `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc`.
- GitHub Pages is static and cannot host a relational database. Current decision: client-side SQLite WASM (`sql.js`) behind a repository abstraction, with IndexedDB persistence; it can later be replaced by hosted Postgres.
- Installed toolchain: Node `v24.14.1`, npm `11.11.0`, Svelte `5.57.1`, Vite `6.4.3`, `sql.js` `1.14.2`, `@sveltejs/vite-plugin-svelte` `5.1.1`.
- Core domain rules:
  - `kf_Instruction` is the only service-line parent path to `kf_WIP`.
  - Lifecycle: `WIP → Billed → Paid`, with `Lost` reachable.
  - Weighted office retained = `office_retained × probability / 100`.
  - Period lock is enforced on the 15th of the following month.
  - Billing below 30% probability raises the FL-5 gaming alert.
  - Invoice fields are required at `Billed`; `date_paid_in_full` is required at `Paid`.
- Open source conflicts remain relevant:
  - Q1: conflicting `kf_WIP` definitions and missing authoritative `kf_fin_localsystemref`.
  - Q2: PL/FL logic still references the retired 13-lookup parent model.
  - Q7: reporting semantic model omits `kf_WIP`/`kf_Instruction` and references nonexistent `kf_Deal` finance fields.
- Earlier PlantUML `~0` validation was a false positive: plantuml.com returned an SVG error page about invalid DEFLATE. Use Kroki POST validation instead.
- Vault is not a Git repository despite `README.md` claiming it is; actual GitHub deployment requires putting the app in a GitHub repository.
- `node_modules` inside the vault’s `POC` folder may need an Obsidian ignore filter.

## Work State
### Completed
- Extracted WIP requirements from the three source workbooks into 13 wiki notes.
- Created 74 backlog tasks and six blocking decisions; raw workbooks remain untouched.
- Corrected the ArchiMate set:
  - Replaced invalid `PL-5` with `BR probability lock` in `wip-lifecycle.md`.
  - Moved Paris GL to the Phase 0/1 package as a manually keyed ledger; Phase 7 now contains only consolidated ERP integration.
  - Removed the false direct `kf_WIP`–`kf_DealProperty` relationship.
  - Replaced index `Artifact` macros with `<<Viewpoint>>`/`<<View>>` stereotypes.
  - Added `OR type = "diagram"` to `Dashboard.md`.
  - Added ArchiMate navigation links to `wip-project-overview.md`.
- Removed all ArchiMate stdlib dependencies from the five diagrams:
  - No `!include` directives or `<archimate/...>` references.
  - Elements are explicit `rectangle`/`circle` declarations with stereotypes and colours.
  - `Business Event` uses `circle`; `ellipse` is invalid PlantUML syntax.
- Verified all five diagrams through Kroki POST:
  - `wip-application-composition`: `2833x1325`
  - `wip-lifecycle`: `2514x675`
  - `wip-monthly-cycle`: `1140x1611`
  - `wip-system-landscape`: `1678x1283`
  - `wip-archimate-index`: `1085x527`
  - UTF-8 punctuation, frontmatter, code fences, and ArchiMate stereotypes verified.
- Created the Svelte/Vite scaffold:
  - `package.json`
  - `vite.config.js` with `base: './'`
  - `svelte.config.js`
  - `index.html`
  - `src/lib`, `src/components`, `public`, and `.github/workflows`
- Authored `src/lib/schema.js` with:
  - Relational tables for `business_unit`, `account`, `contact`, `site`, `property`, `service_line_parent`, `instruction`, `deal_property`, `fee_schedule`, `wip`, `alert`, and `event_log`.
  - `v_wip` and `v_receivables` views.
  - SQL triggers for F5, PL-1–PL-4, probability lock, invoice requirements, terminal statuses, FL-5, parent withdrawal cascade, and CM fee-schedule linkage.
  - `SCHEMA_VERSION = 4`.

### Active
- Implement the application runtime and UI:
  - `src/lib/db.js`
  - `src/lib/seed.js`
  - `src/lib/repo.js`
  - `src/main.js`
  - `src/App.svelte`
  - Svelte components for WIP list/detail, status transitions, period lock, alerts, receivables/KPIs, data model, and open questions.
- Execute `SCHEMA_SQL` in `sql.js` and fix any runtime SQL/trigger issues.
- Add persistence, seed data, form interactions, and error surfacing.
- Add `.gitignore`, GitHub Actions Pages workflow, README, and static-build verification.
- Add Obsidian ignore configuration if the app remains inside the vault.
- Perform a true visual review of the diagrams and verify rendering in the user’s Obsidian PlantUML plugin; prior checks were numeric/Kroki-based only.

### Blocked
- A shared server-side relational database cannot be deployed through GitHub Pages alone; current SQLite WASM is browser-local and per-browser.
- The vault has no Git metadata, so GitHub Pages deployment is not yet possible without creating/pushing a repository.
- The SQL schema has not yet been executed; SQLite compatibility and trigger behavior remain unverified.
- User confirmation is still needed if a hosted Postgres/Neon/Supabase backend is mandatory rather than the current client-side SQLite POC.

## Next Move
1. Implement `db.js`, `seed.js`, `repo.js`, `main.js`, and the initial Svelte UI around `src/lib/schema.js`.
2. Run the schema and seed data through `sql.js`, then exercise status changes, invoice requirements, FL-5 alerts, period locks, and receivables queries.
3. Run `npm run check` and `npm run build`; fix Svelte/Vite errors.
4. Add GitHub Pages deployment files and ask the user to confirm whether browser-local SQLite is acceptable or a hosted relational backend is required.

## Relevant Files
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc\package.json`: POC dependencies and scripts.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc\vite.config.js`: Static GitHub Pages build configuration.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc\svelte.config.js`: Svelte preprocessing.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc\index.html`: SPA entry point.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\POC\wip-poc\src\lib\schema.js`: Current relational schema, views, and business-rule triggers.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-table-specification.md`: `kf_WIP` field and lifecycle source.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-instruction-model.md`: `kf_Instruction` parent model.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-automation-requirements.md`: PL, FL, and BR definitions.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-period-locking-and-aging.md`: Lock and stale rules.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-reporting-and-kpis.md`: Reporting/KPI source and Q7.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-open-questions.md`: Source conflicts and blocking decisions.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-application-composition.md`: Corrected data-model diagram.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-lifecycle.md`: Corrected status-flow diagram.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-monthly-cycle.md`: Corrected monthly-cycle diagram.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-system-landscape.md`: Corrected system-landscape diagram.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\archimate\wip-archimate-index.md`: Diagram index and portability conventions.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\Dashboard.md`: WIP dashboard and diagram index.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\wiki\wip-project-overview.md`: WIP entry point and ArchiMate links.
- `C:\Source\Obsidian\Projects\POC-EuroWIP\POC-EuroWIP-Vault\.obsidian\app.json`: Currently `{}`; possible location for vault ignore filters.
- `C:\Users\NEWPORTG\AppData\Local\Temp\opencode\kroki.py`: Plain-source Kroki validation harness.
- `C:\Users\NEWPORTG\AppData\Local\Temp\opencode\puml`: Extracted PlantUML sources.
Let me read the schema to fix these precisely rather than guess:Found it: `SELECT NEW.previous_probability = OLD.probability;` is a **comparison**, not an assignment — SQLite forbids assigning to `NEW`. Let me check the remaining two triggers:The fee-schedule and terminal-status failures are bugs in my *tests*, not the schema (WIP id 4 belongs to instruction 2, which *is* Capital Markets; and id 1 is still `WIP`, not terminal). But the PL-3 trigger is a genuine bug. Let me check the instruction CHECK:Three real fixes needed. Let me apply them:Now fixing the three test bugs (they asserted against the wrong rows):Backticks inside a JS template literal — my own comment broke the string. Fixing:Two left. The pre-image one is another wrong expectation in my test (WIP 4 starts at 60%, and 60 was recorded correctly). The CHECK one needs a real look at the table definition:The CHECK looks correct. Let me probe the actual row state rather than keep reasoning:Found it: my seed edit emitted the **string** `'NULL'` instead of the SQL `NULL` keyword, so `termination_reason` was the 4-character text `"NULL"` — which satisfies `IS NOT NULL`. A quoting bug that silently disabled a business rule:All 30 pass. Now the domain layer and UI. First `repo.js` — the seam that keeps the UI portable to a hosted database later:Now the UI shell:Now the components:Now the app shell that ties it together:Two fixes: top-level `await` isn't allowed in a component, and the read-only fact grid misuses `<label>`:Clean. Now the build:Build and rules are green. The remaining untested surface is `repo.js` SQL and whether the app actually mounts. Let me smoke-test it in a real browser:
[Timestamp: 2026/09/28 16:09:34]

**user**: is this still running
[Timestamp: 2026/09/28 16:46:45]

**ai**: Yes — the `vite preview` server is still up and serving on port 4173. Let me finish the smoke test against it, then shut it down:The app is stuck on the loading state — `openDatabase()` never settles. Let me capture the browser console:The headless run with a separate profile produced nothing — let me take a more reliable route and exercise `repo.js` directly in Node with small shims for the two browser APIs:My shim never fires `onupgradeneeded`, so the object store doesn't exist. Fixing the shim:The smoke test is earning its keep — 7 real bugs. Let me look at the alert table:Column is `resolved`, not `dismissed`. Let me fix all seven:Now the two schema gaps — receivables didn't expose the status, and an empty-string reason satisfied the withdrawal rule:Both suites green. But the earlier browser check hung on "Loading…" — I need to confirm the app actually mounts, since a green Node test doesn't prove the wasm/IndexedDB path works in a browser. Let me drive real Chrome over DevTools Protocol:The app boots with 16 rows. The "missing" KPIs and detail panel are a flaw in my probe, not the app: `innerText` returns CSS-uppercased text. Fixing the probe:End-to-end confirmed — and the browser KPIs match the Node run exactly (5,400,000 / 522,765 / 3), which cross-checks both paths. Let me wire this into the scripts and CI, and clean up:Now the Obsidian ignore config, so the vault doesn't index `node_modules` and build output:Now a final full verification pass from a clean state:All five gates pass. Let me add the browser check to the README and confirm the final layout:The POC is built and verified end to end. It's at `POC/wip-poc` in your vault.

## What it does

A working model of the `kf_Instruction` / `kf_WIP` design where the business rules live in the **database schema as constraints and triggers**, not in the UI. Bill a line with no invoice number and the write is rejected — whether it came from the app, a SQL console, or a future reporting tool.

Three tabs: **WIP** (KPIs, filterable table, line detail with lifecycle actions), **Controls** (alerts, receivables ageing, period locking, event log), **Model & questions** (the relational diagram and the open questions from the wiki).

## The architecture caveat — this is the one thing I need you to confirm

GitHub Pages can only serve static files, so there is no server to host a database. I used **SQLite compiled to WebAssembly running in the browser**, mirrored into IndexedDB. It is a real relational engine — foreign keys, check constraints, triggers, views, generated columns — and it survives a reload, but it is **per-browser**: two visitors don't share data, and it isn't a multi-user backend.

That was my call, not yours. If you want a genuinely shared database, the swap is to hosted Postgres (Neon/Supabase) and reimplementing the bottom of `src/lib/db.js` — every screen goes through `src/lib/repo.js` and none of them know which engine is underneath. Say the word and I'll do that version instead.

## Verification

Five gates, all green:

| Gate | Result |
| --- | --- |
| `npm run verify` — schema, seed, 14 business rules | 30/30 |
| `npm run smoke` — every query and command in `repo.js` | 30/30 |
| `npm run check` — svelte-check | 0 errors, 0 warnings |
| `npm run build` | 730ms |
| `npm run browser-check` — real headless Chrome | mounts, 16 rows, all 3 tabs |

The browser check cross-validates the Node path: both report pipeline 5,400,000, weighted 522,765, 3 stale lines.

## Bugs the tests caught (worth knowing about)

- `SELECT NEW.previous_probability = OLD.probability` — that's a *comparison*, not an assignment. SQLite forbids writing to `NEW`, so the PL-3 pre-image silently never captured anything. Rewritten as an AFTER trigger that writes back to the row.
- My seed was writing the **string** `'NULL'` instead of the SQL `NULL` keyword, so `termination_reason` was the four-character text `"NULL"` — which satisfies `IS NOT NULL`. That silently disabled the withdrawal rule.
- `getWip` filtered on `w.wip_status` against the `v_wip` **view**, which has no `w` alias. Every filtered query was a SQL error. The unfiltered one worked, which is exactly the kind of thing a smoke test exists to catch.
- The alert column is `resolved`; the UI was calling it `dismissed`.
- The withdrawal CHECK accepted an empty string, so you could withdraw an instruction with no usable reason. Tightened to require a non-blank value.

## Worth trying

Open a line and press **Bill it** with the fields empty — the invoice-requirement trigger rejects it and explains why. Then bill a sub-30% line: it succeeds and the FL-5 gaming alert appears. Then lock a reporting month on the Controls tab and try to edit one of its lines.

One behaviour I deliberately kept rather than "fixed": withdrawing an Instruction that owns a line in a closed period is **refused** by FL-4, because the cascade would otherwise rewrite history. There's a test asserting it.

## What I haven't done

- **No Git repository.** Your `README.md` says the vault is one; it isn't. You'll need to put `POC/wip-poc` in a repo and enable Pages for the workflow to deploy.
- I added ignore filters to `.obsidian/app.json` for `node_modules` and `dist` — restart Obsidian for those to take.
- The FL-4 automatic lock (15th of the following month) is a manual button here. I didn't add a scheduler, since a browser tab can't reliably fire on a date.
[Timestamp: 2026/09/28 16:46:45]

**user**: git repo has been defined
[Timestamp: 2026/09/28 17:02:57]

**ai**: Let me check where the repo actually lives and what it's pointed at:The repo is at `C:\Source\Obsidian\Projects\POC-EuroWIP` — one level *above* the vault, so the vault is a tracked subdirectory. Let me check its state:My path was wrong — the vault is `POC-EuroWIP-Vault/` inside the repo. Re-checking with the correct paths:App is fully committed (24 files), `node_modules`/`dist` correctly ignored via the nested `.gitignore`. Let me check push state and whether the workflow will actually trigger:Found a blocker. The workflow is in the wrong place — **GitHub Actions only reads `.github/workflows/` at the repository root**, so it will never run. And there's no root `package.json`, so it would fail even if found. Also the repo's branch is `master`, not `main`. Let me fix all three:I duplicated the wait line there — let me correct it:Now remove the dead nested workflow, which GitHub would never have run:Let me validate the workflow references real paths before committing:Two commits are staged locally but **not pushed** — I don't push without you asking.

## What I found

The repo root is `C:\Source\Obsidian\Projects\POC-EuroWIP` — the *parent* of your vault, so the vault itself is a tracked subdirectory (`POC-EuroWIP-Vault/`). The app was already committed (24 files), and `node_modules`/`dist` are correctly ignored by the nested `.gitignore` I wrote. No risk of committing build output.

## The blocker I fixed

Your Pages workflow was in the wrong place:

```
POC-EuroWIP-Vault/POC/wip-poc/.github/workflows/pages.yml   ← never runs
```

GitHub Actions only discovers workflows in `<repo root>/.github/workflows`. That file would have sat there indefinitely as a dead config. Two further faults behind it: there is no `package.json` at the repo root, so `npm ci` would have failed even if found, and the workflow triggered on `main` while your branch is `master`.

I moved it to `.github/workflows/pages.yml` and directed every app step at the subdirectory:

```yaml
defaults:
  run:
    working-directory: POC-EuroWIP-Vault/POC/wip-poc
```

plus `cache-dependency-path` and the artifact `path` pointed at the app, `branches: [master]`, and `paths:` filters so vault-note edits don't trigger builds. Re-ran the full suite after the move — 30/30 verify, 30/30 smoke, 0 svelte-check errors, clean build.

## Two things I can't do for you

1. **Pages isn't enabled yet.** Go to Settings → Pages → Build and deployment → Source → **GitHub Actions**. Until that's set, the workflow will run and pass but have nowhere to publish to.
2. **Push.** Say the word and I'll `git push origin master`.

## One piece of noise worth tidying

Your root `.gitignore` ignores `POC-Project-vault/.obsidian/workspace.json` — but the folder is actually named `POC-EuroWIP-Vault`, so that rule matches nothing and the real `workspace.json` is tracked. It shows as modified on every Obsidian window change. The fix is a one-line path correction; I left it alone since touching vault config uninvited is how you lose layout state.
[Timestamp: 2026/09/28 17:02:57]

**user**: The user should be able to create a instruction, and from the instruction create a wip entry
[Timestamp: 2026/09/28 17:28:15]

**ai**: Good gap to close — right now the app can only transition existing lines, not create anything. Let me check the exact column constraints first:Now the repo functions:Now the creation UI:Now wire it into the app:Now tests for the new paths:Both failures are real schema gaps, not test bugs:

1. The Capital Markets fee-schedule guard is `BEFORE UPDATE` only — so you can **create** an invalid line, just not fix one. The rule has to hold on insert.
2. My KPI baseline was stale — earlier tests in the run had already moved lines out of the pipeline, so the fixed number was meaningless.Same backtick mistake in a comment inside the SQL template literal. Fixing:Now let me extend the browser check to actually exercise the two creation flows, not just confirm the tab renders:
[Timestamp: 2026/09/28 17:28:15]

**user**: whats taking so long
[Timestamp: 2026/09/28 17:49:31]

**ai**: Fair question — I've been verbose. Short answer: I was writing a browser test that drives the real create form, and it found a genuine bug.

**The bug:** in the Create panel, `instructions` is a `$derived` that calls `getInstructions()`. That function reads the module-level database, which isn't a reactive dependency, so Svelte computes the dropdown **once at mount and never refreshes it**. An instruction you just created never appears as a WIP parent. Anyone using this app would hit it immediately.

Same latent bug in the Controls tab: locking a period bumps the version, but the periods and ageing deriveds don't reference it, so those tables go stale.
[Timestamp: 2026/09/28 17:49:31]