# Brief: Change data capture

## Reader and question

**Audience:** Someone publishing without an outbox row.

**Question:** How does `OrderPlaced` get published when Orders only inserts a row?

**When appropriate:** The connector observes the log, then publishes. That observation is `~>`, not a second command.

## Facts

- Orders inserts the order and does not publish.
- The connector tails the write-ahead log.
- It then hands `OrderPlaced` to `orders.v1`, and inventory consumes that topic.

## Assumptions

- There is no outbox row.
- The connector is the publisher.

## Intentional omissions

- Snapshot catch-up.
- The connector offset store.

## Layout / presentation policy

- Left to right: write, observe, inventory.
- Compact, metro, `groupAccent: false`.
