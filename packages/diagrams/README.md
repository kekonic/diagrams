# `@kekonic/diagrams`

The default KDiagram SDK: semantic text diagrams with measured ELK layout, orthogonal routing,
crossing treatment, accessible SVG, interactive browser hosts, themes, icons, and diagram stories.

## Install

```bash
pnpm add @kekonic/diagrams
```

KDiagram is ESM. Use the CLI package when you only need files and CI:
`@kekonic/diagrams-cli`.

## Render SVG

```ts
import { KDiagram } from "@kekonic/diagrams";

const source = `diagram "Checkout" {
  direction LR

  group app "Application" {
    api: gateway "API"
    checkout: service "Checkout" { icon: shopping-cart }
  }

  db: database "Postgres"
  bus: broker "Events"

  api -> checkout "POST /orders"
  checkout -> db "write"
  checkout => bus "OrderPlaced"

  animation "Order path" {}
}`;

const result = await KDiagram.renderToSvg(source, {
  theme: "light",
  snapshotTheme: true,
});

if (!result.ok || !result.svg) {
  throw new Error(result.diagnostics.map((item) => item.message).join("\n"));
}
```

`snapshotTheme: true` makes SVG self-contained for README files, wikis, email, and CI artifacts.

## Interactive host

```ts
const controller = KDiagram.renderToElement(source, container, { theme: "dark" });
await controller.ready();

await controller.update(nextSource);
controller.animations.play("order-path");
controller.fit();
controller.destroy();
```

Unmodified wheel scrolls the page. Zoom with Ctrl/⌘ + scroll, pinch, or `zoomIn()` / `zoomOut()`.

Prefer `@kekonic/diagrams-element` for a framework-agnostic custom element or
`@kekonic/diagrams-ui` for React.

## Primary API

- `KDiagram.parse(source)` — AST and diagnostics
- `KDiagram.compile(source)` — semantic graph and policy hints
- `await KDiagram.layout(graph, options)` — measured ELK layout and edge paths
- `KDiagram.route(graph, layout, options)` — refine straight/bezier paths, labels, crossings, trim
- `KDiagram.format(source)` — normalized source
- `await KDiagram.renderToSvg(source, options)` — complete static pipeline (`options.view` selects a
  model lens)
- `KDiagram.renderToElement(source, container, options)` — live host and controller
- `listCompileTargets(source)` / `compareViewLayouts(…)` — discover and score `kdiagram 2` model
  views
- `registerTheme`, `registerIcon`, `registerCollection` — extension points

API options override source `layout`, `edges`, `render`, and `presentation` blocks. For shared
models, see the [language reference](https://diagrams.kekonic.com/reference/language/#models-and-views-kdiagram-2-draft).

## Icons

Built-in glyphs require no loading. Node uses installed Iconify collections offline; browsers fetch
only requested icon names. Register a collection or custom loader for CSP-controlled/offline browser
apps. The complete icon vocabulary remains available without shipping whole collections to every
browser.

## Documentation

- [Quickstart](https://diagrams.kekonic.com/start/quick-start/)
- [Gallery](https://diagrams.kekonic.com/gallery/)
- [Language](https://diagrams.kekonic.com/reference/language/)
- [Animations](https://diagrams.kekonic.com/design/stories/)
- [JavaScript API](https://diagrams.kekonic.com/reference/api/)
- [Publishing guides](https://diagrams.kekonic.com/publish/)
