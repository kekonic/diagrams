# Brief: Order service — ports and adapters

## Reader and question

**Audience:** NestJS / backend developers aligning on clean architecture vocabulary.

**Question:** How do many delivery channels and infrastructure adapters converge on one application core while keeping dependencies inward?

**When appropriate:** Hexagonal / ports-and-adapters teaching overview for one service. Not a runtime sequence and not a full Nest module wiring guide.

## Facts

- Driving adapters: HTTP, GraphQL, Stripe webhook, Kafka, and a muted CLI test adapter all map into `CreateOrderCommand`.
- Inbound port: `CreateOrderCommand` is the entry contract (adapters map into it).
- Application handler: `CreateOrderHandler` orchestrates domain work via outbound ports.
- Domain: `Order` aggregate owns business rules; zero infrastructure dependencies.
- Outbound ports: `OrderRepositoryPort`, `PaymentPort`, `EventPublishPort`.
- Driven adapters: Postgres + in-memory (repo), Stripe payment client, outbox publisher → `orders.v1`.
- Externals: Database, Stripe, `orders.v1`.

## Assumptions

- Outer row is chromeless hex shape with driving | service surround | driven; service keeps hex chrome.
- Inner service hex uses `arrange: surround`: inbound port west; outbound ports east; hub is Application + Domain.
- Static dependency story is primary (`..>`). Sparse runtime edges to externals.
- Nest module token binding is omitted.

## Intentional omissions

- Domain event class boxes (`OrderCreatedEvent`).
- Full folder tree and Nest `@Module` providers.
- Socket-on-face port glyphs.
- Exhaustive implements labels on every edge.

## Layout / presentation policy

- `groupAccent: true`; `density: spacious`.
- Nested hex chrome: outer row hex, service surround hex, application stack hex.
- Edge ops: `..>` for maps-to / depends-on / implements; `->` / `=>` for adapter → external.
