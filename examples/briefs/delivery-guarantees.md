# Brief: Delivery guarantees

## Reader and question

**Audience:** Someone choosing a retry and dedupe design for `ChargeCard`.

**Question:** What does at-most-once, at-least-once, and outbox-plus-inbox actually change?

**When appropriate:** One command, three guarantee shapes. Do not mark the broker exactly-once.

## Facts

- At most once: no retry, so a crash can drop `ChargeCard`.
- At least once: the producer retries, and the worker inserts a message id before it applies the charge.
- Outbox plus inbox: the order and the outbox row commit together, the relay publishes, and the inbox applies once.

## Assumptions

- The dedupe key is a unique message id in the consumer inbox.
- The outbox row commits in the same transaction as the business write.

## Intentional omissions

- Broker transactions.
- The idempotency key format.

## Layout / presentation policy

- Three stacked rows, orthogonal routing, compact, `groupAccent: false`.
