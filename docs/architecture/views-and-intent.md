# Views over a shared model (draft)

Status: **draft**, gated on `kdiagram 2`. Standalone `diagram { … }` remains the default
one-shot form (conceptual sugar for a model plus one implicit view). Elevate to `model` + named
`view`s when the same nodes should drive multiple lenses without copying topology.

## Goals

1. **Declare nodes and structural groups once** — wiring, layout, presentation, and animation live
   on each view.
2. **Keep the DSL simple** — `include` / `exclude` for selection; explicit summary nodes for level of
   detail (no `collapse`, no `intent` metadata block).
3. **One self-contained `.kdiagram` file per model** — no cross-file language `import`. Hosts or
   agents may splice or generate files outside the grammar.
4. **Views compile to `GraphModel`.** Layout, routing, and SVG packages stay unchanged.

## Language sketch

### Standalone diagram (default)

```kdiagram
diagram "Checkout" {
  api: service "API"
  db: database "Orders"
  api -> db
  layout { direction: LR }
}
```

### Shared model with views (`kdiagram 2`)

```kdiagram
kdiagram 2
model "Storefront" {
  customer: person "Customer"
  platform: system "Commerce platform"
  boundary commerce "Commerce platform" {
    web: container "Web"
    api: container "API"
  }
  stripe: external "Stripe"

  view context {
    include customer, platform, stripe
    customer -> platform
    platform -> stripe
    layout { direction: TD }
  }

  view containers {
    include customer, commerce.*, stripe
    customer -> web
    web -> api
    api -> stripe
    layout { direction: LR; groupLayout: compound }
  }
}
```

## Ownership

| Layer             | Owns                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| **`model`**       | Nodes, structural groups, shared styles                                              |
| **`view`**        | `include` / `exclude`, **edges**, layout, presentation, animation, edge-route policy |
| **`diagram { }`** | One-shot sugar — nodes/groups with co-located edges and presentation                 |

Multi-view files: edges are **illegal** in the model body (`FM222`). Put `a -> b` inside each view.

Level of detail: put an explicit summary node (e.g. `platform: system "…"`) in the model and
`include` it from a coarse view; fine views `include` the detailed subtree instead.

## Compile pipeline

```text
parse(source) → DocumentAst
resolve target (diagram index | view name)
compile model nodes/groups + selected view body → GraphModel
projectView(include/exclude) → filtered GraphModel
existing measure → layout → route → render pipeline
```

### Scope rules

- **`include`**: union of selectors; when omitted, all model nodes start visible.
- **`exclude`**: remove matches after includes.
- **Selectors**: bare id, `prefix.*` (node id prefix or group subtree), `*`.
- **Parent groups**: keep ancestors that own region layout (`arrange` / columns / rows).
- **Edges**: come from the selected view; kept when both endpoints remain visible after projection.

Unresolved include/exclude selectors warn with **`FM233`**.

## Default view

When `--view` / host view is omitted: prefer a view named `default`, then `main`, else the first
view in source order.

## CLI and hosts

```bash
kdiagrams render storefront-model.kdiagram --view Context -o context.svg
kdiagrams render storefront-model.kdiagram --view containers
kdiagrams render storefront-model.kdiagram --view components
```

`kdiagrams graph --json` includes `payload.targets` for model views. Studio and embed show a view
picker when a document exposes 2+ model views.

## Out of scope (this draft)

- Cross-file `import` / shared model modules
- Tag selectors
- Implied C4 edges across abstraction levels
- Animated transitions _between_ views (named `animation` blocks on a view remain supported)
- Multi-family projection (e.g. sequence from the same model) — topology graph views only

## Open questions

- Whether large repos need shared models without copy-paste (outside the language)
- In-file fragments if one-file models become painfully repetitive
- Future `type:` / diagram-family knobs on views
