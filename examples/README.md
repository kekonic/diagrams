# Examples

Dogfood diagrams used by tests, the studio, and docs. Prefer these over inventing one-off
playground samples — they are the product showcase.

| File                                        | What it shows                                                     |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `checkout-architecture.kdiagram`            | Multi-plane checkout: icons, logos, metro, `->` / `=>` / `..>`    |
| `enterprise-rag.kdiagram`                   | Guarded RAG across ingress / orchestration / knowledge / controls |
| `layered-architecture.kdiagram`             | `arrange: stack` stretch bands (presentation / API / data)        |
| `hexagonal-architecture.kdiagram`           | Ports & adapters: Order core, driving/driven, queue-side contexts |
| `module-columns.kdiagram`                   | `arrange: row` equal-height columns + leaf `arrange: stack`       |
| `platform-grid.kdiagram`                    | `arrange: grid` named tracks, `rowSpan`, pack cells               |
| `platform-spans.kdiagram`                   | Grid `colSpan` full-width bands + `rowSpan` tall column           |
| `order-placed-pipeline.kdiagram`            | Event fan-out: queues, workers, sinks, DLQ (`=>`, `-x`)           |
| `customer-refund-request.kdiagram`          | Workflow: choices, approval lane, metro + jumps, priorities       |
| `temporal-order-workflow.kdiagram`          | Temporal: activities, signal+timer, child workflow, saga          |
| `temporal-order-workflow-sequence.kdiagram` | Same Temporal story as a sequence (`par` / `alt` / create)        |
| `demo-salesforce-overview.kdiagram`         | Membership account, parallel provisioning, then projection        |
| `demo-activation-channels.kdiagram`         | Salesforce and partner channels into write and read sides         |
| `demo-activation-paths.kdiagram`            | Happy path and validation-fail lanes after a common start         |
| `demo-new-joiner.kdiagram`                  | New joiner happy path — active household end to end               |
| `demo-no-programs.kdiagram`                 | Validation fail, no HealthRules write                             |
| `demo-on-hold.kdiagram`                     | On-hold household, Okta skipped                                   |
| `demo-duplicate.kdiagram`                   | Idempotent second activate                                        |
| `demo-closed-won-fail.kdiagram`             | Closed Won notification fails after membership write              |
| `demo-projection-paused.kdiagram`           | Cornerstone paused so the read model lags                         |
| `demo-ardr.kdiagram`                        | Accept now, result later                                          |
| `demo-ardr-no-programs.kdiagram`            | Accept now with validation fail                                   |
| `checkout-schema.kdiagram`                  | ERD tables + shipments, FK crow’s-feet, orthogonal + gaps         |
| `presentation-slide.kdiagram`               | Review chrome: title, group accents, multi-plane platform         |
| `architecture-icons.kdiagram`               | Lucide / `lucide:` / `logos:` / `simple-icons:` teach             |
| `builtin-kinds-and-edges.kdiagram`          | Broad kind catalog + every edge operator                          |
| `geometry-kinds.kdiagram`                   | Bare geometry kinds and aliases                                   |
| `node-content.kdiagram`                     | Subtitles, notes, scale, presentation knobs                       |

Icons are author-opt-in (`icon: shopping-cart`, `icon: logos:aws`). Kind eyebrows stay off unless
you set `showKindSubtitles: true` or a per-node `subtitle: "…"`.

**Arrange tip:** Prefer edges _between_ arranged columns/bands. Sibling edges inside an
`arrange: stack` often loop around the column — keep those columns as visual packs and wire
across column boundaries instead.

On leaf groups (nodes only): `arrange: pack` = horizontal wrap, `arrange: stack` = vertical
column. Use `arrange: row|grid` on parents that contain child groups.

Avoid `density: roomy` — it remaps to `comfortable` with warning `FM112` (ELK hitbox risk).
Prefer `comfortable` or `spacious` explicitly.

Website docs load these files as the gallery / showcase source of truth. Teaching-only snippets
stay in the docs site data module, not here.
