# Views and intent (draft)

Status: **draft** — gated on `kdiagram 2`. `kdiagram 1` documents keep current behavior.

## Problem

Many real systems need several pictures of the same topology (context, containers, deployment,
review deck). Today that forces copy-paste `.kdiagram` files (`storefront-context`,
`storefront-containers`, `order-fulfillment`, `order-review-slide`). Provenance (audience,
question, intentional omissions) lives in separate brief markdown files.

## Principles

1. **`diagram { … }` remains the default.** One block is a self-contained model plus implicit
   single view. No modeling ceremony for simple diagrams.
2. **`model` + embedded `view` is opt-in elevation** when duplication or drift hurts.
3. **Intent is optional metadata** about the lens, not a second modeling language. It never renders
   into SVG by default.
4. **Views compile to `GraphModel`.** Layout, routing, and SVG packages stay unchanged.
5. **Sequence and state stay standalone** in v1 — no shared system model across families yet.

## Document shapes

### Standalone diagram (unchanged)

```kdiagram
diagram "Checkout" {
  intent {
    audience: "On-call engineers"
    question: "What happens when payment fails?"
    omits: "Analytics pipeline"
  }
  layout { direction: LR }
  api: gateway "API"
  // ...
}
```

### Shared model with views (`kdiagram 2`)

```kdiagram
kdiagram 2

model "Storefront" {
  customer: person "Customer" { … }
  boundary commerce "Commerce platform" {
    web: container "Web application" { … }
    api: container "API application" { … }
  }

  view context {
    intent { question: "Who uses the platform?" }
    include customer, commerce, stripe, warehouse, email
    exclude commerce.*
    collapse commerce as platform: system "Commerce platform"
    layout { direction: TD }
  }

  view containers {
    include customer, commerce.*, stripe, warehouse, email
    layout { direction: LR }
  }
}
```

## Layering

```text
parse(source) → DocumentAst
resolve target (diagram index | view name)
buildSemanticGraph(model statements) → SystemModel
projectView(systemModel, view spec) → GraphModel
extractHints(view statements) → layout / routing / render hints
existing measure → layout → route → render pipeline
```

| Layer           | Holds                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **SystemModel** | Node/edge/group/style identity and semantics                              |
| **View spec**   | `intent`, `include`/`exclude`/`collapse`, layout, presentation, animation |
| **GraphModel**  | Projected view graph (today’s compile output)                             |

## View projection (v1)

- **`include`**: union of selectors; when omitted, all model elements start visible.
- **`exclude`**: remove matches after includes.
- **Selectors**: bare id, `prefix.*` (node id prefix or group subtree), `*`.
- **`collapse group as id: kind "Label"`**: replace a group subtree with one summary node; hide
  internal nodes and internal edges.
- **Edges**: kept when both endpoints are visible after projection.

Deferred: implied C4 edges across abstraction levels, tag-based selectors.

Implemented in this draft:

- **`import "./path.kdiagram"`** (requires `kdiagram 2`) — resolved from CLI, studio, and analyze when a source path is available; models with the same name merge statements and views.
- **`kdiagrams analyze --compare-layouts`** — renders every model view and scores shared-node layout stability.
- **Studio view switcher** — `selectView` protocol message and view picker in the editor chrome.

## CLI

```bash
kdiagrams render storefront-model.kdiagram --view context -o context.svg
kdiagrams render storefront-model.kdiagram --view containers
kdiagrams analyze storefront-model.kdiagram --compare-layouts --pretty
```

Standalone diagrams ignore `--view`. `--diagram-index` continues to select top-level blocks.

`kdiagrams graph --json` includes `payload.targets` for model views and resolves imports when reading from disk.

## Cross-file import

```kdiagram
kdiagram 2
import "./storefront-core.kdiagram"

model "Storefront" {
  view context { include customer, commerce, partners … }
}
```

The core file holds shared nodes and edges; view files (or overlay models) declare lenses. Circular imports produce `FM234`; missing files produce `FM235`.

## Layout stability

`analyze --compare-layouts` normalizes node centers per view, measures drift for shared node ids, and emits `view-layout-instability` when stability drops below 0.55. Use it to keep context and container lenses visually coherent.

## Studio

When a document exposes model views, Studio shows a **view** picker beside the file selector. Connected sessions send `resolvedSource` after import resolution so the browser preview matches CLI output.

## Breaking changes

- New syntax requires `kdiagram 2` header.
- `CompileResult` may include optional `intent` and `view` metadata.
- Capabilities manifest documents v2 constructs; v1 surface unchanged.

## Open questions

- Tag-based `include tag:external`
- Cross-view layout stability contract tuning (weights, collapse-aware matching)
- Intent lint rules (`omits` vs visible nodes) — partial FM230–FM232 landed
