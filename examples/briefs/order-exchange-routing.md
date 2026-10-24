# Brief: Exchange routing

## Reader and question

**Audience:** Someone picking a binding style.

**Question:** How do an exact key, a wildcard, a header, and an unmatched key select a queue?

**When appropriate:** Four publishes. Each row is one exchange, not one message hitting every exchange.

## Facts

- A direct exchange binds `inventory` on `orders.placed`.
- A topic exchange binds `notifications` on `orders.*`.
- A headers exchange binds `us-east` on `region=us`.
- `orders.other` matches nothing and falls through to the alternate exchange.

## Assumptions

- One publish targets one exchange.
- The dead-letter path is the alternate exchange, not a consumer retry.

## Intentional omissions

- Binding management.
- Priority queues.

## Layout / presentation policy

- Four stacked rows, orthogonal routing, compact, `groupAccent: false`.
