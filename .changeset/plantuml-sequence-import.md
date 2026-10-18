---
"@kekonic/diagrams-import-plantuml": minor
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-website": patch
---

Add a one-way PlantUML sequence importer. `importPlantUml()` and `kdiagrams import plantuml` convert an expanded sequence diagram into canonical `.kdiagram` source, with fidelity of `converted`, `presentation-loss`, or `blocked`. Includes, macros, and non-sequence diagrams produce diagnostics and no output file.
