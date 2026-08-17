# Kekonic Diagrams repo conventions

These rules are durable repository constraints. Product sequencing belongs in `ROADMAP.md`; current
behavior belongs in code, tests, public reference docs, and focused architecture decisions.

## Sources of truth

- Use `ROADMAP.md` for product priority and maintenance gates.
- Use code, tests, public reference docs, package contracts, and accepted architecture decisions for
  current behavior. Verify prose against executable behavior before treating it as a contract.
- Keep architectural decisions small, explicit, and scoped. Do not mix product priority, current
  user behavior, implementation detail, and speculative design into one source of truth.
- If prose disagrees with executable behavior, identify the mismatch; do not quietly choose the
  more convenient interpretation.

## Engineering baseline

- Preserve the pipeline boundary: parse and compile semantic intent, measure and lay out geometry,
  refine routes and labels, then render. A later stage must not reparse source or recreate an
  earlier stage's policy ad hoc.
- Keep semantic data separate from presentation data. Themes and renderers may change appearance;
  they must not change what the diagram means.
- Keep output deterministic for identical source, options, registries, and dependency versions.
  Stable ordering, IDs, diagnostics, layout inputs, routes, and serialized SVG are part of
  reproducible CLI and test behavior.
- Model expected source and user errors as structured diagnostics/results. Throw only for
  programmer errors or environmental failures that cannot be represented normally. Never use an
  empty catch block or discard a diagnostic.
- Preserve source ranges through parsing and compilation whenever a value can produce a diagnostic,
  hover, definition, rename, or code action later.
- Prefer `unknown` plus narrowing over `any`. Do not add `@ts-ignore`, broad lint disables, or
  unchecked casts without a narrow explanation beside the exception.
- Follow the repository's ESM/NodeNext conventions: include `.ts` in relative TypeScript imports
  and use type-only imports where the import is not needed at runtime.
- Add an extension point only for a concrete supported consumer and cover the contract with tests.
  Do not preserve or invent generalization solely for an abandoned experiment.

## API evolution

- Prefer one clean current path over unnecessary aliases, deprecation shims, compatibility
  branches, dual schemas, or retained exports.
- Follow the compatibility policy applicable to the requested release and change. Do not infer a
  stability guarantee or a breaking-change authorization from an agent instruction.
- When a breaking change is authorized, make it deliberately and atomically: update all workspace
  consumers, tests, examples, snapshots, public docs, generated reference material, and the
  Changeset together.
- Record meaningful user-visible breakage and migration guidance in the Changeset.

## Safety and trust boundaries

- Treat diagram source, labels, links, icon data, theme values, and imported SVG as untrusted.
  Escape text and attributes for the destination context and validate URL-bearing attributes.
- Never introduce arbitrary HTML or script execution into SVG, previews, docs examples, or web
  components. A deliberate raw-HTML/SVG insertion must accept only library-generated sanitized
  content and document that invariant at the call site.
- Do not add silent network access. Remote assets, fonts, includes, telemetry, or update checks must
  be explicit, bounded, documented, and testable offline.
- Never expose secrets, absolute local paths, or environment contents in generated diagrams,
  diagnostics, snapshots, or logs.

## Tests and validation

- Colocate focused `*.test.ts` / `*.spec.ts` tests with the behavior they protect. Every bug fix
  needs a regression test that fails for the original bug.
- For a pipeline change, test the nearest owning package and add an integrated SDK/CLI assertion
  when the public behavior crosses package boundaries.
- Prefer semantic and geometry assertions over brittle full-SVG snapshots. When a rendering,
  measurement, layout, routing, or theme snapshot changes, inspect the visual result rather than
  accepting the diff mechanically.
- Run the narrowest relevant checks while iterating, then `vp check` and the affected tests/builds.
  Prefer `vp run ready` before declaring repository-wide work complete.
- Do not weaken, skip, or rewrite a failing test merely to make validation green; establish whether
  the contract or the implementation is wrong.

## Releases and versions

- Use **Changesets** (`pnpm changeset`) for version bumps — do not hand-edit every `package.json` version for a release.
- Workspace packages (including the private `website` app) are **fixed** to one product version (see `.changeset/config.json`). Only non-private packages publish to npm (`access: public` scoped packages).
- Docs site (`https://diagrams.kekonic.com`) deploys from CI after a successful Changesets publish (or manual **Deploy docs** workflow); infra in `infra/cloudflare/`.
- Use [CHANGELOG.md](../../CHANGELOG.md) for release history and `.changeset/pre.json` for active
  prerelease state; do not duplicate release state in evergreen instructions.

## Commits and PRs

- Follow **Conventional Commits**; commit-msg runs commitlint. Dependabot commits are exempt.
- PR descriptions should use `.github/PULL_REQUEST_TEMPLATE.md`.
- Do not commit or push unless the human says **ship it**.

## Docs boundaries

- User-facing docs must teach **published** packages only (`@kekonic/diagrams`, `-cli`, `-element`, `-ui`).
- Never document `apps/website` Astro wrappers or other private hosts as the product API.
- Prefer job-based `/use/` recipes over overlapping API-surface guides.
- Keep README / CONTRIBUTING / AGENTS evergreen: link to CHANGELOG and config for versions; avoid baking “we are on X.Y.Z” into guides.

## Agent distribution boundary

- Root/scoped `AGENTS.md` files and `.agents/rules/` are internal contributor instructions. Do not
  treat them as the installation or publishing surface for end-user agent integrations.
- Any public skill, agent adapter, MCP server, prompt bundle, or capability manifest must live in a
  distinct versioned package with an explicit public contract, tests, documentation, and Changeset.
- The official KDiagram skill must install cleanly through `npx skills add`; users must not need to
  clone this monorepo or copy `.agents/` files manually.
- Keep core skill guidance host-neutral. Put host-specific glue in adapters that consume the same
  published package rather than duplicating or drifting the workflow.

## Tooling

- Use Vite+ (`vp check`, `vp test`, `vp run ready`) for validation.
- Shared dependency versions belong in `pnpm-workspace.yaml` `catalog` when practical.
- Read `CONTRIBUTING.md` and `docs` before large product or packaging changes.
- Engine pins live in root `package.json` (`engines` / `devEngines`) — don’t duplicate them in prose.
- Do not hand-edit generated `dist/` output. Change its source and run the owning build.
- Update `pnpm-lock.yaml` through the package manager, not by manual editing.
