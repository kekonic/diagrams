# Kekonic Diagrams

The language and pictures teams use to describe architecture.

## Language

**Provided interface**:
A contract a component offers. Drawn as a ball.
_Avoid_: Lollipop, realization arrow

**Required interface**:
A contract a component needs. Drawn as a socket that opens east.
_Avoid_: Cup, face port

**Assembly**:
The dependency that joins a required interface to the provided interface it uses.
_Avoid_: Ball-and-socket connector, a new arrow operator
