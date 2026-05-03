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
  description = "Short name used for Amplify app and IAM role prefix."
  type        = string
  default     = "startline"
}

variable "environment" {
  description = "Logical environment tag (e.g. production, staging)."
  type        = string
  default     = "production"
}

variable "production_branch" {
  description = "Git branch treated as production in Amplify."
  type        = string
  default     = "master"
}

variable "amplify_repository_url" {
  description = "HTTPS Git URL for Amplify. Set to null to create the app without a connected repository."
  type        = string
  default     = "https://github.com/StartlineAU/startline"
}

variable "amplify_repository_access_token" {
  description = "Git provider token for private repos (GitHub PAT, etc.). Required when amplify_repository_url is set."
  type        = string
  sensitive   = true
  default     = null
}

variable "amplify_environment_variables" {
  description = "Env vars available at build and runtime (e.g. NEXT_PUBLIC_*). Do not commit secrets in tfvars; use AWS Secrets or SSM for sensitive values."
  type        = map(string)
  default     = {}
}

variable "amplify_custom_domain" {
  description = "Apex domain to attach to the Amplify app. Set to null to skip the domain association."
  type        = string
  default     = "startlineau.com"
}

variable "resend_api_key" {
  description = "Resend API key (re_...). Injected into Amplify as RESEND_API_KEY at build/runtime."
  type        = string
  sensitive   = true
  default     = null
}

# --- RDS (PostgreSQL) ---

variable "database_vpc_cidr" {
  description = "CIDR for the dedicated VPC that holds the RDS subnets."
  type        = string
  default     = "10.20.0.0/16"
}

variable "database_name" {
  description = "PostgreSQL database name (maps to Prisma DATABASE_URL path segment)."
  type        = string
  default     = "startline"
}

variable "database_username" {
  description = "Master username for RDS."
  type        = string
  default     = "startline"
}

variable "database_engine_version" {
  description = "PostgreSQL version for RDS (major like 16 is fine when minor version upgrades are enabled)."
  type        = string
  default     = "16"
}

variable "database_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "database_allocated_storage" {
  description = "Initial allocated storage (GB)."
  type        = number
  default     = 20
}

variable "database_max_allocated_storage" {
  description = "Autoscaling storage cap (GB). 0 disables autoscaling — required while the AWS account is in Free Tier restricted mode (FreeTierRestrictionError otherwise)."
  type        = number
  default     = 0
}

variable "database_publicly_accessible" {
  description = "If true, RDS gets a public address so Amplify/serverless outside the VPC can connect. For private-only DB, use false and run the app inside this VPC (e.g. ECS)."
  type        = bool
  default     = true
}

variable "database_allowed_cidr_blocks" {
  description = "CIDRs allowed to reach PostgreSQL on 5432. Narrow this; 0.0.0.0/0 is convenient but exposes the port worldwide (still require password + TLS)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "database_skip_final_snapshot" {
  description = "If true, destroying the instance skips a final snapshot (typical for dev)."
  type        = bool
  default     = true
}

variable "database_backup_retention_period" {
  description = "Days of automated backups. 0 disables backups — required while the AWS account is in Free Tier restricted mode."
  type        = number
  default     = 0
}

variable "database_deletion_protection" {
  description = "Enable deletion protection on the RDS instance."
  type        = bool
  default     = false
}

variable "database_performance_insights_enabled" {
  description = "Enable RDS Performance Insights."
  type        = bool
  default     = false
}

variable "database_secret_recovery_window_days" {
  description = "Secrets Manager recovery window when deleting the secret (0 = immediate)."
  type        = number
  default     = 0
}

# --- Cognito ---

variable "cognito_deletion_protection" {
  description = "Enable deletion protection on the User Pool. Recommended for production."
  type        = bool
  default     = true
}
