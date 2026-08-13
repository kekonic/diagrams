# @kekonic/diagrams-theme

CSS variable theme contract and dark/light token sets for KDiagram.

## Scope

- Built-in `dark` / `light` modes
- `registerTheme` / `getThemeTokens` / `themeToCss`
- Kind class names, branch semantics, and style resolution helpers

## Install

```bash
pnpm add @kekonic/diagrams-theme
```

## Stylesheet

```ts
import "@kekonic/diagrams-theme/theme.css";
// or via the meta package:
import "@kekonic/diagrams/theme.css";
```

Live SVG prefers CSS variables; pass `snapshotTheme: true` on render/CLI to bake resolved tokens into static export.

Regenerate the stylesheet after token edits:

```bash
pnpm --filter @kekonic/diagrams-theme generate:theme-css
```

## Related

- Meta package: `@kekonic/diagrams`
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
