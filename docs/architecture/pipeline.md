# Pipeline contracts

KDiagram separates semantic compilation from geometry and presentation so each phase has one clear
owner and can be tested independently.

## Phase ownership

1. **Parse and compile** — `@kekonic/diagrams-core` turns source into semantic models and
   structured diagnostics while retaining source ranges.
2. **Resolve geometry and measure** — `@kekonic/diagrams-geometry`, theme/icon data, and the
   measurement layer establish shapes, ports, content bounds, and layout dimensions.
3. **Lay out** — `@kekonic/diagrams-layout` assigns node and group positions and produces the
   initial orthogonal edge geometry.
4. **Refine routes and labels** — `@kekonic/diagrams-routing` refines `metro`,
   `rounded`, `bezier`, and `straight` geometry from the orthogonal corridor
   (`orthogonal` stays sharp), then trims endpoints and applies crossing and
   label treatment without changing semantic meaning.
5. **Render** — `@kekonic/diagrams-render-svg` serializes the completed
   model and geometry with resolved presentation data.
6. **Orchestrate and host** — `@kekonic/diagrams` composes the pipeline; CLI, custom-element,
   React, studio, and documentation hosts consume its public entrypoints.

A later phase must not reparse source, recreate semantic policy, or take ownership of an earlier
phase's decisions. The SVG renderer consumes completed pipeline artifacts rather than changing
measurement, layout, routing, or graph topology.

## Dependency direction

Focused lower-level packages do not depend on orchestration packages or applications. Cross-package
imports use declared package exports rather than another package's source tree. Browser-safe
entrypoints do not acquire Node-only dependencies transitively.

Applications are consumers. Reusable compiler, layout, routing, rendering, theme, icon, or editor
logic belongs in a package with a tested public contract rather than in an application host.

## Options and presentation

Explicit render-call/API options take precedence over policy expressed in diagram source; diagram
policy takes precedence over library defaults. Semantic identity and relationships remain separate
from SVG presentation so appearance can change without changing meaning.

## Determinism and diagnostics

Given the same source, options, registries, and dependency versions, compilation and rendering must
produce stable ordering, IDs, diagnostics, geometry inputs, routes, and serialized output.

Expected source and user errors are returned as structured diagnostics rather than swallowed or
converted into environment-dependent console output. Source ranges are preserved wherever they can
support diagnostics or language tooling.

## Trust boundaries

Diagram source, labels, links, icon data, theme values, and imported SVG are untrusted input. Escape
text and attributes for their destination context, validate URL-bearing attributes, and never
introduce arbitrary HTML or script execution into generated SVG or interactive hosts.
