## Summary

<!-- What changed and why (1–3 bullets). Link issues if any. -->

-

## Changeset

- [ ] I ran `pnpm changeset` for publishable package **and/or user-facing docs** (`apps/website`) changes
- [ ] No version bump needed (CI/chore-only; no package or docs content change)

Docs and packages share one product version. Production docs deploy only after a Changesets
**publish** on `main` — a docs-only fix still needs a changeset (usually patch).

## Test plan

- [ ] `vp run ready` passes locally
- [ ] Docs / examples touched: spot-checked in the docs site or studio
- [ ] No secrets or private site-only APIs documented as public

## Notes for reviewers

<!-- Optional: risk, follow-ups, screenshots -->
