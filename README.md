# Kekonic Diagrams

Beautiful, interactive diagrams from text.

Write services, events, decisions, tables, and sequences in a readable language. KDiagram handles
compound layout, routed edges, icons, and interactive playback from the same source.

You name the things that matter and describe how they relate. KDiagram measures the labels, places
the nodes, routes the connections, and redraws the result whenever the source changes.

![KDiagram platform overview](docs/assets/kdiagram-overview.svg)

## Meaning, not coordinates

A KDiagram file contains meaning rather than stored positions. Services, gateways, brokers, tables,
people, decisions, boundaries, calls, events, and failures remain visible in the source and in a
pull-request diff.

There are no `x` and `y` coordinates to maintain. That is the bargain KDiagram offers: less manual
control in exchange for source that stays readable, reviewable, and easy to change.

## The idea in one minute

Save this as `checkout.kdiagram`:

```kdiagram
diagram "Checkout" {
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
}
```

Read it from top to bottom:

1. `diagram` names the model.
2. `checkout: service "Checkout"` declares a stable ID, semantic kind, and human label.
3. `group` says which nodes share a boundary.
4. `->` describes a direct interaction; `=>` describes an event.
5. `direction LR` asks the layout engine to make the main flow read left to right.

KDiagram is designed for diagrams whose structure matters more than unrestricted composition:

- software architecture and service maps
- event-driven systems and data pipelines
- operational and business workflows
- database relationships
- request traces and sequence diagrams
- diagrams that live in repositories, documentation, and CI

The same source can become a portable SVG, a live browser diagram, or an animated explanation.
When freeform drawing, broad diagram-category coverage, or standardized UML is the deciding factor,
another tool may fit better. Read [Is Kekonic Diagrams right for you?](https://diagrams.kekonic.com/start/choose/)
for the full tradeoff.

## Render an SVG

Render a self-contained SVG:

```bash
pnpm dlx @kekonic/diagrams-cli render checkout.kdiagram \
  -o checkout.svg --theme light --snapshot
```

Or use the ESM API:

```bash
pnpm add @kekonic/diagrams
```

```ts
import { KDiagram } from "@kekonic/diagrams";

const result = await KDiagram.renderToSvg(source, {
  theme: "light",
  snapshotTheme: true,
});

if (!result.ok || !result.svg) {
  throw new Error(result.diagnostics.map((item) => item.message).join("\n"));
}
```

Start with the [quickstart](https://diagrams.kekonic.com/start/quick-start/), browse the
[gallery](https://diagrams.kekonic.com/gallery/), or learn the model in
[Meet Kekonic Diagrams](https://diagrams.kekonic.com/start/).

For immediate authoring, open the hosted [Kekonic Diagrams Studio](https://diagrams.kekonic.com/studio/).

For agent-assisted design, install the host-neutral
[`design-kekonic-diagrams` skill](https://diagrams.kekonic.com/design/agents/). It teaches agents
to ground diagrams in supplied facts, choose the right view, and validate the result with KDiagram's
deterministic CLI rather than inventing architecture or presentation details.
It edits local `.kdiagram` files, keeps layout and presentation choices in the DSL, and exports
portable output without an account. Run `kdiagrams studio` when you want the same experience backed
by repository file watching and opt-in writes.

For native `.kdiagram` diagnostics, completion, formatting, live preview, SVG export, and rendered
Markdown fences, use the first-party
[VS Code extension](https://diagrams.kekonic.com/start/vscode/). It also targets compatible VS
Code derivatives such as Cursor.

## Publish and embed

Static SVG works in READMEs, wikis, generated sites, and CI artifacts. When readers need pan, zoom,
theme switching, source updates, or animation controls, mount the same source in a browser.

Framework-agnostic custom element:

```ts
import "@kekonic/diagrams-element";
```

```html
<k-diagram source="…" theme="auto" height="480"></k-diagram>
```

React:

```tsx
import { KDiagramLive } from "@kekonic/diagrams-ui";

<KDiagramLive source={source} theme="auto" autoplay />;
```

Use `@kekonic/diagrams-ui/playground` when the source should remain editable. Full recipes:
[web component](https://diagrams.kekonic.com/publish/web-component/),
[React](https://diagrams.kekonic.com/publish/react/),
[static SVG](https://diagrams.kekonic.com/publish/svg/), and
[CI](https://diagrams.kekonic.com/publish/ci/).

Documentation sites can render fenced blocks at build time with
[`@kekonic/diagrams-remark`](https://diagrams.kekonic.com/publish/markdown/) or
`@kekonic/diagrams-markdown-it`. Standalone files can be imported through
[`@kekonic/diagrams-unplugin`](https://diagrams.kekonic.com/publish/build-tools/) as static
SVG, a self-contained URL, source text, a React component, or a custom-element class.

## Packages

| Package                              | Role                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| `@kekonic/diagrams`                  | Default SDK: parse through SVG/live render                 |
| `@kekonic/diagrams-cli`              | Render, check, inspect, format, and launch Studio          |
| `@kekonic/diagrams-studio`           | Host-neutral authoring synchronization and browser Studio  |
| `@kekonic/diagrams-language-service` | Shared browser and LSP language intelligence               |
| `@kekonic/diagrams-build`            | Shared infrastructure for build and Markdown adapters      |
| `@kekonic/diagrams-markdown-it`      | Static KDiagram fences for Markdown-it documentation hosts |
| `@kekonic/diagrams-remark`           | Static KDiagram fences for Remark and Unified hosts        |
| `@kekonic/diagrams-unplugin`         | `.kdiagram` imports for Vite and compatible bundlers       |
| `@kekonic/diagrams-element`          | Lit `<k-diagram>` host                                     |
| `@kekonic/diagrams-ui`               | React live embed, playground, static helper, Shiki grammar |
| `diagrams`                           | First-party VS Code and compatible-editor extension        |

Lower-level core, geometry, layout, routing, SVG, theme, and icon packages are published for custom
pipelines. Start with Studio for authoring, then choose the CLI, Markdown adapter, build adapter,
element, or React package for the destination. Editor integrations can consume the Studio protocol
and language service.

## Releases

Pin exact package versions for production use. Published history and migration notes live in package
changelogs and [CHANGELOG.md](CHANGELOG.md); product priorities live in the public
[roadmap](ROADMAP.md).

## Develop

This monorepo uses [Vite+](https://viteplus.dev/guide/):

```bash
vp install
vp run ready
vp run dev   # Studio development host
vp run docs  # documentation site
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing public packages or docs. Product priority
lives in the [roadmap](ROADMAP.md); durable package and pipeline boundaries live in the
[architecture notes](docs/architecture/README.md).

MIT
