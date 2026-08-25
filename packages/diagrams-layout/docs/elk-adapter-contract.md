# ELK adapter contract

Kekonic Diagrams keeps **semantic** graph data on `GraphModel` and maps it to elkjs only inside
`build-elk-graph.ts`. Presentation (metro corners, crossing jumps, theme) stays downstream.

## Mapping

| Graph / DSL                                        | ELK                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `direction`                                        | `elk.direction`                                                                                                                                                                                                                                                                                  |
| `density` / `spacingScale` / gap overrides         | spacing options                                                                                                                                                                                                                                                                                  |
| `groupLayout: compound`                            | `INCLUDE_CHILDREN` + nested group nodes (best for sequential phase boxes)                                                                                                                                                                                                                        |
| `groupLayout: flat`                                | Flat members for ELK + membership group boxes after (straighter cross-group edges)                                                                                                                                                                                                               |
| `groupLayout: swimlane` or `kind: swimlane`        | `elk.partitioning.*` + flat members                                                                                                                                                                                                                                                              |
| `nodePlacement: straight\|balanced\|basic`         | ELK strategy (`BRANDES_KOEPF` / `NETWORK_SIMPLEX` / `SIMPLE`)                                                                                                                                                                                                                                    |
| `GraphEdge.priority` + `branch` + `kind`           | `priority.straightness` / `shortness`                                                                                                                                                                                                                                                            |
| Every edge (except mutual A↔B)                     | Source port on flow-exit face + target port on flow-entry face (`FIXED_POS` from `getPortPosition`). Distinct pins for fan-in/out. Mutual pairs stay node→node for corridor parallels. Then `snapEdgeEndpointsToGeometry`.                                                                       |
| `arrange: stack\|row\|grid` (group or `layout {}`) | Hybrid path in `layout-arranged.ts`: declaration-ordered top-level groups and ungrouped nodes, local ELK/pack per group cell (row→TD, stack→LR) → region tracks with content centered in stretch → fixed positions + obstacle-aware orthogonal stubs (`route-orthogonal-avoid.ts`; not grid/A\*) |
| Inside cell `arrange: flow\|pack\|stack`           | `flow` = ELK on members; `pack`/`stack` = dense local packing; disconnected members pack along the cell flow axis                                                                                                                                                                                |

## Forbidden patterns

- Do not put raw `elk.*` keys on `GraphModel`
- Do not invent exception-lane geometry after ELK
- Do not reintroduce a sparse-grid / PCB / A\* router
- Do not collapse fan-in/fan-out onto a shared node border hit — one port pin per edge endpoint
- Do not re-classify branch labels in theme and layout separately — use `GraphEdge.branch`

**Orthogonal ownership:** ELK owns corridors for the normal layered path. The region-arrange
hybrid (`layout-arranged.ts`) seeds fixed-position stubs with candidate orthogonal corridors
(`route-orthogonal-avoid.ts`) — obstacle-aware H/V channels only, not grid/A\* search. Crossing
treatment, marker trim, metro rounding, and straight/bezier style refinement stay post-process.

## Coordinate absoluteization

Hierarchical sections may be relative to the endpoint LCA. `layout-with-elk.ts` resolves
`node:port` refs to owning nodes via `endpointNodeId`, then offsets by that LCA.
