# Brief: API application components

## Reader and question

**Audience:** Developers opening the API application after reading the container view.

**Question:** Which components inside the API application handle checkout, persistence, payment, and publish?

**When appropriate:** C4 component view of one container (`API application`). Neighboring containers and external systems stay closed.

## Facts (established)

- The web application places orders over JSON/HTTPS.
- An HTTP-facing orders controller maps requests into CreateOrder.
- Order service applies policy, writes the outbox, and requests payment.
- Payment client talks to Stripe.
- Order repository reads and writes the orders database.
- Outbox publisher emits OrderPlaced to inventory and notifications after commit.

## Assumptions

- Controller / service / client / repository / publisher are the useful component split; they are not a class diagram.
- CreateOrder is the inbound command name from `order-hexagon`; hexagonal ports themselves belong in that diagram.
- Other containers (web, inventory, notification worker, orders database) are shown as containers, not expanded.

## Intentional omissions

- Hexagonal port types and adapter implementations (`order-hexagon`).
- Exact HTTP routes and SQL.
- Message bus topology.
- C4 code-level (UML classes). Kekonic Diagrams does not currently provide that view.

## Layout / presentation policy

- Direction: LR — calling container, API application boundary of components, then neighbors.
- Density: `spacious`. Kind subtitles on. Mix only closed containers/externals around the opened container.
- Relationship labels state intent; protocols on edges that leave the container.
