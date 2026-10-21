# Brief: Charge a cart

## Reader and question

**Audience:** A team drawing one checkout: the HTTP call, the event it publishes, and the reply that comes back.

**Question:** What does `POST /checkout` send, and which event carries the amount?

**When appropriate:** A sequence of endpoint calls and events where a few messages need a short excerpt, not a body on every arrow.

## Facts

The shopper posts a cart. Web calls Orders with `PlaceOrder`. Orders publishes `AuthorizeRequested` on `orders.v1`. Payments consumes that event and replies to Orders with an auth reference. Web returns `201 Created`.

## Assumptions

- Amounts are minor units.
- The cart id is the idempotency key.
- `orders.v1` carries `AuthorizeRequested`. The consumer does not repeat the excerpt the publish already showed.

## Intentional omissions

- The card number and the rest of the tender.
- The body of `201 Created`. The status is enough once the charge is authorized.
- Decline and retry. Those belong on the checkout payment sequence.

## Layout / presentation policy

- The label is the call or event name. `payload` is the excerpt, and only on the messages whose fields the reader needs.
- The consume hop and the `201` stay names only.
- Async messages stay solid with an open head. The card accent follows the message: call, event, or reply.
