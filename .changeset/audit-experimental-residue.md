---
"@kekonic/diagrams": minor
"@kekonic/diagrams-cli": minor
"@kekonic/diagrams-core": minor
"@kekonic/diagrams-geometry": minor
"@kekonic/diagrams-icons": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-ui": patch
"@kekonic/diagrams-website": patch
---

Remove pre-1.0 experimental residue that no supported consumer owns: renderer selection and layout
contribution profiles, the redundant CLI renderer flag and SVG marker, unreachable removed-flag
handling, obsolete authoring-state storage migrations, and unused public type and icon-size aliases.

Keep and document the supported registry contracts, authored shape synonyms, documentation
redirects, and the development-only example-save boundary.
