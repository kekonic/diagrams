# Brief: Inventory inbox

## Reader and question

**Audience:** Someone making inventory safe under redelivery.

**Question:** How does inventory apply `OrderPlaced` once when the topic can deliver it again?

**When appropriate:** A consumer inbox. The publisher outbox is a different diagram.

## Facts

- `orders.v1` is at least once.
- The worker inserts the message id into the processed inbox, then reserves stock and releases the pick.
- A duplicate id means the reserve does not run again.

## Assumptions

- The unique key is the message id.
- Failing the insert is the signal to stop.

## Intentional omissions

- The publisher outbox.
- Poison-message quarantine.

## Layout / presentation policy

- Left to right: the worker, then the stores it writes.
- Compact, metro, `groupAccent: false`.
