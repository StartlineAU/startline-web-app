variable "database_url" {
  description = "Full PostgreSQL connection URL (Neon) for this environment, used at runtime and by the build's prisma migrate deploy."
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Short environment name (e.g. prod, nonprod). Used as a suffix in resource names and the Environment tag."
  type        = string
}

variable "project_name" {
  description = "Project prefix (e.g. startline) shared with the root module."
  type        = string
}

variable "amplify_app_id" {
  description = "ID of the singleton Amplify app this environment's branch attaches to."
  type        = string
}

variable "branch_name" {
  description = "Git branch deployed to this environment (e.g. prod, nonprod)."
  type        = string
}

variable "amplify_stage" {
  description = "Amplify branch stage (PRODUCTION, BETA, DEVELOPMENT, etc.)."
  type        = string
}

variable "auto_build_enabled" {
  description = "Enable Amplify auto-build for this branch. Should match whether the app is connected to a repo."
  type        = bool
}

variable "enable_pull_request_preview" {
  description = "Enable PR preview deployments for this branch."
  type        = bool
  default     = false
}

variable "extra_branch_environment_variables" {
  description = "Extra env vars to set on the Amplify branch in addition to DATABASE_URL."
  type        = map(string)
  default     = {}
}

# --- Cognito ---

variable "cognito_deletion_protection" {
  description = "Enable deletion protection on the User Pool."
  type        = bool
}

# Runtime server-side secrets.
#
# These are read by the running app, not by the build, so they have to live on
# the Amplify branch environment. The build writes Secrets Manager into
# .env.production, but `output: "standalone"` ships only `.next` — that file
# never reaches the server, so a value that exists only in Secrets Manager is
# undefined at runtime. NEXT_PUBLIC_* is exempt because Next inlines it at
# build time; everything below is not.

variable "resend_api_key" {
  description = "Resend API key. Sends every transactional email; without it lib/email.ts silently skips them and /api/contact 500s."
  type        = string
  sensitive   = true
  default     = null
}

variable "resend_from" {
  description = "Overrides the transactional From address. Blank falls back to the default in lib/email.ts."
  type        = string
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key for this environment (live for prod, test for staging). lib/stripe.ts throws without it, so checkout and refunds fail closed."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret for this environment. Without it every webhook delivery is rejected and paid registrations are never confirmed."
  type        = string
  sensitive   = true
  default     = ""
}

variable "abr_guid" {
  description = "Australian Business Register lookup GUID. Without it /api/abn returns 503 and organisers cannot verify the ABN that hosting paid events requires."
  type        = string
  sensitive   = true
  default     = ""
}

variable "site_url" {
  description = "Public base URL for this environment (e.g. https://startlineau.com). Used in email links."
  type        = string
}

variable "mapbox_access_token" {
  description = "Mapbox public access token (pk.*) for the events map and organiser location preview. From the ci-bootstrap secret."
  type        = string
  sensitive   = true
  default     = null
}

variable "turnstile_site_key" {
  description = "Cloudflare Turnstile site key (public)."
  type        = string
  sensitive   = true
  default     = null
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile secret key (server-side verification)."
  type        = string
  sensitive   = true
  default     = null
}

# --- S3 upload bucket ---

variable "bucket_cors_allowed_origins" {
  description = "CORS allowed origins for the uploads bucket."
  type        = list(string)
}

# --- CloudFront CDN ---

variable "cdn_waf_enabled" {
  description = "Enable WAF rate-limiting on the CDN. Skip for staging to save $6/mo."
  type        = bool
  default     = true
}

variable "cdn_custom_domain" {
  description = "Custom domain for the upload CDN (e.g. cdn.startlineau.com). Null means use CloudFront default domain."
  type        = string
  default     = null
}

variable "cdn_cert_arn" {
  description = "ACM certificate ARN (us-east-1) for the CDN custom domain. Required if cdn_custom_domain is set."
  type        = string
  default     = null
}
