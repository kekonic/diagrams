# Examples

Grounded dogfood diagrams for tests, Studio, the website gallery, and the published
`design-kekonic-diagrams` skill. Prefer these over inventing one-off playground samples.

The corpus is indexed by [`catalog.json`](catalog.json). Narrative views share one fictional
commerce storefront; atlas files are language catalogs, not system maps. Each narrative file has a
brief under [`briefs/`](briefs/).

| File                                  | What it shows                                                           |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `storefront-context.kdiagram`         | C4 system context: customer, platform, Stripe / warehouse / email       |
| `storefront-containers.kdiagram`      | C4 containers inside that platform                                      |
| `storefront-components.kdiagram`      | C4 components inside the API application                                |
| `order-fulfillment.kdiagram`          | Container / event map with team ownership, outbox, DLQ (canonical hero) |
| `order-hexagon.kdiagram`              | Ports and adapters around PlaceOrder                                    |
| `order-placed-events.kdiagram`        | `OrderPlaced` fan-out and dead-letter path                              |
| `order-fulfillment-sequence.kdiagram` | Same path as a sequence (not an orchestrator product demo)              |
| `order-lifecycle.kdiagram`            | First-class `state` lifecycle with illustrative guards                  |
| `refund-request.kdiagram`             | Swimlane refund workflow with approval and deny path                    |
| `checkout-schema.kdiagram`            | ERD for checkout persistence                                            |
| `order-review-slide.kdiagram`         | Same fulfillment topology with light/metro review chrome                |
| `language-kinds-and-edges.kdiagram`   | Language atlas: kinds, content knobs, edge operators                    |
| `geometry-kinds.kdiagram`             | Geometry kinds and aliases                                              |
| `architecture-icons.kdiagram`         | Lucide / logos / simple-icons pack (no fake topology)                   |

Icons are author-opt-in (`icon: shopping-cart`, `icon: logos:aws`). Prefer authored subtitles over
`subtitle: true`, except C4 views which turn on `showKindSubtitles` so the type line (Person,
Software System, Container, Component) is visible.

**Arrange tip:** Prefer edges _between_ arranged columns/bands. Sibling edges inside an
`arrange: stack` often loop around the column — keep those columns as visual packs and wire
across column boundaries instead.

On leaf groups (nodes only): `arrange: pack` = horizontal wrap, `arrange: stack` = vertical
column. Use `arrange: row|grid` on parents that contain child groups.

Avoid `density: roomy` / `comfortable` — they error `FM112`. Use `compact`, `normal`, or `spacious`.

Website docs load these files as the gallery / showcase source of truth. Teaching-only snippets
stay in the docs site data module, not here. The skill package keeps a copy of
`order-fulfillment` under `packages/diagrams-agents/references/examples/` that must match this
tree.
