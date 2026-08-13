variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID (Infisical: CLOUDFLARE_ACCOUNT_ID → TF_VAR_cloudflare_account_id)."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID for kekonic.com (Infisical: CLOUDFLARE_ZONE_ID → TF_VAR_cloudflare_zone_id)."
}

variable "pages_project_name" {
  type        = string
  description = "Cloudflare Pages project name (must match Wrangler / CI)."
  default     = "kekonic-diagrams"
}

variable "docs_hostname" {
  type        = string
  description = "Public docs hostname (CNAME + Pages custom domain)."
  default     = "diagrams.kekonic.com"
}
