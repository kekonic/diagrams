# Cloudflare infra (Kekonic Diagrams)

OpenTofu/Terraform stack for:

- Cloudflare Pages project `kekonic-diagrams`
- Custom domain `diagrams.kekonic.com` + DNS CNAME
- Public product site (docs + Studio) on both the custom domain and `kekonic-diagrams.pages.dev`

Secrets come from **Infisical** (project configured via root `.infisical.json` (CI uses Infisical project slug `kekonic-diagrams`), env `prod`; see root
[`.infisical.json`](../../.infisical.json)). Do not put API tokens or account/zone IDs in tfvars.

## Free tier (no paid Cloudflare products)

This stack is intentionally limited to **Cloudflare Free** products:

| Resource                      | Plan       | Notes                                                                             |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------- |
| DNS CNAME                     | Zone Free  | Subdomain on `kekonic.com`                                                        |
| Pages project + custom domain | Pages Free | Direct Upload via Wrangler (not CF Git builds). Stay under ~500 deployments/month |

Do not enable Browser Isolation, Gateway device enrollment, Logpush, Advanced certificates,
Workers Paid, R2, or Argo for this site.

## Prerequisites

- [OpenTofu](https://opentofu.org/) `>= 1.6` (or Terraform `>= 1.6`)
- [Infisical CLI](https://infisical.com/docs/cli/overview) logged in
- Cloudflare API token permissions: Pages Edit, Access Apps and Policies Edit, Zone DNS Edit, Zone Read (scope: account + `kekonic.com` only)

### Infisical secrets (`prod`)

| Secret                         | Used by                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Cloudflare provider + Wrangler / CI                         |
| `CLOUDFLARE_ACCOUNT_ID`        | Wrangler / CI (`release.yml`)                               |
| `CLOUDFLARE_ZONE_ID`           | Reference / tooling (optional for tofu if `TF_VAR_*` set)   |
| `TF_VAR_cloudflare_account_id` | OpenTofu `cloudflare_account_id` (same value as account ID) |
| `TF_VAR_cloudflare_zone_id`    | OpenTofu `cloudflare_zone_id` (same value as zone ID)       |
| `NPM_TOKEN`                    | Changesets publish in CI (not needed for local tofu)        |

`TF_VAR_*` names must match the Terraform variable names exactly (lowercase snake_case after the prefix). That is normal for OpenTofu.

## Apply

```bash
cd infra/cloudflare
cp terraform.tfvars.example terraform.tfvars

infisical run --env=prod -- tofu init
infisical run --env=prod -- tofu plan
infisical run --env=prod -- tofu apply
```

Root `.infisical.json` supplies the workspace; `--env=prod` selects the environment. No shell `export` mapping is needed when the `TF_VAR_*` secrets exist in Infisical.

`CLOUDFLARE_API_TOKEN` is picked up automatically by the Cloudflare provider.

## After apply

Site deploys happen from GitHub Actions after a successful Changesets publish (`wrangler pages deploy`). This stack only provisions DNS, Pages project, domain, and Access.
