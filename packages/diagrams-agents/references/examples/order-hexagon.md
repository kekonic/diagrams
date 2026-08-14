# Reference example: order service ports and adapters

This example is the canonical hexagonal / ports-and-adapters poster for KDiagram. Copy the
process and layout grammar, not every Nest class name.

## Human prompt

> Draw a ports-and-adapters diagram for our order service. Driving adapters include HTTP, GraphQL,
> a Stripe webhook, Kafka, and a CLI test harness. They all enter through `CreateOrderCommand`.
> `CreateOrderHandler` uses the `Order` aggregate and depends on outbound ports for persistence,
> payments, and event publication. Driven adapters implement those ports: Postgres (plus an
> in-memory test double), Stripe payments, and an outbox publisher to `orders.v1`. Dependencies
> must point inward. Audience: NestJS developers aligning on clean architecture vocabulary.

## Questions asked and answered

| Question                     | Answer used in the diagram                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Static deps or runtime flow? | Static dependency direction is primary (`..>`). Sparse `->` / `=>` only to externals.         |
| Where do adapters live?      | Driving and driven stacks outside the service surround; ports sit on the surround ring.       |
| What is the inbound port?    | `CreateOrderCommand` — adapters map into it; they do not implement a driving interface.       |
| What is inside the hub?      | Application handler + Domain aggregate (nested hex / stack).                                  |
| Test adapters?               | Muted CLI (driving) and in-memory repo (driven) show swap-ability without Nest module wiring. |

## Reasoning summary

- Prefer `shape: hexagon` + `arrange: surround` for the application boundary: one nested hub group,
  satellite **nodes** on the ring (`side: west` inbound, `side: east` outbound).
- Stage driving | service | driven with a chromeless outer `arrange: row` (optional outer hex shape
  with `chrome: false`) so adapters sit outside the service stroke.
- Keep domain pure: no edges from `Order` to databases, Stripe, or Kafka.
- Mute test adapters; keep production adapters visually primary.
- Do not invent face-socket port glyphs — ports are ordinary `interface` nodes.

## Layout grammar to reuse

1. Outer chromeless row (optional hex silhouette, `chrome: false`).
2. Driving stack (west) → service hex surround → driven stack (east).
3. Service surround hub: Application stack (handler) containing Domain.
4. Inbound port `side: west`; outbound ports `side: east`.
5. Externals beside driven adapters (`Database`, `Stripe`, topic).

## Delivered artifacts

- Source: [order-hexagon.kdiagram](order-hexagon.kdiagram)
- Portable render: [order-hexagon.svg](order-hexagon.svg)
- Repo gallery twin: `examples/order-hexagon.kdiagram` (must stay identical to the packaged
  `.kdiagram` in `@kekonic/diagrams-agents`).

## Intentional omissions

- Nest `@Module` provider / token binding.
- Domain event class boxes.
- Exhaustive implements labels on every edge.
- Ports glued to hex faces.
