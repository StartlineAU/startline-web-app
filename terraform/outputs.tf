output "amplify_app_id" {
  description = "Amplify application ID."
  value       = aws_amplify_app.this.id
}

output "amplify_app_arn" {
  description = "Amplify application ARN."
  value       = aws_amplify_app.this.arn
}

output "amplify_default_domain" {
  description = "Default amplifyapp.com hostname for the app (branch hostnames use this domain)."
  value       = aws_amplify_app.this.default_domain
}

output "amplify_production_branch" {
  description = "Production branch name in Amplify."
  value       = aws_amplify_branch.production.branch_name
}

output "aws_account_id" {
  description = "AWS account ID resources were created in."
  value       = data.aws_caller_identity.current.account_id
}

output "database_secret_arn" {
  description = "Secrets Manager secret containing host, credentials, and DATABASE_URL for Prisma."
  value       = aws_secretsmanager_secret.database.arn
}

output "database_host" {
  description = "RDS hostname (without port)."
  value       = aws_db_instance.postgres.address
}

output "database_url" {
  description = "Full Prisma-style PostgreSQL URL (sensitive). Prefer reading from Secrets Manager in production."
  value       = local.database_url
  sensitive   = true
}

output "amplify_domain_dns_records" {
  description = "DNS records you must create at GoDaddy to validate the cert and route traffic. Each entry has type/name/value."
  value = var.amplify_custom_domain == null ? [] : concat(
    [
      for s in aws_amplify_domain_association.this[0].sub_domain : {
        type   = "CNAME"
        name   = s.prefix == "" ? var.amplify_custom_domain : "${s.prefix}.${var.amplify_custom_domain}"
        value  = s.dns_record
        verify = false
      }
    ],
    [{
      type   = "CNAME"
      name   = "_certificate_validation"
      value  = aws_amplify_domain_association.this[0].certificate_verification_dns_record
      verify = true
    }],
  )
}
