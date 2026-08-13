# @kekonic/diagrams-element

Lit web components for embedding KDiagram diagrams in any page — no React required.

## Install

```bash
pnpm add @kekonic/diagrams-element @kekonic/diagrams
```

Import the element once in your bundled app:

```ts
import "@kekonic/diagrams-element";
```

The component carries its diagram styles. Import `@kekonic/diagrams/theme.css` only for host
CSS variable overrides. For a no-build HTML page, load the package through an ESM CDN; browsers do
not resolve bare npm package names or `node_modules` URLs directly.

## `<k-diagram>`

```html
<k-diagram id="checkout" theme="auto" height="420"></k-diagram>

<script type="module">
  const diagram = document.querySelector("#checkout");
  diagram.source = `diagram {
    direction LR
    api: gateway "API"
    checkout: service "Checkout"
    api -> checkout
  }`;
</script>
```

Assign multiline source through the JavaScript property rather than escaping it into an HTML
attribute.

### No-build CDN

Import the published package directly in a modern browser:

```html
<k-diagram id="checkout" theme="auto" height="420"></k-diagram>

<script type="module">
  import "https://esm.sh/@kekonic/diagrams-element@x.y.z";

  const diagram = document.querySelector("#checkout");
  diagram.source = `diagram {
    api: gateway "API"
    checkout: service "Checkout"
    api -> checkout
  }`;
</script>
```

Replace `x.y.z` with the package version you have chosen and pin it in CDN URLs. Prefer an installed
dependency and lockfile for application builds.

### Attributes / properties

| Name                 | Type                                        | Default  | Notes                                              |
| -------------------- | ------------------------------------------- | -------- | -------------------------------------------------- |
| `source`             | string                                      | `""`     | KDiagram source. Updates call `controller.update`. |
| `theme`              | `"dark"` \| `"light"` \| `"auto"` \| string | `"auto"` | `"auto"` follows `html[data-theme]`.               |
| `height`             | string \| number                            | `420`    | Viewport height (`px` if number).                  |
| `frameless`          | boolean                                     | `false`  | Remove the host border and panel background.       |
| `show-theme-toggle`  | boolean                                     | `true`   | Set `"false"` to hide.                             |
| `show-view-controls` | boolean                                     | `true`   | Zoom / fit / fullscreen.                           |
| `show-stats`         | boolean                                     | `false`  | Compact layout stats badge.                        |
| `animation-controls` | boolean                                     | `true`   | Playback controls when animations exist.           |
| `animation`          | string                                      | first    | Preferred animation name or ID.                    |
| `autoplay`           | boolean                                     | `false`  | Begin playback after the first render.             |
| `loop`               | boolean                                     | `false`  | Loop the selected animation.                       |

### Methods

| Method                   | Notes                                   |
| ------------------------ | --------------------------------------- |
| `fit()`                  | Fit diagram to the viewport             |
| `zoomIn()` / `zoomOut()` | View controls                           |
| `resetView()`            | Reset pan/zoom                          |
| `ready()`                | Resolves when the first render finishes |

Same controller as `KDiagram.renderToElement` — pan, zoom, and theme swaps without remounting.
Built-in controls fade after brief pointer or keyboard inactivity, like video-player controls. They
return on activity and remain visible while a control has keyboard focus.

Use `frameless` for a diagram that should sit directly in a page composition. It removes the host
border and panel background without changing control settings.

Docs: [Web component](https://diagrams.kekonic.com/publish/web-component/).
