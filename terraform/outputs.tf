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
  value       = module.env["prod"].branch_name
}

output "amplify_non_production_branch" {
  description = "Non-production branch name in Amplify."
  value       = module.env["nonprod"].branch_name
}

output "aws_account_id" {
  description = "AWS account ID resources were created in."
  value       = data.aws_caller_identity.current.account_id
}

output "database_secret_arns" {
  description = "Secrets Manager secret ARNs per environment."
  value       = { for k, m in module.env : k => m.database_secret_arn }
}

output "database_hosts" {
  description = "RDS hostnames per environment."
  value       = { for k, m in module.env : k => m.database_host }
}

output "database_urls" {
  description = "Full Prisma-style PostgreSQL URLs per environment (sensitive). Prefer Secrets Manager in production."
  value       = { for k, m in module.env : k => m.database_url }
  sensitive   = true
}

output "route53_nameservers" {
  description = "Paste these into GoDaddy → Domain → Nameservers (use 'I'll use my own nameservers') to delegate DNS to Route 53."
  value       = aws_route53_zone.primary.name_servers
}

output "cognito_user_pool_ids" {
  description = "Cognito User Pool IDs per environment."
  value       = { for k, m in module.env : k => m.cognito_user_pool_id }
}

output "cognito_user_pool_arns" {
  description = "Cognito User Pool ARNs per environment."
  value       = { for k, m in module.env : k => m.cognito_user_pool_arn }
}

output "cognito_issuer_urls" {
  description = "OIDC issuer URLs per environment."
  value       = { for k, m in module.env : k => m.cognito_issuer_url }
}

output "cognito_app_client_ids" {
  description = "App Client IDs per environment."
  value       = { for k, m in module.env : k => m.cognito_app_client_id }
}

output "cognito_app_client_secrets" {
  description = "App Client secrets per environment (sensitive)."
  value       = { for k, m in module.env : k => m.cognito_app_client_secret }
  sensitive   = true
}

output "amplify_domain_dns_records" {
  description = "DNS records for the apex domain (prod branch only)."
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

output "github_actions_role_arn" {
  description = "Set as GitHub repo variable AWS_ROLE_ARN for the terraform workflows."
  value       = aws_iam_role.terraform_ci.arn
}
