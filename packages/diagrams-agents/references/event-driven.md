# Event-driven systems

Decide what the reader needs to understand:

- who publishes events and who receives them;
- the order of one business interaction; or
- what happens when delivery fails.

Do not force all three into one picture. For a detailed system, use separate diagrams:

1. **Event map:** the command that starts the work, the service that publishes each event, the
   broker or topics, the consumers, and important data stores.
2. **Example interaction:** a sequence diagram showing one useful chain of commands and events.
3. **Failure handling:** retries, dead letters, duplicate handling, recovery, and operator action.

Give each diagram a clear name, visible title, and one sentence describing what it covers.

Use `->` for a direct call and `=>` for an asynchronous handoff. Use a `queue` when one consumer
takes the message, and a `topic` or `stream` when several subscribers observe the same record. A
`broker` hosts those channels; draw it when the product matters, and omit it when a direct handoff
is enough. Use `~>` only for an eventual observation, such as a read model catching up, not as
another publish. Use `..>` for a code or hosting dependency. Name events in the past tense, such as
`OrderPlaced`. Name commands as actions, such as `PlaceOrder`.

On a sequence, keep that name as the message label. An HTTP call can be the method and the route
with no quotes, `POST /checkout` or `GET /orders/{id}`. When the reader needs a few JSON fields, put
them in `payload` between `"""` so the quotes stay as written. Do not paste the body into the
label, and do not repeat the excerpt on the consumer when the publish already showed it. End the
sequence with a named animation of the chain a reader should follow. A second path, such as a
decline, gets its own animation. Quote the message label when a flow cue would otherwise match an
earlier arrow between the same participants: `flow payments -> bank "void hold"`.

The broker carries an event; it does not own the business event. Show which service creates or
publishes it. Do not imply guaranteed ordering, exactly-once delivery, or compensation unless the
user or inspected system establishes it.

Group consumers and stores by their real owners. Do not draw every retry and dead-letter path
across the main event map. Move those details into the failure-handling diagram. If KDiagram reports
layout problems, reorganize or split the diagram before delivery.

## Examples

Prefer these commerce pictures over a new sketch when the pattern matches:

- `checkout-choreography.kdiagram` — outbox, two result topics, then confirm. Sequence companion: `checkout-choreography-sequence.kdiagram`.
- `checkout-orchestration.kdiagram` — command queues and a reply topic. Sequence companion: `checkout-orchestration-sequence.kdiagram`.
- `checkout-compensation.kdiagram` — `PaymentFailed`, then `ReleaseStock`.
- `delivery-guarantees.kdiagram` — at most once, at least once, outbox plus inbox. Not a broker exactly-once flag.
- `order-inbox.kdiagram` — consumer dedupe key.
- `order-sns-sqs.kdiagram` — one topic copied onto a queue per team.
- `charge-competing-consumers.kdiagram` — one queue delivery. Idle workers have no edge.
- `order-exchange-routing.kdiagram` — exact key, wildcard, header, unmatched key.
- `orders-partitioned-log.kdiagram` — two consumer groups, partitions by key.
- `order-cdc.kdiagram` — `~>` tails the log, then `=>` publishes.
- `order-claim-check.kdiagram` — id on the topic, body in the bucket.
- `partner-webhooks.kdiagram` — one signed job per subscription URL.
- `stripe-webhook-inbox.kdiagram` — the caller waits for 200; the capture is queued.

`order-placed-events.kdiagram` stays the short fan-out. `order-fulfillment.kdiagram` stays the system map.
