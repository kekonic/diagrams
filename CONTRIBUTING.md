# Contributing to KDiagram

Thanks for helping. KDiagram is a text-to-diagram monorepo (`@kekonic/*`). This guide covers
the **dev environment**, **style**, **commits**, **PRs**, and **releases**. Product priorities live
in [`ROADMAP.md`](ROADMAP.md); durable package and pipeline boundaries live in the
[`docs/architecture/`](docs/architecture/) notes.

Versioning uses **[Changesets](https://github.com/changesets/changesets)** — prefer a changeset over
hand-editing package versions. Use [CHANGELOG.md](CHANGELOG.md) and npm for release history;
`.changeset/pre.json` records prerelease state when a channel is active.

## Prerequisites

| Tool    | Where the pin lives                    |
| ------- | -------------------------------------- |
| Node.js | Root `package.json` → `engines.node`   |
| pnpm    | Root `package.json` → `packageManager` |
| Vite+   | Installed / driven by `vp install`     |

```bash
# from repo root
pnpm exec vp install   # or: vp install
vp env doctor          # if tooling looks wrong
```

In a non-interactive runner, use `CI=true vp install`; pnpm otherwise refuses to replace an existing
modules directory without a TTY.

## Everyday commands

```bash
vp check          # format + lint + typecheck
vp test           # unit tests
vp run ready      # build + check + test (what CI runs)
vp run docs       # docs site
vp run dev        # Studio development host
```

After pulling, run `vp install` before starting work.

## Style guide

- **Toolchain**: Vite+ (`vp`) — Oxfmt, Oxlint, Vitest, tsdown. Prefer `vp` over calling underlying tools directly when a `vp` command exists.
- **Format/lint**: CI and pre-commit run `vp check --fix` on staged files. Don’t fight the formatter.
- **TypeScript**: Prefer explicit Result / typed errors over swallowed exceptions. Keep packages focused; don’t leak app/docs internals into publishable APIs.
- **Docs**: User-facing recipes must use **published** packages (`@kekonic/diagrams`, `-cli`, `-element`, `-ui`). Site-only Astro wrappers are private — never teach them as the product.
- **Tests**: Colocate `*.test.ts` / `*.spec.ts`. Prefer fast unit tests. Showcase examples have
  structural overlap/edge-punch gates and committed SVG snapshots; inspect snapshot diffs visually
  when layout, routing, measurement, themes, or rendering changes.

## Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). Enforced by
**commitlint** on `commit-msg` (`pnpm exec commitlint`).

```text
type(scope)?: subject

body?

footer?
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.

Examples:

```text
feat(element): add fit() after theme swap
fix(routing): keep jump marks on multi-edge crossings
docs(use): clarify Astro renderToSvg recipe
chore(deps): bump elkjs
```

Scopes are optional; package names (`kdiagrams`, `cli`, `element`, `ui`, `layout`, …) or areas
(`docs`, `ci`) work well.

PR titles should also read like a conventional commit. Dependabot subjects are exempt from
commitlint (the bot capitalizes `Bump`, which fails `subject-case`).

## Pull requests

1. Branch from `main` (or the active release branch when stacking).
2. Keep PRs focused — one concern when practical.
3. Fill out the PR template.
4. Ensure `vp run ready` passes locally.
5. Add a **changeset** when you change publishable packages **or user-facing docs** (see below).
6. Don’t commit secrets. Don’t force-push `main`.

## Versioning (Changesets)

All workspace packages — publishable libraries **and** the private `website` app — are **fixed** to
one product version (see `.changeset/config.json`). Docs stay aligned with the SDK line;
`private: true` apps are still not published to npm.

```bash
pnpm changeset          # describe your change (patch / minor / major)
pnpm changeset status   # see pending bumps
pnpm version-packages   # apply versions + changelogs (maintainers / release PR)
pnpm release            # build + changeset publish (requires npm auth)
```

- Prefer a changeset in the same PR as the code change — including **user-facing docs** under
  `apps/website` (the website is in the fixed version group, so docs ship with the product line).
- Release PRs are opened by the Changesets GitHub Action on `main`.
- Publishable packages use **`access: "public"`**. Repository and documentation access policy lives
  in the hosting and repository configuration rather than release prose.

### Pre-release channels

When a prerelease channel is active, `.changeset/pre.json` records its tag and package state. Read
that file rather than assuming a channel from memory.

```bash
pnpm changeset pre enter <tag>   # enter a pre-release channel (maintainers)
pnpm changeset pre exit          # leave pre-release before a stable cut
```

Do **not** hand-bump every `package.json` to invent a release. Exit pre-release (if any) and cut
the version through Changesets.

GitHub Releases: one tag per product version (`vX.Y.Z` / `vX.Y.Z-rc.N`), not one release per
package. Packages share a fixed version group.

### Resume release delivery

Npm publication and release delivery are separate, idempotent phases. If Open VSX, GitHub assets,
Homebrew, or the docs deployment fails after packages reach npm, run the **Release** workflow
manually with the existing version (for example `1.0.0-rc.3`). The recovery path verifies that
version on npm and resumes delivery without invoking Changesets or republishing packages.

The workflow reuses the VSIX attached to the matching GitHub Release when available. GitHub asset
uploads use replacement semantics, Open VSX skips duplicates, retired-package deprecations inspect
existing metadata before writing, prereleases skip Homebrew, and docs deployments are repeatable.
Do not create a new Changeset merely to retry delivery for an already-published version.

### Docs site deploy

Production docs: **https://diagrams.kekonic.com** (Cloudflare Pages).

- Deploy runs **after a successful Changesets publish** on `main` (not on every merge).
- For a one-off redeploy without a new npm version, run the **Deploy docs** workflow
  (`workflow_dispatch`) in GitHub Actions.
- Infra (Pages project, DNS, Access): [`infra/cloudflare/`](infra/cloudflare/).
- Release credentials are resolved by the release workflow's configured secret manager. Do not
  copy credential values into documentation or store service tokens as long-lived repository
  secrets when workload identity is available.
- Stable releases expect `HOMEBREW_TAP_TOKEN` from that secret manager with contents access limited
  to `kekonic/homebrew-tap`; prereleases deliberately skip tap publication.

## Agent / AI assistants

- Root [`AGENTS.md`](AGENTS.md) — Vite+ checklist + Kekonic Diagrams notes
- [`.agents/rules/`](.agents/rules/) — project conventions for agents, including
  [product naming](.agents/rules/kekonic-diagrams-naming.md) (Kekonic Diagrams, never KDiagrams;
  `.kdiagram` is the file format)

Agents must not commit or push unless the human explicitly says **ship it**.

## Dependency updates

Dependabot opens periodic PRs for npm and GitHub Actions. Prefer catalog versions in
`pnpm-workspace.yaml` when bumping shared deps.

Patch and minor Dependabot PRs enable GitHub auto-merge (squash). They land once
the required `ready` check is green and the branch is up to date. A push to
`main` asks Dependabot to rebase any of its PRs that have fallen behind. Major
updates stay open for review.

## Questions

Open a GitHub issue or discussion. Use [`ROADMAP.md`](ROADMAP.md) for product priority and
[`docs/architecture/`](docs/architecture/) for durable pipeline boundaries.
