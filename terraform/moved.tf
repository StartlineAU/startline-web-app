# Declarative state migration: existing single-environment resources are
# now the prod environment in the per-environment module. Each `moved` block
# tells Terraform "this resource was renamed from X to Y", avoiding a
# destroy/create where the underlying attribute is in-place modifiable.
#
# Force-new attribute changes that DO trigger destroy/create after the move:
#   - aws_cognito_user_pool.this: name suffix added (-prod)
#   - aws_amplify_branch.production: branch_name "master" → "production"

moved {
  from = aws_amplify_branch.production
  to   = module.env["prod"].aws_amplify_branch.this
}

moved {
  from = aws_cognito_user_pool.this
  to   = module.env["prod"].aws_cognito_user_pool.this
}

moved {
  from = aws_cognito_user_pool_client.web
  to   = module.env["prod"].aws_cognito_user_pool_client.web
}

# count-indexed resources (prod-only DNS records)

moved {
  from = aws_route53_record.amplify_cert_validation
  to   = aws_route53_record.amplify_cert_validation[0]
}

moved {
  from = aws_route53_record.apex_alias
  to   = aws_route53_record.apex_alias[0]
}

moved {
  from = aws_route53_record.www_cname
  to   = aws_route53_record.www_cname[0]
}

moved {
  from = aws_route53_record.organiser_cname
  to   = aws_route53_record.organiser_cname[0]
}

moved {
  from = aws_route53_record.cdn_alias
  to   = aws_route53_record.cdn_alias[0]
}

moved {
  from = cloudflare_record.apex
  to   = cloudflare_record.apex[0]
}

moved {
  from = cloudflare_record.www
  to   = cloudflare_record.www[0]
}

moved {
  from = cloudflare_record.organiser
  to   = cloudflare_record.organiser[0]
}

moved {
  from = cloudflare_record.cdn
  to   = cloudflare_record.cdn[0]
}

moved {
  from = cloudflare_record.amplify_cert_validation
  to   = cloudflare_record.amplify_cert_validation[0]
}
