# Brief: Partitioned order log

## Reader and question

**Audience:** Someone keeping per-order order without giving every consumer a private queue.

**Question:** How can two groups read every `OrderPlaced` while one order stays in order?

**When appropriate:** A log partitioned by `orderId`, with two consumer groups.

## Facts

- The outbox relay appends `OrderPlaced` to `orders.v1`.
- Inventory members take disjoint partitions. Notifications is a separate group and reads every record.
- Ordering is inside a partition, not across the log.

## Assumptions

- Members of one group do not each receive a copy of the same record.
- The mailer group has one member in this picture.

## Intentional omissions

- Rebalance and consumer lag.
- Compacted topics.

## Layout / presentation policy

- The log spans the inventory group and the notifications group.
- Compact, metro, `groupAccent: false`.
