# Models and views (`kdiagram 2`, draft)

Use a shared **`model`** with embedded **`view`** lenses when several pictures share one topology
(C4 context + containers, review deck + detail). Keep a single `diagram { … }` for one-off
pictures — no modeling ceremony.

## When to elevate

Elevate when copying nodes between files causes drift, or when Studio/docs need a view picker.
Stay on standalone diagrams when there is only one lens.

One self-contained `.kdiagram` file per model. There is **no** cross-file `import` in this draft.

## Ownership

| Layer             | Owns                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| **`model`**       | Nodes, structural groups, shared styles                                              |
| **`view`**        | `include` / `exclude`, **edges**, layout, presentation, animation, edge-route policy |
| **`diagram { }`** | One-shot sugar — nodes/groups with co-located edges and presentation                 |

Multi-view files: edges are **illegal** in the model body (`FM222`). Put `a -> b` inside each view.

Level of detail: put an explicit summary node (for example `platform: system "…"`) in the model and
`include` it from a coarse view; fine views `include` the detailed subtree instead.

## Shape

```kdiagram
kdiagram 2

model "Storefront" {
  customer: person "Customer"
  platform: system "Commerce platform" {
    description: "Lets customers check out and coordinates payment."
  }
  boundary commerce "Commerce platform" {
    web: container "Web application"
    api: container "API application"
  }
  stripe: external "Stripe"

  view context {
    include customer, platform, stripe
    customer -> platform "Uses"
    platform -> stripe "Charges"
    layout { direction: TD }
  }

  view containers {
    include customer, commerce.*, stripe
    customer -> web "Browses"
    web -> api "Places orders"
    api -> stripe "Charges"
    layout { direction: LR; groupLayout: compound }
  }
}
```

## CLI and hosts

```bash
kdiagrams render storefront-model.kdiagram --view context -o context.svg
kdiagrams render storefront-model.kdiagram --view containers
kdiagrams render storefront-model.kdiagram --view components
```

When `--view` is omitted, the compiler prefers a view named `default`, then `main`, else the first
view in source order.

Studio and `<k-diagram show-view-switcher>` expose a view picker when two or more views exist.

## Flagship example

Prefer the repo example `examples/storefront-model.kdiagram` (gallery: Storefront — shared model with
views) when teaching shared topology across context, containers, and components.

Architecture notes: `docs/architecture/views-and-intent.md`.
