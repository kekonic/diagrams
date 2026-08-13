# Kekonic Diagrams package rules

These rules apply to publishable libraries and the CLI under `packages/`. Also follow the root
`AGENTS.md` and `.agents/rules/kekonic-diagrams-repo-conventions.md`.

## Package ownership

- `diagrams-core` owns language syntax, parsing, formatting, semantic models, diagnostics, and
  compilation. It must not depend on layout, routing, rendering, browser DOM, or Node-only APIs.
- `diagrams-geometry` owns renderer-neutral shapes, ports, intersections, and footprints. It must
  not contain SVG paint policy or diagram-language parsing.
- `diagrams-layout` owns measurement inputs and placement. It consumes compiled semantics and
  geometry; it must not render output or reparse source.
- `diagrams-routing` owns post-layout paths, crossings, edge-label placement, and route refinement.
  It must not change semantic meaning or duplicate layout placement.
- `diagrams-render-svg` owns SVG serialization and presentation. It consumes completed model,
  layout, routing, theme, icon, and geometry data; it must not perform parsing or graph layout.
- `diagrams-theme` owns presentation tokens and resolution. `diagrams-icons` owns icon registries and
  normalized icon data. Neither package may acquire application state or pipeline orchestration.
- `diagrams` is the supported high-level orchestration layer. `diagrams-cli`, `diagrams-element`, and
  `diagrams-ui` are consumers of published package entrypoints, not alternate implementations of
  the compiler/render pipeline.

## Dependency and API discipline

- Keep package dependencies directed from higher-level orchestration and adapters toward focused
  lower-level packages. Do not introduce cycles.
- Import across packages through declared package exports. Do not reach into another package's
  `src/` tree or rely on its unexported implementation details.
- Keep browser-safe entries free of `node:*`, process, filesystem, and other Node-only transitive
  imports. Isolate Node behavior behind explicit Node/CLI entrypoints.
- Make public exports deliberately through the package's entrypoint. New DSL, model, option,
  renderer, theme, icon, CLI, or web-component surface requires tests, public docs where relevant,
  and a Changeset.
- Prefer the cleanest coherent API permitted by the change's compatibility policy. Avoid aliases,
  shims, or parallel compatibility paths unless they serve an explicit migration contract. When a
  breaking change is authorized, update all workspace consumers and document it in the Changeset.
- Keep CLI stdout usable as a data channel: rendered output belongs on stdout; diagnostics,
  progress, and human UI belong on stderr. Respect non-TTY and `NO_COLOR` behavior, and never let
  decoration corrupt piped output.
- Published agent-facing material belongs in its own package, including skills, MCP adapters, and
  capability manifests. Do not publish repository `AGENTS.md` or `.agents/` content as an implicit
  product surface; a public skill must support a clean `npx skills add` installation.

## Testing package contracts

- Test package behavior at the owning layer. Add cross-package tests only for a real integration
  contract rather than duplicating unit coverage everywhere.
- When changing an exported type or function, test it through the public package entrypoint.
- For SVG, geometry, layout, or routing changes, cover invariants with structural assertions and
  inspect any committed showcase/snapshot output visually.
