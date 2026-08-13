# @kekonic/diagrams-ui

React components and browser-facing helpers for KDiagram:

- **UI tokens** — shared application colors and typography (`@kekonic/diagrams-ui/chrome.css`)
- **Shiki grammar** — KDiagram language for Starlight / Expressive Code (`@kekonic/diagrams-ui/shiki`)
- **Embed helpers** — `renderKDiagramSvg` (SSR), `KDiagramLive` (React → Lit `<k-diagram>`), `KDiagramPlayground` (editable + live)

## Usage

```ts
import { renderKDiagramSvg, KDiagramLive } from "@kekonic/diagrams-ui";
import { KDiagramPlayground } from "@kekonic/diagrams-ui/playground";
import { kdiagramLanguage } from "@kekonic/diagrams-ui/shiki";
```

```css
@import "@kekonic/diagrams-ui/chrome.css";
@import "@kekonic/diagrams-ui/live.css";
@import "@kekonic/diagrams-ui/playground.css";
```

`KDiagramLive` is a thin `@lit/react` wrapper around `@kekonic/diagrams-element`’s
`<k-diagram>`. Prefer the Lit element directly outside React.

The root entry contains the static helper and live React embed only. Playground and Shiki use
separate entry points so a live diagram does not pull editor/highlighter code. `KDiagramPlayground`
lazy-loads Shiki and passes animation selection, autoplay, loop, and control props to its live view;
pair it with Astro `client:visible` when the editor starts below the fold.

Both live components accept `frameless` to remove the diagram host border and panel background;
controls remain independently configurable.

Docs: [React](https://diagrams.kekonic.com/publish/react/) / [Editable playground](https://diagrams.kekonic.com/publish/react/#editable-playground).
