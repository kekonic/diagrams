# @kekonic/diagrams-import-plantuml

## 1.0.0-rc.13

### Minor Changes

- 1800041: Asynchronous handoff (`=>`) and eventual observation (`~>`) stay distinct on flow diagrams and sequences, and both use an open arrowhead. A call (`->`) keeps the filled head. A flow handoff is a dashed open arrow and an eventual observation is a dotted open arrow. On a sequence, a handoff stays a solid open head and an eventual signal is dotted; a reply is still the dashed shaft. Sequence `=>` edges are kind `async`. Pub/sub is a `topic` or `stream`, and point-to-point is a `queue`; the channel can be omitted when it is not the question. PlantUML `->>` imports as `=>`.
  
  The gallery adds commerce examples for choreography, orchestration, compensation, delivery guarantees, inbox and outbox, topic fan-out to queues, competing consumers, exchange routing, partitioned logs, change data capture, claim check, and inbound and outbound webhooks.

### Patch Changes

- Updated dependencies [1800041]
- Updated dependencies [78cb333]
  - @kekonic/diagrams-core@1.0.0-rc.13

## 1.0.0-rc.12

### Patch Changes

- @kekonic/diagrams-core@1.0.0-rc.12

## 1.0.0-rc.11

### Patch Changes

- Updated dependencies [0bc6f4d]
  - @kekonic/diagrams-core@1.0.0-rc.11

## 1.0.0-rc.10

### Patch Changes

- Updated dependencies [2046663]
- Updated dependencies [2046663]
  - @kekonic/diagrams-core@1.0.0-rc.10

## 1.0.0-rc.9

### Minor Changes

- c15656c: Add a one-way PlantUML sequence importer. `importPlantUml()` and `kdiagrams import plantuml` convert an expanded sequence diagram into canonical `.kdiagram` source, with fidelity of `converted`, `presentation-loss`, or `blocked`. Includes, macros, and non-sequence diagrams produce diagnostics and no output file.

### Patch Changes

- Updated dependencies [6d45853]
  - @kekonic/diagrams-core@1.0.0-rc.9
