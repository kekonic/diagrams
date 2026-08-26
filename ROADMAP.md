# Kekonic Diagrams Roadmap

KDiagram aims to be the best architecture-as-code authoring and presentation environment for
software systems. Its advantage should come from intelligent authoring, stable automatic layout,
reusable system models, and excellent output—not from having the longest list of diagram keywords.

This roadmap records product direction, not promised release dates. The order within a horizon is
directional and may change as real users expose better opportunities. Shipped behavior belongs in
[CHANGELOG.md](CHANGELOG.md). Current behavior belongs in public documentation, package contracts,
and tests; durable architecture decisions should live in focused architecture records rather than
an evergreen speculative product specification.

## Product principles

1. **Protect the visual-quality moat.** Measurement, layout, routing, crossings, labels, and
   presentation quality take precedence over vocabulary breadth.
2. **Treat source as a system model.** A diagram should become a view of reusable semantic source,
   not an isolated picture that must be copied to explain the same system differently.
3. **Make the normal workflow excellent.** Writing, reviewing, embedding, and exporting KDiagram
   should feel complete in the tools developers already use.
4. **Keep one pipeline.** Editor integrations, adapters, build plugins, and new render targets must
   feed the public parse → compile → layout → route → render architecture rather than fork it.
5. **Prefer extension seams over core growth.** Custom kinds, shapes, themes, importers, and tooling
   should be able to grow without permanently expanding the core language.
6. **Give agents expertise and feedback, not just syntax.** Agent integrations should teach how to
   choose and refine an effective diagram, then use deterministic KDiagram tools to verify the
   result.

## Current foundation

The 1.0 release-candidate line already establishes:

- semantic architecture, event, workflow, ERD, and sequence source
- measured ELK layout, orthogonal routing, crossing treatment, and label placement
- static and interactive SVG through Node, CLI, Lit, and React
- animation stories, pan/zoom, themes, icons, formatting, and structured diagnostics
- registries for themes, icons, shapes, and semantic node types

Near-term work should harden this foundation for stable 1.0 instead of introducing a broad new
language surface.

## Maintenance gates before new product surface

Complete these cleanup initiatives before building substantial CLI, language-service, or editor
surface. The goal is to stop experiments and obsolete planning artifacts from becoming accidental
compatibility constraints.

### Retire the unsupported renderer experiment — completed

The pre-1.0 alternate renderer and its studio integration were removed completely. Release
configuration, pending release metadata, dependencies, documentation, and generated package-manager
state now describe only supported rendering surfaces. Previously published release-candidate
artifacts remain part of registry and Git history but are explicitly deprecated.

### Retire the monolithic project specification — completed

The early project specification was removed after its durable contracts were verified and reduced
to focused architecture notes. Package and pipeline boundaries, option precedence, determinism,
diagnostics, and trust boundaries now live in `docs/architecture/`; package usage stays in package
READMEs, user behavior stays in public reference docs, and product sequencing stays in this roadmap.

Completed cleanup:

- removed the milestone, POC, speculative API, duplicated language-reference, and implementation
  narrative
- replaced every active link with a focused architecture or public-reference destination
- removed release-state and speculative prose from contributor docs and public READMEs
- verified docs builds, internal links, package builds, tests, and browser bundle boundaries

### Audit other pre-1.0 experimental residue — completed

The release-candidate surface was audited across public exports, CLI flags, source grammar, private
studio state, documentation routes, generated assets, package metadata, and dependencies.
Ownerless renderer-selection/profile APIs, unreachable removed-flag handling, private storage
migrations, and unused aliases were removed atomically with their consumers, tests, and docs.

Intentional shape vocabulary, documentation redirects, and the repository-only studio save hook
remain because they serve current authored source, published inbound links, and local development.
Their contracts and boundaries are recorded in
[supported extension surfaces](docs/architecture/supported-extension-surfaces.md).

## Next: make the CLI trustworthy and pleasant

The CLI is both a human interface and the stable automation surface for editors, build plugins,
CI, and agents. Its input grammar, stream behavior, output portability, and exit semantics should
be settled before stable 1.0 when practical; these contracts become disproportionately expensive to
change later.

The language service should supply diagnostics, formatting, capabilities, and future fixes. The CLI
should own argument parsing, file discovery, batch orchestration, terminal presentation, and process
behavior. An LSP server may ship as `kdiagrams lsp --stdio`, but ordinary CLI commands should call
the shared language-service API directly rather than communicating through the LSP protocol.

### Predictable input discovery — completed

The CLI now uses one consistent resolver across commands:

- accept one or more files, directories, and quoted glob patterns
- recursively discover `.kdiagram` files in directories with stable ordering
- support explicit exclusions and a project ignore file using familiar Git-ignore semantics
- accept options before or after inputs
- read diagram source from stdin when `-` is supplied or when no input is supplied and stdin is
  piped
- accept `--stdin-filename` so diagnostics and relative resolution remain meaningful
- distinguish diagram source on stdin from a list of paths through an explicit `--files-from` mode

Batch commands behave naturally:

```bash
kdiagrams check .
kdiagrams check "docs/**/*.kdiagram" "examples/**/*.kdiagram"
kdiagrams format diagrams/ --check
kdiagrams format diagrams/ --write
kdiagrams render diagrams/ --out-dir public/diagrams
git ls-files "*.kdiagram" | kdiagrams check --files-from -
```

For `render`, a single input may write SVG to stdout or `--output`. Multiple inputs require an
output directory or output template; unrelated SVG documents are never concatenated onto one
stream. The default output template preserves the input directory structure, and explicit template
collisions fail before rendering.

### Real Unix stream behavior — completed

Define and test the stream contract explicitly:

- stdout contains only the requested artifact or machine-readable data
- diagnostics, summaries, progress, and file-written messages go to stderr
- redirected output never contains ANSI escape sequences unless color is forced
- `NO_COLOR`, `FORCE_COLOR`, and `--color auto|always|never` are respected
- a downstream closed pipe (`EPIPE`) exits quietly instead of printing a stack trace
- stdin, stdout, and stderr work in real shell pipelines, not only simulated process input tests
- exit codes distinguish success, source diagnostics, command usage, and unexpected operational
  failure

Machine output should use a versioned envelope consistently across commands. Support stable JSON
first, then consider NDJSON for large batches and SARIF or GitHub annotations for CI. Human-friendly
color and decoration must never leak into those formats.

### Portable output by default — completed

Files produced by the CLI should work when opened in Finder, Preview, presentation software,
desktop Markdown applications, and other hosts that do not supply KDiagram CSS variables.

- snapshot resolved theme tokens by default for CLI SVG output
- provide an explicit `--live-theme` or equivalent for inline SVG that should inherit host tokens
- support named project themes or presentation profiles from a discoverable config file
- allow an explicit theme/token file for deterministic CI without requiring executable config
- warn when an export intentionally retains unresolved custom properties
- expose transparent background, print-safe, font-embedded, and future PNG/PDF options through the
  same presentation-profile model

Changing the snapshot default is a compatibility decision and should land before stable 1.0 or be
reserved for a documented major release.

### A polished human interface — completed

Human output should be colorful when attached to a terminal, restrained in CI, and useful without
requiring a second command:

- source code frames with underlined ranges, severity colors, diagnostic codes, and concrete hints
- grouped per-file output and a concise batch summary
- friendly filesystem and configuration errors without raw stack traces; retain `--debug` for
  maintainers
- command and option suggestions for common mistakes
- `--quiet` and `--verbose` modes with a consistent meaning
- a watch/preview command with live reload for users outside a first-party editor
- shell completions for Bash, Zsh, and Fish
- a `doctor` command that reports runtime, fonts, config, renderer, and environment problems

Help should lead with common jobs and examples. Keep low-level `ast` and `graph` inspection, but
visually separate tooling/debug commands from the main author workflow.

### CLI-launched studio as the bridge to editor integrations — completed

Turn the strongest parts of the current development studio into a supported local authoring
experience:

```bash
kdiagrams studio architecture.kdiagram
kdiagrams studio . --open
```

The command should start a local-only server, open the browser unless `--no-open` is supplied, watch
source and configuration changes, and provide the editor, live preview, diagnostics, layout/theme
controls, graph inspection, and export tools already proven in the studio.

Keep the public CLI dependent only on the Studio package's published browser assets and
host-neutral API. Keep repository-only development adapters out of the published surface. Define a
narrow synchronization protocol for:

- source and configuration updates
- render results and diagnostics
- source-range ↔ graph-element selection
- viewport, theme, and presentation state
- export and explicitly authorized save operations

Use adapters for direct in-browser calls, a local CLI transport, and VS Code webview messaging. The
VS Code extension should use VS Code's text editor instead of embedding another Monaco instance, but
it can reuse the preview, diagnostics, controls, selection protocol, and browser-safe language
service.

Bind the CLI server to loopback by default, use an unguessable session token, scope file access to
resolved input roots, and require explicit authorization before accepting browser writes. Remote or
collaborative serving is a separate security model and not part of the initial command.

### Distribution without package-manager friction — stable automation completed

Keep the npm package as the canonical JavaScript and project-local installation. Add a first-party
Homebrew tap after stable tagged releases exist so macOS users can install and upgrade with:

```bash
brew install kekonic/tap/diagrams
```

Keep the formula template, standalone packaging, checksums, release metadata, tests, and publication
automation in this monorepo. Homebrew's conventional `kekonic/tap` name resolves to a thin
`kekonic/homebrew-tap` repository, so release automation should publish the generated formula
there. That tap is organization-wide and may contain other Kekonic formulae and casks;
KDiagram owns only its generated `Formula/kdiagram.rb` entry. Treat the shared repository as a
distribution index rather than a second implementation or source of product logic. KDiagram formula
changes should be reviewed and tested here before synchronization.

The first formula may depend on Homebrew's Node runtime and install the published npm artifact. In
parallel, evaluate reproducible standalone executables that bundle the CLI, fonts, and other runtime
assets. Do not make Homebrew wait for a native rewrite.

If standalone packaging proves reliable, publish signed release archives and checksums for macOS,
Linux, and Windows, then let the tap install those artifacts. Scoop or Winget can follow the same
release manifest. Homebrew Core submission can wait for stable releases, demonstrated usage, and a
low-maintenance build; the project-owned tap should remain the fast path.

### Suggested CLI implementation order

1. Replace positional argument handling with a tested command model and shared input resolver.
2. Lock down stdin/stdout/stderr, `EPIPE`, color, exit-code, and versioned JSON contracts.
3. Make snapshot SVG the export default and add explicit live-theme/config behavior.
4. Add directory, glob, ignore, batch-output, and format-check workflows.
5. Extract the studio core and ship `kdiagrams studio` with watch and live reload.
6. Layer rich diagnostics over the shared language service and add `lsp --stdio`.
7. Publish the Homebrew tap; evaluate standalone release artifacts independently.

## Next: make KDiagram exceptional to author

### Shared language service — completed

Build a browser-compatible language-service package used by Monaco, an LSP server, and editor
extensions. The service should own KDiagram-aware operations so each host remains a thin adapter.

Target capabilities:

- incremental diagnostics with useful recovery while source is incomplete
- completion for kinds, IDs, properties, styles, icons, theme tokens, and table columns
- hover documentation and small kind/shape previews
- definition, references, rename, document symbols, folding, and semantic tokens
- formatting, quick fixes, and migrations for deprecated syntax
- a stable extension protocol for custom semantic kinds and properties

### First-party VS Code extension — initial release implemented

Ship the LSP through a first-party extension with:

- side-by-side live preview
- cursor-to-diagram and diagram-to-source selection
- preserved viewport and stable layout during edits
- theme, presentation, render, copy, and export commands
- KDiagram syntax highlighting and language configuration
- rendered KDiagram fences in the built-in Markdown preview

The studio should consume the same language service rather than maintaining separate editor
semantics. Reuse the host-neutral studio preview and synchronization protocol, but keep VS Code's
native text editor as the source editor.

The initial extension now ships the shared LSP, native `.kdiagram` language configuration and
highlighting, a side-by-side preview, portable SVG export, and rendered KDiagram fences in the
built-in Markdown preview. Bidirectional source/graph selection, preserved interactive viewport,
and the complete Studio presentation controls remain the next extension increment.

VS Code's built-in Markdown preview uses Markdown-it extensions for custom syntax and allows preview
scripts and styles. The extension should register a Markdown-it fence transform for `kdiagram`, emit
a safe placeholder, and use a bundled preview script to render it asynchronously. The language
grammar handles code-fence highlighting; embedded language-service support supplies diagnostics and
completion inside the fence where VS Code's APIs permit it.

### Layout stability as a product contract

Small semantic edits should cause small visual changes whenever constraints allow. Define and test
stability for node ordering, group placement, edge attachment, preview viewport, and transitions
between related views. This is essential to readable diffs and a calm live-editing experience.

## Next: make KDiagram agent-native

Agent readiness should mean more than publishing the grammar in another format. A capable agent
must be able to decide what diagram will answer the reader's question, distinguish known system
facts from assumptions, choose useful boundaries and relationship semantics, render the result,
inspect objective quality signals, and refine it without adding arbitrary presentation knobs.

The core contract should be vendor-neutral. Agent Skills, MCP, Codex or ChatGPT plugins, and other
host-specific packages should be distribution adapters over the same CLI and public APIs.

### Machine-readable capability contract

Expose the active language and renderer capabilities without requiring an agent to scrape prose or
memorize a release-specific catalog. A CLI command and equivalent API should describe:

- language and algorithm versions
- diagram families, kinds, shapes, operators, properties, and allowed values
- registered themes, icons, node types, and extension-provided capabilities
- option precedence and supported layout, routing, presentation, and export settings
- diagnostic codes, deprecations, and migration hints
- a compact index of relevant patterns and examples

The contract must be versioned, deterministic, and small enough for tool use. Detailed references
should be retrieved only when the task needs them.

The first built-in contract is now available through `getCapabilities()` and
`kdiagrams capabilities`. It deliberately declares its built-in registry scope; discovery of
host-registered extensions and a compact index of approved exemplar patterns remain follow-ups.

### Deterministic agent tools

Extend the existing structured diagnostics and staged pipeline into a compact tool surface. Whether
called through the CLI, JavaScript, or MCP, the underlying operations should remain the same:

- discover capabilities and retrieve a relevant pattern or example
- validate and format source
- compile source and inspect the semantic graph
- render an artifact with explicit options
- analyze layout and presentation quality
- compare semantic revisions

Quality analysis should report actionable signals such as node or label overlap, edge punches,
crossing clusters, overcrowded views, extreme aspect ratios, ambiguous branches, missing semantic
labels, and inaccessible presentation choices. Avoid a single opaque “beauty score”; return stable
diagnostic codes, locations, evidence, and possible remedies.

An optional MCP server can expose focused tools such as `get_capabilities`, `get_pattern`,
`validate_source`, `render_diagram`, and `analyze_quality`. Large SVG or image results should be
returned as artifacts or resources rather than consuming the agent's working context.

`kdiagrams analyze` now exposes batch, versioned JSON from the real render pipeline, including
artifact dimensions, algorithm provenance, and human-readable quality diagnostics. Layout-candidate
comparison, additional text/whitespace/accessibility checks, semantic comparison, and MCP transport
remain follow-ups.

### Official architecture-diagram skill — initial release implemented

Publish the skill as its own versioned package using an open agent-skill format. It must be
installable through the standard Skills CLI—for example, `npx skills add <kdiagram-skill-package>`—
without cloning the KDiagram monorepo or copying files from its internal `.agents/` directory.
Do not use repo-local `.agents/skills` as the public distribution mechanism; that directory, if it
is ever needed, is for KDiagram's own contributor automation only.

Keep the package host-neutral at its core, with the skill manifest, concise workflow, focused
references, tested scripts, examples, and declared KDiagram CLI/package requirements together.
Host-specific installers or adapters may wrap that package, but they must not fork its guidance.
The published package should have its installation path, compatibility, contents, and smoke tests
verified in CI, including a clean `npx skills add` installation.

The skill should encode an expert workflow rather than repeat the language reference:

1. Identify the audience, decision, and single question the diagram must answer.
2. Select the diagram family and level of abstraction before choosing nodes.
3. Extract known facts, record uncertainty, and never invent architecture to fill visual gaps.
4. Establish semantic boundaries, primary relationships, and a reading direction.
5. Draft the smallest useful KDiagram model with presentation policy kept secondary.
6. Validate, render, and inspect deterministic quality diagnostics.
7. Fix semantics and structure before tuning layout; split the view when density is the real issue.
8. Verify labels, contrast, accessibility, and delivery format.
9. Return the source, rendered artifact, assumptions, and any unresolved questions.

Keep the core skill short. Load focused package references only when needed for architecture,
event-driven systems, workflows, ERDs, sequences, layout repair, presentation, or accessibility.
Reuse tested scripts and CLI operations instead of teaching agents to reimplement parsing or
rendering.

Start with one general diagram-design skill. Split repository discovery, diagram review, or
architecture-governance workflows into separate skills only when real use shows that their tools,
triggers, and context are meaningfully different.

The initial `@kekonic/diagrams-agents` package now ships the host-neutral
`design-kekonic-diagrams` skill with progressively loaded pattern, repair, and delivery references,
deterministic package validation, and public installation guidance. Capability discovery, quality
analysis, MCP delivery, and the evaluation suite remain the next increments.

In this roadmap, a pattern means a canonical worked exemplar rather than machine-readable decision
logic: a realistic brief, excellent standalone KDiagram source, reviewed rendered artifact,
explanation of the semantic and visual choices, known failure modes, and repeatable validation.
Build and admit these exemplars one at a time. Do not derive them from the legacy gallery or call
general guidance a pattern merely to claim coverage.

### Replace the example library after agent foundations

Do not canonize or incrementally polish the current examples. They predate the agent-native quality
bar and are not suitable as reference material. After the capability contract, deterministic
quality analysis, skill workflow, and initial evaluation harness are stable, delete the existing
example/gallery corpus and replace it deliberately.

The replacement library should use fresh, realistic system briefs and repository fixtures. Each
example must stand on its own as an excellent explanation while collectively demonstrating the
full supported KDiagram surface. Each example should record:

- the reader question and when the pattern is appropriate
- the semantic choices and boundary strategy
- recommended starting layout and presentation policy
- common failure modes and the preferred repair order
- an annotated source example and, where useful, a contrasting poor example
- a fact/provenance brief, explicit assumptions, and intentional omissions
- the agent task and repeatable evaluation assertions used to produce or repair it

The website, language service, official skill, and agent tools should consume the same pattern
metadata so advice does not drift between surfaces.

Treat replacement as an atomic product milestone: remove obsolete source, mirrored website data,
snapshots, and references; introduce only examples that pass semantic, rendering, accessibility,
visual-quality, and agent-grounding review. Do not retain weak examples for compatibility when no
public source contract requires them.

### Capability gaps exposed by the diagram-design skill

Treat the skill and its evaluation failures as product research, not only prompt content. Expert
guidance can help an agent select and simplify a view, but guidance cannot compensate for missing
semantics, unverifiable provenance, or a layout system that cannot express the chosen explanation.
Track the following opportunities without promising that each becomes a new keyword:

- **View intent and provenance:** represent a view's audience, question, scope, abstraction level,
  current/target state, intentional omissions, assumptions, and source evidence in a structured
  form that tools can preserve and evaluate. Keep sensitive repository details out of rendered
  artifacts by default.
- **Progressive views over one model:** derive context, application/container, component,
  deployment, event, data, and scenario views without copying topology. Let titles, scope notes,
  labels, emphasis, and presentation vary per view while semantics remain shared.
- **Architectural profiles:** explore C4 levels, DDD context relationships, layered and hexagonal
  dependency direction, modular-monolith boundaries, CQRS, event sourcing, orchestration, and
  choreography as semantic profiles over the common graph where possible—not disconnected
  renderers or a catalogue of decorative shapes.
- **First-class boundaries:** strengthen ownership, domain, organization, external/internal, trust,
  runtime, region, network, and deployment boundaries. A boundary should state why grouping matters
  and support validation of relationships that cross it.
- **Richer process semantics:** evaluate pools/lanes, human responsibility, timers, exceptions,
  parallel joins, messages between participants, and subprocesses. Adopt a focused workflow model
  only where KDiagram can validate and lay it out well; do not claim comprehensive BPMN by drawing
  approximate symbols.
- **Selective new families:** the first state-machine tranche now provides a dedicated surface,
  initial/final semantics, and structural validation. Continue with compound states, executable
  guard/action analysis, and concurrency only when layout and diagnostics can support them. Use real
  tasks to prioritize data flow/lineage, deployment topology, migration/current-versus-target views,
  and threat/trust-boundary views.
- **Editorial layout primitives:** improve center-and-surround context views, true swimlanes,
  justified hub-and-spoke layouts, layer direction, peer alignment, focal hierarchy, whitespace,
  and primary/secondary visual weight without falling back to manual coordinates.
- **Explanatory metadata:** support strong view titles, concise scope/subtitle notes, legends only
  when needed, and annotations that explain architectural decisions without turning boxes into
  paragraphs.
- **Artifact-level visual analysis:** inspect the rendered result at realistic display sizes and
  report unreadable labels, extreme aspect ratios, excessive edge spans, crossings, missing
  direction markers, and inaccessible descriptions. Source validity and successful rendering are
  necessary but do not prove editorial quality. The first deterministic checks cover aspect ratio,
  canvas-spanning edges, crossings, reverse flow, and edge-label pressure. KDiagram uses 16:9 as its
  default composition target; effective text size and whitespace remain follow-ups.
- **Abstraction and feature-use analysis:** expose and evaluate whether a node represents a system,
  deployable, application, service, logical capability, data store, external dependency, or shared
  infrastructure. Detect unsupported concrete kinds and architecture views that leave useful
  groups, subtitles, icons, semantic styles, presentation scope, or hierarchy unused without a
  reason. Grounded output must not collapse into generic boxes and arrows.
- **Deterministic layout candidate analysis:** let tools render and compare a bounded set of layout
  policies for one unchanged semantic model, reporting crossings, edge spans, label pressure,
  effective text size, region distortion, whitespace, and destination-size readability. Agents
  should select from evidence rather than accept the first render or tune options randomly.
- **Ports-and-adapters composition:** explore architecture profiles and layout constraints for
  inward dependency direction, boundary-adjacent ports, peripheral inbound/outbound adapters,
  repeated equal module stacks, and secondary cross-module routing. A profile should reuse the
  common graph and renderer rather than introduce a separate hexagonal diagram engine.
- **Semantic quality diagnostics:** detect mixed abstraction levels, mystery arrows, unlabeled
  cross-boundary relationships, technology-billboard labels, meaningless groups, too many equally
  dominant nodes, unsupported notation, conflated current/target states, and views that should be
  split. Diagnostics must provide evidence and repair options rather than subjective scores.

Feed these gaps into capability discovery and the agent evaluation suite. Promote a gap into the
implementation sequence when repeated realistic tasks show that it blocks a valuable explanation
and cannot be solved cleanly through the existing model, profiles, or extension seams.

### Agent evaluation suite

Build a model- and host-independent benchmark from realistic architecture briefs and repository
fixtures. Evaluate the produced source and artifact for:

- faithfulness to supplied facts and explicit handling of uncertainty
- valid, maintainable KDiagram source
- appropriate abstraction, boundaries, and relationship semantics
- render success and deterministic quality diagnostics
- accessibility and presentation readiness
- number of repair iterations and unnecessary presentation overrides

Include adversarial cases: incomplete requirements, systems too large for one view, misleading
requested notation, and existing diagrams that should be edited rather than replaced. Run the suite
against multiple agent hosts so the skill improves transferable workflow quality instead of
overfitting one model.

### Suggested first implementation slice

1. Publish the standalone, `npx skills add`-installable skill package using today's CLI and
   renderer, without treating the existing examples as canonical; learn where agents fail.
2. Add the versioned capability manifest and example/pattern index.
3. Add deterministic `analyze --json` quality diagnostics and use them in the skill's repair loop.
4. Expose the same operations through a small MCP adapter and package host-specific integrations.
5. Establish the evaluation suite before expanding into repository-to-diagram automation.
6. Delete and rebuild the complete example/gallery corpus from grounded evaluation briefs.

Repository discovery and importers can later help agents extract candidate models, but generation
must preserve provenance: agents should identify what came from code or configuration, what was
inferred, and what still needs human confirmation.

## Next: make KDiagram easy to publish

### Markdown and build integrations — implemented

Provide a shared build adapter with thin integrations for the Unified ecosystem and Unplugin.
Candidate packages include remark/rehype and Vite-compatible wrappers; final package names should
be chosen when implementation starts.

`@kekonic/diagrams-markdown-it` provides asynchronous static SVG fence rendering for
Markdown-it hosts. `@kekonic/diagrams-remark` provides the equivalent native mdast/HAST path
for Unified, MDX, Astro, and Docusaurus without requiring raw HTML processing. Both include portable
theme snapshots, accessible output, and Markdown-line diagnostic mapping.

`@kekonic/diagrams-unplugin` adds standalone `.kdiagram` imports across Vite and compatible
bundlers. Explicit `?svg`, `?url`, `?source`, `?react`, and `?element` forms separate portable static
output from live runtime components. All adapters share `@kekonic/diagrams-build`, keeping DSL
parsing and rendering centralized. Dependency-aware caching remains a future optimization.

Do not conflate editor preview support with build-time publishing:

- the VS Code extension owns Markdown-it, preview-script, and preview-style contributions for its
  built-in Markdown preview
- a reusable Markdown-it adapter can also serve VitePress and other Markdown-it hosts
- remark/rehype adapters serve the Unified, MDX, Astro, and Docusaurus ecosystems
- all adapters share fence metadata, option resolution, diagnostics mapping, and KDiagram rendering
  primitives without pretending the host ASTs are identical

Required behavior:

- transform fenced `kdiagram` blocks into static SVG at build time
- map diagnostics back to the correct Markdown or MDX lines
- emit static, accessible output without client JavaScript by default
- opt into interactive diagrams and animation controls
- cache by content and options, and invalidate imported dependencies correctly
- support imports such as `.kdiagram?svg`, `.kdiagram?source`, and `.kdiagram?component`
- publish tested recipes for Astro/Starlight, VitePress, Docusaurus, and generic MDX

### Export quality

Keep SVG as the canonical renderer while adding delivery formats users regularly need:

- PNG and PDF export
- transparent-background and print-safe output
- font embedding and deterministic CI rendering
- slide, document, and responsive-web sizing presets

Canvas or WebGL should wait until a demonstrated scale or interaction problem cannot be solved well
with SVG.

## Then: make one model explain a whole system

### Models, imports, and views

**Draft landed (gated on `kdiagram 2`):** shared `model` + embedded `view` with `include` /
`exclude` / `collapse`, optional `intent`, CLI `--view`, `analyze --compare-layouts`, and
studio/embed view switchers. See `docs/architecture/views-and-intent.md` and
`examples/storefront-model.kdiagram`. Still **out of scope** for this draft: cross-file imports,
tag selectors, implied C4 edges, and animated view transitions.

Introduce versioned language constructs for reusable models and derived views. A single model should
be able to produce context, container, deployment, event-flow, ownership, risk, and scenario views.

The design should explore:

- file imports and reusable modules
- tags and metadata such as owner, technology, domain, criticality, and deployment
- include, exclude, focus, and connected-neighborhood selectors
- collapsing groups or subgraphs into summary nodes
- view-specific labels, notes, styles, layout policy, and presentation
- named scenarios and animation stories layered over shared topology

C4 should primarily be a semantic/view profile over the shared model rather than an independent
renderer or disconnected language.

### Interactive exploration

Interactive hosts should evolve from viewers into navigable technical documents:

- search, focus, and fade unrelated topology
- collapse and expand groups with breadcrumbs
- authored links, tooltips, and node deep links
- keyboard navigation and accessible selection
- animated transitions between compatible views
- events that let documentation portals and editors synchronize surrounding content

## Then: make architecture reviewable and enforceable

### Semantic linting

Add configurable architecture rules without coupling them to layout. Candidate rules include:

- forbidden dependency direction or cross-boundary access
- cycles between declared layers or domains
- events with no producers or consumers
- services, stores, or topics without ownership metadata
- direct database access outside the owning boundary
- trust-boundary crossings without an annotation or policy

### Semantic diff

Compare compiled models rather than SVG pixels. CLI and CI output should explain meaningful changes,
for example that a service gained a synchronous cross-domain dependency or an event lost its final
consumer. Visual diff overlays may follow after the semantic contract is useful on its own.

## Later opportunities

### Importers and migration adapters

Adapters should compile into the normal `GraphModel` and emit clear diagnostics for unsupported
input. Promising on-ramps include:

- Mermaid flowchart subsets
- OpenAPI and AsyncAPI
- PostgreSQL, Prisma, and Drizzle schemas
- Kubernetes and Terraform resources

Importers are migration and generation aids. Native KDiagram remains the canonical authoring
language.

### Selective diagram semantics

Add diagram families only when they serve software-system documentation and can meet KDiagram's
layout-quality bar. The strongest candidates are:

1. **State machines:** nested states, guards, actions, initial/final states, forks, and joins.
2. **Data lineage:** sources, transforms, sinks, datasets, and column-level lineage.
3. **Deployment topology:** resource and runtime views, especially when generated from real
   infrastructure definitions.
4. **Threat and trust-boundary views:** preferably overlays on shared architecture models.

Gantt charts, mind maps, general charting, workshop canvases, and comprehensive classical UML are
not current priorities.

### Presentation profiles and extension manifests

Evolve themes into curated presentation profiles that can bundle paired light/dark palettes,
typography, density, chrome, edge treatment, and icon policy. A small set of excellent editorial,
technical, paper, presentation, and high-contrast profiles is preferable to a large shallow theme
gallery.

Productize the existing shape and node-type registries into extension manifests that can also
contribute language-service completions and documentation. New built-in nodes should be added only
when their semantics affect validation, layout, routing, or interaction.

## Suggested delivery sequence

| Priority | Outcome                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------- |
| Gate     | Audit other pre-1.0 residue                                                                        |
| 1        | Completed — CLI contracts, batch discovery, portable exports, diagnostics, and Homebrew automation |
| 2        | Completed — CLI-launched studio and extracted host-neutral preview/synchronization core            |
| 3        | Completed — shared language service and `kdiagrams lsp --stdio`                                    |
| 4        | Initial release — VS Code extension with native editing, preview, export, and Markdown fences      |
| 5        | Markdown-it completed; remark/rehype and Unplugin publishing integrations remain                   |
| 6        | Official agent skill, capability manifest, quality analysis, MCP adapter, and evaluation suite     |
| 7        | Imports, reusable models, derived views, interactive exploration, semantic linting, and diff       |
| 8        | Importers, state/data-lineage semantics, presentation profiles, and extension manifests            |

## How roadmap work should be evaluated

A roadmap feature is successful when it improves at least one of these outcomes without regressing
the others:

- authors reach a correct diagram faster
- CLI users can discover, validate, format, and export a project without custom shell glue
- agents produce grounded, maintainable diagrams and improve them from inspectable feedback
- realistic edits preserve the reader's mental map
- one model replaces duplicated diagrams
- publishing requires less custom glue
- reviewers can identify semantic architectural changes in text or CI
- exported and interactive output remains accessible and presentation-ready
