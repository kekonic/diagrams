output "pages_project_name" {
  description = "Cloudflare Pages project name used by Wrangler / CI."
  value       = cloudflare_pages_project.site.name
}

output "pages_dev_url" {
  description = "Default Pages.dev hostname for the project site."
  value       = "https://${local.pages_dev_hostname}"
}

output "docs_url" {
  description = "Public canonical site URL (custom domain)."
  value       = "https://${var.docs_hostname}"
}

output "dns_record_id" {
  description = "DNS CNAME record ID for the site hostname."
  value       = cloudflare_dns_record.site.id
}
