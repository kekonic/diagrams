# Brief: Stripe webhook inbox

## Reader and question

**Audience:** Someone accepting Stripe webhooks.

**Question:** How do we answer Stripe quickly and still apply the payment once?

**When appropriate:** An inbound webhook. The caller waits. The capture does not.

## Facts

- Stripe POSTs and retries until the handler returns 200.
- A bad signature fails closed.
- The handler stores the Stripe event id, then enqueues `PaymentCaptured`. A worker applies the capture once.

## Assumptions

- Stripe treats any non-200 as retryable.
- The inbox unique key is the Stripe event id.

## Intentional omissions

- Endpoint secret rotation.
- Partial capture amounts.

## Layout / presentation policy

- Left to right: accept, durability, apply.
- Compact, metro, `groupAccent: false`.
