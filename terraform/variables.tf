variable "aws_region" {
  description = "AWS region for Amplify and IAM resources."
  type        = string
  default     = "ap-southeast-2"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use. Leave null to fall back to default credentials/env vars."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Short name used for Amplify app, IAM role prefix, and per-env resource naming."
  type        = string
  default     = "startline"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
  default     = "cae4a54688a0a4c53bda4bd62eb37c35"
}

# --- Amplify ---

variable "amplify_repository_url" {
  description = "HTTPS Git URL for Amplify. Set to null to create the app without a connected repository."
  type        = string
  default     = "https://github.com/StartlineAU/startline-web-app"
}

variable "amplify_environment_variables" {
  description = "Env vars at the app level (apply to BOTH branches). Use the env module's branch env vars for per-environment values."
  type        = map(string)
  default     = {}
}

variable "amplify_custom_domain" {
  description = "Apex domain attached to the prod branch only. Set to null to skip."
  type        = string
  default     = "startlineau.com"
}


