# Changelog

All notable changes to publishable `@kekonic/diagrams*` packages are documented here.

**This file is historical.** Package versions are managed with
**[Changesets](https://github.com/changesets/changesets)**; `pnpm version-packages` appends entries
when releases are cut. For how to contribute and release, see [CONTRIBUTING.md](CONTRIBUTING.md).

Install without pinning unless you need a specific release:

```bash
pnpm add @kekonic/diagrams
```

## 1.0.0-rc.0 — 2026-07-29

First public release-candidate cut of the `@kekonic/diagrams*` line.

### Packages

| Package                        | Role                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `@kekonic/diagrams`            | Default SDK — parse through `renderToSvg` / `renderToElement` |
| `@kekonic/diagrams-cli`        | `kdiagrams` binary (`render`, `check`, `format`, …)           |
| `@kekonic/diagrams-element`    | Lit `<k-diagram>`                                             |
| `@kekonic/diagrams-ui`         | React `KDiagramLive` (thin Lit wrap) + `KDiagramPlayground`   |
| `@kekonic/diagrams-core`       | Parse / compile / kinds                                       |
| `@kekonic/diagrams-geometry`   | Shapes & ports                                                |
| `@kekonic/diagrams-layout`     | Measure + ELK                                                 |
| `@kekonic/diagrams-routing`    | Edge routing / crossings                                      |
| `@kekonic/diagrams-render-svg` | SVG renderer                                                  |
| `@kekonic/diagrams-theme`      | Tokens / CSS                                                  |
| `@kekonic/diagrams-icons`      | Icon resolution                                               |

### Highlights

- Text DSL for architecture, events, workflows, and ERD/tables
- ELK layered layout, orthogonal edges, crossing treatments
- Shared font metrics so browser preview matches CLI SVG
- Dark/light themes, `registerTheme`, `snapshotTheme` for portable SVG
- Interactive host: Lit custom element; React via `@lit/react`
- Job-based docs: wiki, git READMEs, static sites, HTML, React, CI, SDK
- Contribution tooling: Changesets, Conventional Commits, GitHub Actions CI/release, Dependabot
