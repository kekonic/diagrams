# `@kekonic/diagrams-import-plantuml`

Convert one expanded PlantUML sequence diagram into canonical Kekonic Diagrams source.

```ts
import { importPlantUml } from "@kekonic/diagrams-import-plantuml";

const result = importPlantUml(plantUml);
```

`result.source` is `.kdiagram` text when conversion succeeds. `result.fidelity.status` is
`converted`, `presentation-loss`, or `blocked`. Diagnostics use PlantUML source locations.
A blocked construct omits `source`, so a semantic gap is not saved as an approximate diagram.

The `plantuml-sequence-v1` profile accepts participants, actors, databases, queues, messages,
activations, returns, create and destroy, combined fragments, notes, dividers, titles, and
autonumber. Colors, stereotypes, creole markup, `skinparam`, and themes are reported as
presentation loss. Includes, macros, bidirectional arrows, and non-sequence diagrams are
blocked. Expand includes separately with PlantUML's preprocessor before importing the result.

The command-line entry is `kdiagrams import plantuml`. Native `.kdiagram` remains the authoring
language after conversion.
