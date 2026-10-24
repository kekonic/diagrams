# Brief: Partner webhook delivery

## Reader and question

**Audience:** Someone delivering `OrderConfirmed` to partners.

**Question:** How does one event become a signed POST per partner URL?

**When appropriate:** Outbound webhooks. Fan-out is into jobs, not into simultaneous sends.

## Facts

- A dispatcher reads active subscriptions and enqueues one signed job per URL.
- One sender takes each job and POSTs it with an HMAC.
- The other sender waits. Exhausted jobs sit on `deliveries.dlq`.

## Assumptions

- One queue message per subscription URL.
- Senders compete. They do not each POST the same job.

## Intentional omissions

- Signature rotation.
- Partner retry budgets beyond the dead-letter queue.

## Layout / presentation policy

- Left to right: dispatch, jobs, senders, partner endpoint.
- Compact, metro, `groupAccent: false`.
