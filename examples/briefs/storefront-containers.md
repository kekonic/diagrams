# Brief: Storefront containers

## Reader and question

**Audience:** Developers who already know the system context and need the deployable parts.

**Question:** Which separately running applications and stores make up the commerce platform, and how do they talk to people and outside systems?

**When appropriate:** C4 container view of the same commerce platform as `storefront-context`. A container is an application or data store, not a Docker image.

## Facts (established)

- Customers use a web application (SPA) to browse and check out.
- An API application accepts orders, authorizes payment, and records an outbox.
- Orders persist in a PostgreSQL database (orders + outbox).
- After commit, OrderPlaced is published; inventory and notifications continue asynchronously.
- Inventory service reserves stock and releases warehouse picks; it has its own database.
- Notification worker sends confirmation email.
- Stripe, warehouse, and email provider remain external software systems.

## Assumptions

- Checkout HTTP and order lifecycle run in one API application at this level (the outbox relay is a component of that application, not its own container).
- The message broker is omitted here; async `=>` edges carry OrderPlaced. Topic/DLQ topology lives in `order-fulfillment`.
- Technology tags (SPA, Node.js, PostgreSQL) match the commerce corpus.

## Intentional omissions

- Outbox relay as a separate process (shown as a component in `storefront-components`).
- Message bus, topics, DLQ.
- Hexagonal ports and adapters (`order-hexagon`).
- Sequence timing (`order-fulfillment-sequence`).
- C4 code-level classes.

## Layout / presentation policy

- Direction: LR — person, system boundary of containers, then external systems.
- Density: `spacious`.
- `boundary` labeled with the software system name.
- Data stores are `container` with `shape: cylinder` so the type line still says Container.
- Kind subtitles on. Relationship labels include protocol where it is known.
