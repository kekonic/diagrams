# Product Marketing Context

**Document version:** v1.3
**Last updated:** 2026-08-27

_Drafted from public product copy (homepage, README, choose page, docs, ROADMAP) and package metadata. No customer interviews, win/loss notes, or usage metrics were available. Sections that infer from that copy — especially personas, objections, switching dynamics, and goals — need a human pass._

## Product Overview

**One-liner:** Beautiful, interactive diagrams from text.

**Job line:** Describe the system. Get the diagram.

**What it does:** You name the things that matter — services, events, decisions, tables, sequences — and describe how they relate in a readable `.kdiagram` file. Kekonic Diagrams measures labels, places nodes, routes connections, and redraws whenever the source changes. The same source becomes a portable SVG, a live browser diagram, or an animated explanation, and a coding agent can draft it from the repository with the official skill.

**Product category:** Architecture-as-code / diagram-as-code for software systems (text-to-diagram). Customers search for Mermaid alternatives, architecture diagrams in Git, C4-from-code, and “diagrams that look good from text.”

**Product type:** Open-source developer tool: MIT-licensed language, SDK, CLI, hosted/local Studio, VS Code extension, Markdown/build adapters, and an agent skill. Not a SaaS. Hosted Studio stores no account data or cloud documents.

**Business model:** Free MIT open source. Nothing to buy: no paid plans, usage limits, commercial license upsell, or paid support product for Kekonic Diagrams itself. Packages on npm (`@kekonic/diagrams*`), CLI as `kdiagrams`, first-party VS Code / Open VSX extension, Homebrew tap planned after stable tagged releases. Pin exact package versions for production; current line is `1.0.0-rc.*`.

**Possible future paid product (not this repo):** If Kekonic ships a paid offering later, it would be a separate SaaS that *uses* Kekonic Diagrams, not a license or support fee for the open-source tool. Do not market Kekonic Diagrams as freemium, “open core,” or “contact sales.”

**Status:** Public 1.0 release candidate (`1.0.0-rc.7` in-repo at draft time). Near-term work hardens the foundation for stable 1.0 rather than growing language surface.

**Site / surfaces:**
- Docs and Studio: https://diagrams.kekonic.com
- GitHub: https://github.com/kekonic/diagrams
- Agent skill: `npx skills add kekonic/diagrams`

## Target Audience

**Target companies:** Software teams that keep architecture, events, workflows, data models, and request traces in the same repositories as the code — typically product engineering orgs (startup through mid-size) with docs sites, READMEs, and CI already in the toolchain. JavaScript/TypeScript-first runtime; Node ≥ 22.18.

**Decision-makers:** Staff/principal engineers, software architects, platform/docs engineers, and engineering managers who own “how we document systems.” Individual contributors adopt Studio, the CLI, and the agent skill without procurement.

**Primary use case:** Keep software-system diagrams as reviewable text that layout, routing, and publishing can turn into presentation-quality output — without storing coordinates.

**Jobs to be done:**
- Maintain architecture and flow diagrams that stay readable in Git diffs and survive real edits.
- Have a coding agent draft a diagram from the repo without inventing services to fill gaps.
- Publish one source to README, wiki, docs site, CI artifacts, and interactive apps.

**Use cases:**
- Software architecture and service maps
- Event-driven systems and data pipelines
- Operational and business workflows
- Database relationships (ERD)
- Request traces and sequence diagrams
- State machines (first tranche shipped)
- DDD / C4-style views (Context, Container, Component as ordinary diagrams — not a Structurizr dialect)
- Diagrams that live in repositories, documentation, and CI
- Agent-assisted authoring from repository facts

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| User (software engineer / architect) | A diagram that answers one reader question and is cheap to change | Redrawing boxes after every system change; source that is unreadable in PRs | Semantic source, automatic layout, same file in Studio / editor / CLI |
| Champion (staff engineer, docs/platform owner) | Diagrams as part of the documentation system, not slide decks | Mermaid looks generic; canvases rot; agents invent topology | Software-specific language, portable SVG, grounded agent skill, CI check/render |
| Decision maker (eng manager / architect) | Onboarding, review quality, less tribal knowledge | Diagrams that lie about the system or never get updated | Reviewable model diffs, agent notes that separate facts from assumptions |
| Technical influencer (docs/platform engineer) | Toolchain fit: Markdown, Vite, Astro, CI, VS Code/Cursor | Another renderer that needs custom glue and breaks in CI | First-party CLI, remark/markdown-it, unplugin, web component, React, language service |
| Financial buyer | N/A for Kekonic Diagrams | Budget process does not apply to an npm + Studio workflow | MIT, no account, no support SKU; any future SaaS is a separate product |

## Problems & Pain Points

**Core problem:** Software-system diagrams are either freeform pictures that rot, or text diagrams whose layout and look are not good enough for the places readers actually see them.

**Why alternatives fall short:**
- Drawing canvases (Figma, Excalidraw, diagrams.net) optimize spatial exploration. They store coordinates, so structural edits are expensive and pull-request review is a screenshot.
- Mermaid is the default in Markdown platforms, but it is a general diagram toolkit: weaker software-specific semantics, less layout control, and output that often looks generic when architecture quality matters.
- PlantUML covers UML breadth and Java-centric tooling; it is not focused on measured software-system layout, portable interactive SVG, or a grounded agent workflow.
- Generic “ask an LLM to draw architecture” invents boxes to complete the picture. Reviewers cannot tell what came from the repo.

**What it costs them:** Time redrawing after every change; onboarding from stale pictures; PR comments on pixels instead of model changes; agents that hallucinate topology; docs that cannot reuse one source across README, site, and app.

**Emotional tension:** Doubt that the diagram still matches the system. Embarrassment when a “pretty” architecture slide is wrong. Reluctance to adopt another dialect if Mermaid already “just works” in GitHub.

## Competitive Landscape

**Direct:** Mermaid — largest ecosystem and easiest default in Markdown platforms; falls short when software-specific semantics, layout/crossings, portable themed SVG, interactive stories, and a grounded agent skill are the actual problem. Kekonic Diagrams is not a Mermaid dialect and does not import Mermaid source.

**Direct:** PlantUML — UML breadth, mature sequence syntax, Java tooling; falls short for JS-first teams that want measured layout, animation, and Git-native software-system source rather than comprehensive UML.

**Secondary:** Architecture-as-code tools (Structurizr, C4-PlantUML, LikeC4, IcePanel) — same “model the system” job with different languages and hosts. Kekonic Diagrams treats C4 as ordinary diagrams using `person` / `system` / `container` / `component` / `external`, not a Structurizr dialect. No C4 **code** (UML class) view.

**Secondary:** Other text-to-diagram languages (D2, Graphviz) — graph-from-text, weaker software vocabulary and publishing/agent story as documented here.

**Indirect:** Drawing canvases (Figma, Excalidraw, diagrams.net, Lucidchart, Miro) — workshops, ideation, unrestricted composition. Kekonic Diagrams does not give pixel coordinates; you cannot drag a box three pixels left.

**Indirect:** Hand-maintained slides and wiki screenshots — no source of truth, no CI.

## Differentiation

**Key differentiators:**
- Meaning, not coordinates: `.kdiagram` files contain a system model (kinds, groups, calls vs events) rather than stored `x`/`y`.
- Software-specific language: clients, gateways, services, brokers, databases, decisions, outcomes; `->` vs `=>` vs `..>` vs `-x`; tables with fields, keys, cardinality.
- Visual-quality moat: measured ELK layout, orthogonal/metro routing, crossing treatment, label placement, content-aware sizing, icons, coordinated themes.
- Structural layout controls in source: groups participate in layout (`arrange`, spans, density, crossings) — not decorative boxes after the fact.
- Diagram stories: animation blocks over existing nodes/edges; browser playback.
- One source, many destinations: portable snapshot SVG, `<k-diagram>` web component, React live/playground, remark/markdown-it fences, unplugin imports, CLI/CI.
- Grounded agent skill: inspect the repo, write `.kdiagram`, run `kdiagrams check` / `render` / `analyze`; missing facts stay in notes, not extra boxes.
- Git-native review: a PR can show that an interaction became an event; CI renders SVG for readers who only need the picture.
- Honest fit: public “Is Kekonic Diagrams right for you?” page names when Mermaid, PlantUML, or a canvas is the better starting point.

**How we do it differently:** Compile semantic intent, then measure, lay out, route, and render. Themes change appearance, not meaning. Studio presentation controls write back to the DSL instead of hidden editor state. Agents get expertise and deterministic CLI feedback, not just syntax.

**Why that's better:** Structural edits stay cheap; diffs are about the system; output is good enough for docs and talks without a designer pass; agents can be reviewed like code.

**Why customers choose us:** (inferred — unvalidated) They need architecture/event/workflow/ERD/sequence diagrams in Git, they care how routed software diagrams look, and they want agents that refuse to invent topology.

## Objections

| Objection | Response |
|-----------|----------|
| “GitHub already renders Mermaid.” | Use Mermaid when the platform default is enough. Choose Kekonic Diagrams when layout, software semantics, portable SVG, stories, or grounded agents are the constraint. Evaluate on one painful real diagram, not the demo. |
| “I need to drag boxes / pixel-nudge.” | That is a canvas job. The bargain is less manual control for source that stays readable and cheap to change. Studio is a source editor, not a whiteboard. |
| “Another DSL to learn; PlantUML/C4 already covers this.” | The language is focused (architecture, events, workflows, ERD, sequence, state), not UML-complete. C4 Context/Container/Component are ordinary diagrams, not a dialect. Teammates should understand source without learning the whole language — that is the evaluation test. |
| “Automatic layout will look bad on my graph.” | Dense or weakly structured graphs can still look poor. The fix is usually clarify the model, split the view, or add real groups — not knobs until it resembles a hand drawing. |
| “RC / young project / small ecosystem.” | True: 1.0 RC, MIT, smaller ecosystem than Mermaid. Pin versions. Judge CLI, Studio, VS Code, and one CI render path on a real file. |
| “Will this lock us to a host?” | Hosted Studio needs no account. Files are ordinary UTF-8. Same source in local Studio, VS Code/Cursor, any editor + CLI. |

**Anti-persona:**
- Teams whose deciding factor is unrestricted composition, workshops, or art direction (use a canvas).
- Teams that need Gantt, mind maps, general charts, or comprehensive UML.
- Teams that need Mermaid compatibility or a built-in renderer on a Markdown host and will not add a toolchain.
- Teams that need collaborative cloud whiteboards or account-based document hosting.
- Teams that need rendering targets other than SVG without building their own integration.

## Switching Dynamics

**Push:** Stale canvas diagrams; Mermaid output that looks generic or fights architecture layout; PRs that cannot review diagram meaning; agents that hallucinate services.

**Pull:** Semantic source with software kinds; layout/routing quality; one file to SVG, live embed, and animation; agent skill that reports assumptions; no account required to try Studio.

**Habit:** Mermaid already works in GitHub/GitLab; Excalidraw/Figma files already exist; “good enough” screenshots in the wiki; muscle memory for PlantUML sequence syntax.

**Anxiety:** Learning a new language; layout looking worse than the hand-drawn original; RC stability and ecosystem size; adding CLI/CI to the docs pipeline; giving up pixel control.

## Customer Language

**How they describe the problem:**
- _(no verbatim customer quotes on file)_
- Product-adjacent phrasing we already use: diagrams that “rot”; “x and y coordinates to maintain”; “freeform drawing”; “invented box”; “generic” diagram-as-code.

**How they describe us:**
- _(no verbatim customer quotes on file)_
- Own phrasing to test: “beautiful, interactive diagrams from text”; “describe the system; get the diagram”; “meaning, not coordinates”; “a diagram change can be reviewed as a model change”; “grounded in the repo”; “diagram-as-code does not have to look generic.”

**Words to use:**
- Kekonic Diagrams (product name)
- `.kdiagram` (file extension and Markdown fence language)
- source, model, layout, route, render
- portable / snapshot SVG
- Studio (hosted or local)
- software-specific, semantic, grounded (agents)
- architecture, events, workflows, sequences, tables/ERD

**Words to avoid:**
- **KDiagrams** (never)
- **KDiagram** as product or brand name on marketing, homepage, or splash (allowed only in existing deep language-reference docs)
- Calling the product “the kdiagrams file” (CLI is `kdiagrams`; files are `.kdiagram`)
- Claiming Mermaid compatibility, comprehensive UML, C4 code view, or Structurizr dialect
- Hype: revolutionary, magic, “just works for every graph”
- Presenting `apps/website` private Astro hosts as user-facing APIs
- Implying Kekonic Diagrams has pricing, paid support, seats, or a freemium upgrade path
- Framing a future SaaS as “Kekonic Diagrams Pro” or paid access to this open-source toolchain

**Glossary:**
| Term | Meaning |
|------|---------|
| Kekonic Diagrams | The product. |
| `.kdiagram` | Source file extension and fence language (` ```kdiagram `). Not the product name. |
| `kdiagrams` | CLI binary (`kdiagrams check`, `render`, `studio`, …). |
| `@kekonic/diagrams` | Default SDK package; related packages use the `-cli`, `-element`, `-ui`, `-agents`, etc. suffixes. |
| Studio | Browser authoring: hosted at `/studio/` or `kdiagrams studio` locally. Source editor with presentation controls, not a canvas. |
| `design-kekonic-diagrams` | Official agent skill (`npx skills add kekonic/diagrams`). |
| Snapshot SVG | Self-contained SVG with theme tokens inlined; works in README/wiki without Kekonic CSS/JS. |
| Live host | Interactive browser view (`<k-diagram>`, React) with pan/zoom/theme/playback. |
| KDiagram | Legacy short name in some language-reference docs only — not a marketing name. |

## Brand Voice

**Tone:** Direct, precise, and honest about tradeoffs. Confident about visual quality without hype. Technical enough for engineers; readable without a language-reference dump.

**Style:** Lead with the job (“describe the system”). Short sentences. Show a real `.kdiagram` snippet early. Name competitors and when to pick them. Prefer “the bargain is…” over superlatives. CTAs are actions: Open Studio, Get started, Install the skill.

**Personality:** Editorial, opinionated, craftsmanlike, trustworthy, software-native.

**Proof in voice:** The choose page is canonical. Do not outrun it in ads or landing pages.

## Proof Points

**Metrics:** None published (GitHub description/stars unset at draft time). Do not invent adoption numbers.

**Customers:** None listed.

**Testimonials:** None listed.

**Shipped evidence (use as product proof, not social proof):**
- 1.0 RC line: architecture, event, workflow, ERD, sequence, state source; measured ELK layout; orthogonal routing; crossings; labels; static + interactive SVG; stories; themes; icons; CLI; Studio; language service; VS Code extension; agent skill; Markdown and unplugin adapters.
- Evaluation recipe already in docs: rebuild one painful real diagram; can a teammate read the source; does a realistic edit yield a useful layout; is the SVG good enough; can the build own render.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Looks like a designed architecture diagram, from text | Homepage visual system example; gallery; theme/icon vocabulary; “diagram-as-code does not have to look generic” |
| Cheap to change, reviewable in Git | Diff example (`->` to `=>`); “meaning, not coordinates” |
| One source, many destinations | Publish matrix: SVG, web component, React, Markdown, unplugin, CI |
| Agents that don’t invent the system | Skill workflow + `kdiagrams check` / `analyze`; “missing facts stay in the notes” |
| Honest fit | [Is Kekonic Diagrams right for you?](https://diagrams.kekonic.com/start/choose/) |

## Goals

**Business goal:** Reach stable 1.0 as the best architecture-as-code authoring and presentation environment for software systems — advantage from intelligent authoring, stable automatic layout, reusable system models, and excellent output, not keyword count. Kekonic Diagrams stays free MIT. Revenue, if any, comes from a separate SaaS that builds on this stack, not from selling the diagrams product or paid support for it.

**Product principles that constrain marketing:**
1. Protect the visual-quality moat.
2. Treat source as a system model.
3. Make writing, reviewing, embedding, and exporting excellent in tools developers already use.
4. One pipeline (parse → compile → layout → route → render).
5. Extension seams over core vocabulary growth.
6. Agents get expertise and feedback, not just syntax.

**Conversion action:** Try one real diagram — Open Studio (no account), or `npx skills add kekonic/diagrams`, or `npx @kekonic/diagrams-cli studio` / quickstart. Secondary: install VS Code extension, add CLI check/render in CI, embed SVG.

**Current metrics:** Unknown. Fill in: Studio sessions, npm downloads, skill installs, extension installs, GitHub stars, docs traffic, “chose us over Mermaid” qualitative wins.

## Changelog

*Newest first. One line per revision: what changed and why.*
- v1.3 (2026-08-27) — Clarified business model: Kekonic Diagrams is free MIT with nothing to buy (no paid support SKU); any future paid product would be a separate SaaS that uses this stack.
- v1.2 (2026-08-27) — Restored “Beautiful, interactive diagrams from text.” as primary one-liner / homepage H1; “Describe the system. Get the diagram.” kept as the job line under it.
- v1.1 (2026-08-27) — Primary one-liner shifted to “Describe the system. Get the diagram.” (homepage/README); previous beauty line kept as alt. Homepage argument reordered: bargain → visual quality → capabilities → agents → publish.
- v1 (2026-08-27) — Initial context auto-drafted from README, homepage, choose page, docs, ROADMAP, and packages so other marketing skills have a shared positioning source.
