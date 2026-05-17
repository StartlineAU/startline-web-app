# Declarative state migration: existing single-environment resources are
# now the prod environment in the per-environment module. Each `moved` block
# tells Terraform "this resource was renamed from X to Y", avoiding a
# destroy/create where the underlying attribute is in-place modifiable.
#
# Force-new attribute changes that DO trigger destroy/create after the move:
#   - aws_db_instance.postgres: db_name "startline" → "startline_prod"
#   - aws_cognito_user_pool.this: name suffix added (-prod)
#   - aws_amplify_branch.production: branch_name "master" → "production"
#   - aws_db_subnet_group.postgres: name suffix added (-prod)
#
# Data backups for the prod RDS were taken before this migration; restore the
# waitlist_subscribers table via psql/pg_restore after apply completes.

moved {
  from = aws_amplify_branch.production
  to   = module.env["prod"].aws_amplify_branch.this
}

moved {
  from = aws_vpc.database
  to   = module.env["prod"].aws_vpc.database
}

moved {
  from = aws_internet_gateway.database
  to   = module.env["prod"].aws_internet_gateway.database
}

moved {
  from = aws_subnet.database_public[0]
  to   = module.env["prod"].aws_subnet.database_public[0]
}

moved {
  from = aws_subnet.database_public[1]
  to   = module.env["prod"].aws_subnet.database_public[1]
}

moved {
  from = aws_route_table.database_public
  to   = module.env["prod"].aws_route_table.database_public
}

moved {
  from = aws_route_table_association.database_public[0]
  to   = module.env["prod"].aws_route_table_association.database_public[0]
}

moved {
  from = aws_route_table_association.database_public[1]
  to   = module.env["prod"].aws_route_table_association.database_public[1]
}

moved {
  from = aws_db_subnet_group.postgres
  to   = module.env["prod"].aws_db_subnet_group.postgres
}

moved {
  from = aws_security_group.rds
  to   = module.env["prod"].aws_security_group.rds
}

moved {
  from = random_password.db_master
  to   = module.env["prod"].random_password.db_master
}

moved {
  from = aws_db_instance.postgres
  to   = module.env["prod"].aws_db_instance.postgres
}

moved {
  from = aws_secretsmanager_secret.database
  to   = module.env["prod"].aws_secretsmanager_secret.database
}

moved {
  from = aws_secretsmanager_secret_version.database
  to   = module.env["prod"].aws_secretsmanager_secret_version.database
}

moved {
  from = aws_cognito_user_pool.this
  to   = module.env["prod"].aws_cognito_user_pool.this
}

moved {
  from = aws_cognito_user_pool_client.web
  to   = module.env["prod"].aws_cognito_user_pool_client.web
}
