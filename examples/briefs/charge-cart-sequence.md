# Brief: Charge a cart

## Reader and question

**Audience:** A team drawing the checkout call and the event it publishes, with the few JSON fields that matter.

**Question:** What does `POST /checkout` send, and which event carries the amount?

**When appropriate:** A sequence whose messages are endpoints or events, and the reader needs a short excerpt rather than the whole body.

## Facts

The shopper posts a cart. Orders publishes `AuthorizeRequested`. Payments replies with an auth reference. Orders then publishes `OrderPlaced`, and the web tier returns `201`.

## Assumptions

- Amounts are minor units.
- The cart id is the idempotency key.
- `orders.v1` is the topic that carries `OrderPlaced`.

## Intentional omissions

- The card number and the rest of the tender.
- Retry and decline branches. Those belong on the checkout payment sequence.

## Layout / presentation policy

- The label is the call or event name. `payload` is the excerpt.
- Async messages stay open-headed. The card accent follows the message: call, event, or reply.
