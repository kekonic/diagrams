# Kekonic Diagrams

The language for a diagram that says what a system does. A picture is a view of those relationships, not a second model.

## Language

**Synchronous call**:
A relationship where the sender waits for the receiver. Written `->`.
_Avoid_: directed flow, request arrow

**Asynchronous handoff**:
A relationship where the sender delivers a message and does not wait. Written `=>`. Publishing and enqueueing are both handoffs.
_Avoid_: event edge, async event, publish arrow

**Eventual observation**:
A relationship where a reader sees an earlier write later, and no message is sent on this edge. Written `~>`.
_Avoid_: async, delayed message, signal flow

**Channel**:
The pipe a message travels through. A queue, a topic, a stream, or the broker that hosts them.
_Avoid_: bus, pipe

**Queue**:
A channel that delivers one message to one consumer.
_Avoid_: topic, bus

**Topic**:
A channel that keeps a record for any number of subscribers.
_Avoid_: queue, event

**Stream**:
An ordered topic. It uses the same silhouette as a topic.
_Avoid_: queue

**Broker**:
The messaging product that hosts channels.
_Avoid_: topic, gateway

**Event**:
A business fact that has already happened, named in the past tense. It is the message, not the channel.
_Avoid_: topic, command

**Command**:
A request to do something, named as an action. It is the message, not the channel.
_Avoid_: event, call

**Provided interface**:
A contract a component offers. Drawn as a ball.
_Avoid_: Lollipop, realization arrow

**Required interface**:
A contract a component needs. Drawn as a socket that opens east.
_Avoid_: Cup, face port

**Assembly**:
The dependency that joins a required interface to the provided interface it uses.
_Avoid_: Ball-and-socket connector, a new arrow operator
