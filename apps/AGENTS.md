# Kekonic Diagrams app rules

These rules apply to private applications under `apps/`. Also follow the root `AGENTS.md` and
`.agents/rules/kekonic-diagrams-repo-conventions.md`.

## Apps are consumers

- Apps exercise published Kekonic Diagrams APIs; they must not become alternate homes for reusable
  parser, model, layout, routing, rendering, theme, icon, language-service, or editor-integration
  logic. Extract reusable behavior into the owning package with a tested public contract.
- Do not import from another app or from a package's private `src/` files. Use workspace package
  exports so apps test the same surface users receive.
- Keep private host adapters thin. Never present an Astro integration, Vite middleware, or website
  component as a supported public API.

## Website

- Public documentation must teach the published packages: `@kekonic/diagrams`,
  `@kekonic/diagrams-cli`, `@kekonic/diagrams-element`, and `@kekonic/diagrams-ui`, plus a
  lower-level package only when the task genuinely requires it.
- Product copy is **Kekonic Diagrams** (never **KDiagrams**). Keep **KDiagram** where a page already
  uses that short name. **`.kdiagram`** is the file extension and Markdown fence, not the product.
- Prefer job-oriented `/use/` recipes and one canonical explanation per concept. Link to reference
  material instead of copying contracts into multiple pages.
- Examples must compile against current public exports. Do not hardcode a current package version
  in evergreen guidance; link to the changelog or package registry.

## App verification

- Validate changed examples and docs builds as well as TypeScript tests. For visual changes, inspect
  the rendered website at representative desktop and narrow viewport sizes.
- Do not accept generated SVG or screenshot changes without checking labels, clipping, crossings,
  contrast, and keyboard/accessibility behavior relevant to the change.
