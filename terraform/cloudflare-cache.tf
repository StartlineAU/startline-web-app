# Cloudflare CDN, caching, and security settings for startlineau.com.

# ===== Zone-level settings =====

resource "cloudflare_zone_settings_override" "primary" {
  zone_id = cloudflare_zone.primary.id

  settings {
    always_use_https  = "on"
    ssl               = "full"
    browser_cache_ttl = 14400
  }
}

# ===== Cache rules for Next.js static assets =====
# /_next/static/* files have content hashes in filenames — safe to cache aggressively.

resource "cloudflare_ruleset" "cache_next_static" {
  zone_id = cloudflare_zone.primary.id
  name    = "Cache Next.js static assets"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
    expression  = "(starts_with(http.request.uri.path, \"/_next/static/\"))"
    description = "Cache hashed Next.js static assets for 1 year"
    enabled     = true
  }
}
