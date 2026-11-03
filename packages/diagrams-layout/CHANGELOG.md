# @kekonic/diagrams-layout

## 1.0.0-rc.14

### Patch Changes

- @kekonic/diagrams-core@1.0.0-rc.14
  - @kekonic/diagrams-geometry@1.0.0-rc.14
  - @kekonic/diagrams-icons@1.0.0-rc.14

## 1.0.0-rc.13

### Minor Changes

- 78cb333: `interface` nodes can set `role: provided` (ball) or `role: required` (socket). The assembly is an ordinary `..>` dependency between those nodes. Boxed interfaces are unchanged, including the ports-and-adapters poster.

### Patch Changes

- Updated dependencies [1800041]
- Updated dependencies [78cb333]
  - @kekonic/diagrams-core@1.0.0-rc.13
  - @kekonic/diagrams-geometry@1.0.0-rc.13
  - @kekonic/diagrams-icons@1.0.0-rc.13

## 1.0.0-rc.12

### Patch Changes

- @kekonic/diagrams-core@1.0.0-rc.12
  - @kekonic/diagrams-geometry@1.0.0-rc.12
  - @kekonic/diagrams-icons@1.0.0-rc.12

## 1.0.0-rc.11

### Patch Changes

- Updated dependencies [0bc6f4d]
  - @kekonic/diagrams-core@1.0.0-rc.11
  - @kekonic/diagrams-geometry@1.0.0-rc.11
  - @kekonic/diagrams-icons@1.0.0-rc.11

## 1.0.0-rc.10

### Minor Changes

- 2046663: Revive sequence diagram presentation. Execution bars nest, arrows meet those bars, and sync, async, reply, and failure messages use distinct heads. Labels sit on chips with autonumber badges. Combined fragments hug the participants, notes, and labels they cover, with an operator tab and a guard that stays clear of execution bars. Notes wrap, dividers break for their label, `create` drops a participant onto the timeline, and `destroy` ends the lifeline. Longer sequences repeat participant names along the bottom.
- 2046663: Sequence messages can carry a short `payload` excerpt, such as the JSON fields on an HTTP call or an async event. Write the excerpt between `"""` quotes so its own quotes need no escaping. The label stays the call or event name. An HTTP call can be written as the method and the route, `POST /checkout` or `GET /orders/{id}`, with no quotes. The excerpt is painted as a card under the arrow, keeping the author's line breaks, with an accent for a call, an async event, a reply, or a failure. Excerpts longer than six lines warn and shorten. Async sequence messages stay solid, and open arrow heads stay solid on a dashed reply.

### Patch Changes

- Updated dependencies [2046663]
- Updated dependencies [2046663]
  - @kekonic/diagrams-core@1.0.0-rc.10
  - @kekonic/diagrams-geometry@1.0.0-rc.10
  - @kekonic/diagrams-icons@1.0.0-rc.10

## 1.0.0-rc.9

### Minor Changes

- 6d45853: Model document databases with nested fields, access paths, indexes, and invariants. `profile` selects a constraint pack for CouchDB, MongoDB, DynamoDB, Cosmos DB, or Firestore. Each pack checks the partition key, cross-partition reads, atomic commit, and read audience that product actually has. Shared checks still require an index, real fields, and agreeing scopes.

### Patch Changes

- Updated dependencies [6d45853]
  - @kekonic/diagrams-core@1.0.0-rc.9
  - @kekonic/diagrams-geometry@1.0.0-rc.9
  - @kekonic/diagrams-icons@1.0.0-rc.9

## 1.0.0-rc.8

### Patch Changes

- @kekonic/diagrams-core@1.0.0-rc.8
  - @kekonic/diagrams-geometry@1.0.0-rc.8
  - @kekonic/diagrams-icons@1.0.0-rc.8

## 1.0.0-rc.7

### Minor Changes

- 982f2c0: True swimlanes and a DDD example suite.

  - Top-level `swimlane` groups infer `groupLayout: swimlane` and `direction: LR`. ELK ranks every member on a shared left-to-right timeline (flattened, not nested compounds); bands then pack in declaration order with no gap, shared width, and a left header strip. Header titles inset from the divider and wrap. Chrome is the header strip plus a hairline between bands — not a dashed box around each lane. Ordinary groups keep a dashed outline with no fill, so nested boxes do not stack washes on the canvas.
  - Flagship workflow: `examples/expense-approval.kdiagram`. Refund stays owner columns, not swimlanes.
  - DDD dogfood: event storming, context mapping, and Order aggregate design on the shared commerce story, with named animations and semantic styles.

### Patch Changes

- 982f2c0: Keep state-machine final names readable: authored labels sit on the node fill with a hollow inner ring, and the live canvas inherits diagram `--kd-bg` so a light diagram is not drawn on a dark host.
- Updated dependencies [50ecddf]
- Updated dependencies [982f2c0]
- Updated dependencies [982f2c0]
  - @kekonic/diagrams-core@1.0.0-rc.7
  - @kekonic/diagrams-geometry@1.0.0-rc.7
  - @kekonic/diagrams-icons@1.0.0-rc.7

## 1.0.0-rc.6

### Minor Changes

- 981712f: Make ERD tables a usable schema surface: parameterized types, inferred 1:1 and identifying relationships, composite keys, multi-FK fan-out, table notes, and crow’s-foot docs and examples that match what the pipeline actually draws.

### Patch Changes

- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
- Updated dependencies [981712f]
  - @kekonic/diagrams-core@1.0.0-rc.6
  - @kekonic/diagrams-geometry@1.0.0-rc.6
  - @kekonic/diagrams-icons@1.0.0-rc.6

## 1.0.0-rc.5

### Patch Changes

- Updated dependencies [7a35d7a]
  - @kekonic/diagrams-core@1.0.0-rc.5
  - @kekonic/diagrams-geometry@1.0.0-rc.5
  - @kekonic/diagrams-icons@1.0.0-rc.5

## 1.0.0-rc.4

### Patch Changes

- 1d5519f: Add the official host-neutral `design-kekonic-diagrams` agent skill with grounded modeling,
  deterministic validation and rendering, progressively loaded editorial design, diagram-pattern,
  repair, and delivery guidance, and public installation documentation. Plan a clean replacement of
  the legacy example corpus after the agent capability and evaluation foundations are stable, and
  record the semantic, view, boundary, layout, provenance, and quality-analysis gaps revealed by the
  expert workflow as future product opportunities. Add KDiagram-specific semantic and measurable
  visual-review guidance plus an explicit architecture modeling and feature-use contract based on
  clean-room agent evaluation, and restore arrowheads on directed dependency edges discovered by that
  evaluation.
  Require concise plain-language subtitles and a bounded rendered layout bake-off so agents compare
  credible directions, region arrangements, and density choices instead of accepting the first valid
  composition.
  Add focused hexagonal-architecture guidance for ports, adapter placement, inward dependencies,
  repeated module stacks, single-poster limits, and progressive detail views based on a second
  clean-room evaluation.
  Make diagram-level region arrangement include ungrouped nodes as declaration-ordered track cells,
  so architecture views can stage actors, service regions, adapters, and external systems without
  inventing layout-only wrapper groups.
  Add the first-class `state` diagram surface with initial/final structural validation and UML-style
  initial/final rendering. Add post-layout FM220–FM224 quality diagnostics for extreme canvases,
  perimeter-spanning edges, crossings, reverse-flow pressure, and edge-label density. Expand the
  official skill and public design documentation with focused state-machine, responsibility-workflow,
  and event-driven composition guidance derived from clean-room evaluations.
  Fix formatting of styled edges with property blocks so agents can combine semantic styles and
  layout priority without producing invalid source.
- Updated dependencies [1d5519f]
  - @kekonic/diagrams-core@1.0.0-rc.4
  - @kekonic/diagrams-geometry@1.0.0-rc.4
  - @kekonic/diagrams-icons@1.0.0-rc.4

## 1.0.0-rc.3

### Minor Changes

- e7a2d1f: Harden the final release candidate across delivery, tooling, and documentation.

  - Load only requested Iconify glyphs in browsers while preserving the complete installed collections for Node and CLI rendering.
  - Split the lightweight React live renderer from playground and Shiki entry points, and add copy/download playground actions.
  - Add strict CLI flag handling, stdin and JSON diagnostics, version output, browser bundle budgets, and representative SVG regression snapshots.
  - Scope snapshot theme tokens to inline SVGs, improve package metadata and compatibility declarations, and expand the product, quick-start, comparison, CLI, API, icon, and embedding documentation.

- d12b18d: Add first-class sequence diagrams: top-level `sequence { … }` DSL, SequenceIR compile path, dedicated `sequence-v1` time-axis layout (lifelines, activations, fragments, notes), SVG paint + theme tokens, return op `-->`, and auto message-walk animation. Includes Temporal order-workflow sequence twin in examples/gallery.

### Patch Changes

- Updated dependencies [8fd0c2b]
- Updated dependencies [e7a2d1f]
- Updated dependencies [d12b18d]
- Updated dependencies [2618a95]
- Updated dependencies [982bd4c]
  - @kekonic/diagrams-core@1.0.0-rc.3
  - @kekonic/diagrams-geometry@1.0.0-rc.3
  - @kekonic/diagrams-icons@1.0.0-rc.3

## 1.0.0-rc.2

### Minor Changes

- 27349fb: Add diagram animations: opt-in Automatic via empty named `animation` blocks (exclusive chapters vs parallel fan-out; `dim *` clears sticky highlights between chapters), authored cue scripts (including `parallel`), an SVG player on RenderController (`setSpeed`, `subscribe`, …), and Lit/React controls (picker, scrubber, 0.5×–2× speed). Diagrams stay static until an animation is declared.

### Patch Changes

- Updated dependencies [27349fb]
- Updated dependencies [27349fb]
  - @kekonic/diagrams-core@1.0.0-rc.2
  - @kekonic/diagrams-geometry@1.0.0-rc.2
  - @kekonic/diagrams-icons@1.0.0-rc.2

## 1.0.0-rc.1

### Minor Changes

- 5032ae2: Polish the DSL before stable: EdgeKind sync/async/eventual/association, soft keywords, concrete spacing, trimmed presentation chrome, and Shiki/lexer parity.

### Patch Changes

- 2465ce7: Add Changesets, Conventional Commits, CI/release workflows, Dependabot, and contributing docs.
  Keep guide docs evergreen (versions live in CHANGELOG / package metadata).
  One product version across publishable packages and the private website app.
- Updated dependencies [5032ae2]
- Updated dependencies [2465ce7]
  - @kekonic/diagrams-core@1.0.0-rc.1
  - @kekonic/diagrams-geometry@1.0.0-rc.1
  - @kekonic/diagrams-icons@1.0.0-rc.1
