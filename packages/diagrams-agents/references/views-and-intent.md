# Models, views, and intent (`kdiagram 2`, draft)

Use a shared **`model`** with embedded **`view`** lenses when several pictures share one topology
(C4 context + containers, review deck + detail). Keep a single `diagram { … }` for one-off
pictures — no modeling ceremony.

## When to elevate

Elevate when copying nodes between files causes drift, or when Studio/docs need a view picker.
Stay on standalone diagrams when there is only one lens.

One self-contained `.kdiagram` file per model. There is **no** cross-file `import` in this draft.

## Shape

```kdiagram
kdiagram 2

model "Storefront" {
  // semantic nodes, edges, groups only — no layout here
  customer: person "Customer"
  boundary commerce "Commerce platform" { … }

  view context {
    intent {
      audience: "Developers joining the platform"
      question: "Who uses the platform?"
      omits: "Internal containers"
    }
    include customer, commerce, stripe
    collapse commerce as platform: system "Commerce platform" {
      description: "Coordinates checkout, payment, and fulfillment."
    }
    layout { direction: TD }
  }

  view containers {
    include customer, commerce.*, stripe
    layout { direction: LR; groupLayout: compound }
  }
}
```

`intent { … }` is editorial metadata (audience, question, scope, omits, assumptions, evidence). It
never renders into SVG by default.

## CLI and hosts

```bash
kdiagrams render storefront-model.kdiagram --view context -o context.svg
kdiagrams analyze storefront-model.kdiagram --compare-layouts --pretty
```

`--compare-layouts` scores shared-node layout drift across model views. It is **not** the same as
the editorial layout A/B process in [compare-layouts.md](compare-layouts.md) (direction / density
alternatives for a single diagram).

Studio and `<k-diagram show-view-switcher>` expose a view picker when two or more views exist.

## Flagship example

Prefer the repo example `examples/storefront-model.kdiagram` (gallery: Storefront — shared model with
views) over maintaining separate `storefront-context` / `storefront-containers` copies when teaching
shared topology.
