# Brief: Competing charge workers

## Reader and question

**Audience:** Someone scaling charge workers.

**Question:** Who receives one `ChargeCard` when several workers listen?

**When appropriate:** Competing consumers. Not a fan-out.

## Facts

- Orders hands `ChargeCard` to the `charges` queue.
- One worker takes the delivery and writes the ledger. The other workers are idle.
- Five receives without success land on `charges.dlq`.

## Assumptions

- The queue delivers to one consumer.
- Idle workers are drawn in the pool with no edge, so the picture does not look like a copy per worker.

## Intentional omissions

- Visibility timeout values.
- Fairness across workers.

## Layout / presentation policy

- Left to right: queue, workers, ledger.
- Compact, metro, `groupAccent: false`.
