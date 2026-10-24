# Brief: Orders API contract

## Reader and question

**Audience:** Architecture reviewers deciding who owns a contract.

**Question:** Who provides the Orders API, and who requires it?

**When appropriate:** One provided contract and one required contract between two components. Use `order-hexagon` when the picture is the ports inside a single service.

## Facts

- Checkout requires the Orders API. That required interface is the socket.
- The Orders component provides the same contract. That provided interface is the ball.
- The `..>` from the socket to the ball is the assembly.
- `requires` and `provides` name the dependency direction. A bare edge into the ball would read as "depends on."

## Assumptions

- The socket opens east, so left-to-right reading puts the cup's opening toward the ball.
- The assembly is an ordinary dependency, not a new arrow operator.
- The glyphs are nodes in the row. They are not attached to a component face.

## Intentional omissions

- The hexagonal ports-and-adapters poster.
- Face attachment or a socket that rotates toward its neighbor.
- The rest of the order domain.

## Layout / presentation policy

- LR component | socket | ball | component.
- Compact density, orthogonal edges, `groupAccent: false`.
- Captions sit under the glyphs. Kind subtitles stay off.
