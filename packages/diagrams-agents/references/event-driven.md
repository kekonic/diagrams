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

Use `->` for a direct call, `=>` for an event or asynchronous message, and `..>` for a code or
hosting dependency. Name events in the past tense, such as `OrderPlaced`. Name commands as actions,
such as `PlaceOrder`.

On a sequence, keep that name as the message label. An HTTP call can be the method and the route
with no quotes, `POST /checkout` or `GET /orders/{id}`. When the reader needs a few JSON fields, put
them in `payload` between `"""` so the quotes stay as written. Do not paste the body into the
label, and do not repeat the excerpt on the consumer when the publish already showed it.

The broker carries an event; it does not own the business event. Show which service creates or
publishes it. Do not imply guaranteed ordering, exactly-once delivery, or compensation unless the
user or inspected system establishes it.

Group consumers and stores by their real owners. Do not draw every retry and dead-letter path
across the main event map. Move those details into the failure-handling diagram. If KDiagram reports
layout problems, reorganize or split the diagram before delivery.
