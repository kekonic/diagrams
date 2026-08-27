# Brief: Storefront shared model with views

## Reader and question

**Audience:** Authors learning `kdiagram 2` models; C4 practitioners who want one source for context, containers, and components.

**Question:** How do context, container, and component pictures derive from one model without copying topology?

**When appropriate:** Draft a shared `model` with named `view`s whenever multiple C4 lenses must stay in sync.

## Facts (established)

- Commerce corpus: customer, Commerce Co. platform, Stripe, warehouse, email; containers under the commerce platform boundary.
- Context lens includes the enterprise boundary and the explicit `platform` summary node (not the container subtree).
- Containers lens includes the commerce boundary members and the same external systems.
- Components lens opens the API application (`apiComponents` boundary) with neighbor containers and Stripe closed; excludes the `api` container shell.
- Edges are authored per view so context, container, and component wiring can differ.

## Assumptions

- One self-contained `.kdiagram` file; no language `import`.
- Level of detail uses an explicit summary node in the model, not view-time collapse.
- API internals live in a dedicated `apiComponents` boundary at model scope; the `api` container remains the containers-level representation.

## Intentional omissions

- Code-level (UML class) views.
- Message bus / topic topology (`order-fulfillment`).
- Cross-file shared modules.

## Layout / presentation policy

- Context: TD stack; person → company boundary → externals.
- Containers: LR compound commerce boundary with per-view edges.
- Components: LR web | API component stack | neighbor containers/externals.
- Render with `--view Context`, `--view containers`, or `--view components` (or the studio/embed view picker).
