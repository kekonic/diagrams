# `@kekonic/diagrams-icons`

Icon resolution for KDiagram nodes — **Lucide by default**, plus optional Iconify collections and compact built-in stroke glyphs.

## Lucide-first DSL

Pick any [Lucide](https://lucide.dev/icons/) icon by kebab-case name:

```kdiagram
ada: user "Ada" { icon: user }
cart: service "Checkout" { icon: shopping-cart }
api: gateway "API" { icon: lucide:waypoints }
```

Bare names resolve to `lucide:<name>`. A few short names (`database`, `queue`, …) keep KDiagram's tiny built-in stroke set; everything else is Lucide unless you qualify a collection.

## Other collections

```text
lucide:cloud          → Lucide (default for bare names)
mdi:database          → Material Design Icons
logos:aws             → brand logo
carbon:kubernetes     → IBM Carbon
simple-icons:vercel   → Simple Icons
builtin:server        → compact KDiagram stroke glyph
```

```kdiagram
aws: icon { icon: logos:aws }
api: service "API" { icon: mdi:api }
```

## Icon color

Icons keep **brand / embedded colors by default**. Tint only the glyph with `iconColor` or
`--icon-color` (shell unchanged):

```kdiagram
cart: service "Checkout" {
  icon: shopping-cart
  iconColor: #f97316
}

aws: cloud "AWS" { icon: logos:aws }

style accentIcon {
  --icon-color: #38bdf8
}
api: gateway "API" { icon: waypoints; styles: [accentIcon] }
```

`iconPaint: theme` forces monochrome to `--icon-color` / `--node-stroke` (rarely needed).
`iconPaint: brand` is the default.

Helpers: `defaultIconPaint()`, `resolveIconPaint(rawId, override?, { hasIconColor })`. Pass
`paint` / `color` on `renderIconById` / `renderIconSvg` when rendering outside the DSL.

## Lazy loading

Node and CLI renders load installed `@iconify-json/*` collections locally. Browser renders fetch only
the requested icon names from the Iconify API and cache them; complete multi-megabyte collections are
not emitted into the default browser bundle.

```ts
import { preloadIcons, collectIconIds, resolveIcon } from "@kekonic/diagrams-icons";

await preloadIcons(collectIconIds(graph.nodes));
const glyph = resolveIcon("lucide:shopping-cart");
```

The KDiagram render pipeline preloads automatically before SVG draw.

For CSP-controlled or offline browser apps, use `registerIcon`, `registerCollection`, or
`registerCollectionLoader`. `setIconifyApiBaseUrl` points per-icon requests at a self-hosted Iconify
API-compatible endpoint.

Local Node hosts can build that bounded API response with `loadIconSubset(prefix, names)`. It reads
installed collections, resolves aliases, and returns only the requested glyphs; validate and limit
all request parameters before calling it. Kekonic Diagrams Studio uses this pattern to keep icons offline
without adding complete multi-megabyte collections to its browser bundle.

## API

- `parseIconId` / `normalizeIconId`
- `defaultIconPaint` / `resolveIconPaint`
- `preloadIcons` / `preloadCollections` / `resolveIcon` / `renderIconById`
- `registerIcon` / `registerCollection` / `registerCollectionLoader`
- `setIconifyApiBaseUrl` / `BUILTIN_ICON_ALIASES`
- `loadIconSubset` (trusted local Node hosts)
