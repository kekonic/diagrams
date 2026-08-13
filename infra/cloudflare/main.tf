# Free-tier only: Pages (Direct Upload) + DNS CNAME.
# Do not add: Browser Isolation, Gateway HTTP policies, WARP device posture,
# SCIM, Logpush, Advanced Certificate Manager, Workers Paid, R2, Argo, etc.

locals {
  pages_dev_hostname = "${var.pages_project_name}.pages.dev"
}

# Direct Upload project (CI uses `wrangler pages deploy`). No CF-hosted builds.
resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = "main"
}

resource "cloudflare_pages_domain" "site" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.docs_hostname
}

resource "cloudflare_dns_record" "site" {
  zone_id = var.cloudflare_zone_id
  name    = var.docs_hostname
  type    = "CNAME"
  content = local.pages_dev_hostname
  proxied = true
  ttl     = 1
  comment = "Kekonic Diagrams (Cloudflare Pages)"
}
