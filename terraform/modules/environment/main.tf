# Per-environment infrastructure: VPC + networking, RDS, Cognito, Amplify branch.
#
# One instance of this module is created per environment (prod, nonprod). The
# Amplify app, IAM roles, Route 53 zone, and apex-domain records stay in the
# root module — only resources whose lifecycle is environment-scoped live here.

# ===== Networking =====

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "database" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-${var.name}"
    Environment = var.name
  }
}

resource "aws_internet_gateway" "database" {
  vpc_id = aws_vpc.database.id

  tags = {
    Name        = "${var.project_name}-${var.name}"
    Environment = var.name
  }
}

resource "aws_subnet" "database_public" {
  count                   = 2
  vpc_id                  = aws_vpc.database.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-${var.name}-public-${count.index}"
    Environment = var.name
  }
}

resource "aws_route_table" "database_public" {
  vpc_id = aws_vpc.database.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.database.id
  }

  tags = {
    Name        = "${var.project_name}-${var.name}-public"
    Environment = var.name
  }
}

resource "aws_route_table_association" "database_public" {
  count          = 2
  subnet_id      = aws_subnet.database_public[count.index].id
  route_table_id = aws_route_table.database_public.id
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.name}-postgres"
  subnet_ids = aws_subnet.database_public[*].id

  tags = {
    Environment = var.name
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.name}-rds-"
  vpc_id      = aws_vpc.database.id
  description = "PostgreSQL ingress for ${var.project_name} ${var.name}"

  dynamic "ingress" {
    for_each = var.database_allowed_cidr_blocks
    content {
      description = "PostgreSQL"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = var.name
  }
}

# ===== RDS (PostgreSQL) =====

resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-${var.name}-postgres"
  engine         = "postgres"
  engine_version = var.database_engine_version
  instance_class = var.database_instance_class

  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_max_allocated_storage > 0 ? var.database_max_allocated_storage : null
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.database_name
  username = var.database_username
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible          = var.database_publicly_accessible
  skip_final_snapshot          = var.database_skip_final_snapshot
  final_snapshot_identifier    = var.database_skip_final_snapshot ? null : "${var.project_name}-${var.name}-postgres-final"
  backup_retention_period      = var.database_backup_retention_period
  deletion_protection          = var.database_deletion_protection
  performance_insights_enabled = var.database_performance_insights_enabled

  tags = {
    Environment = var.name
  }
}

resource "aws_secretsmanager_secret" "database" {
  name_prefix             = "${var.project_name}/${var.name}/database/"
  recovery_window_in_days = var.database_secret_recovery_window_days

  tags = {
    Environment = var.name
  }
}

locals {
  database_url = "postgresql://${var.database_username}:${urlencode(random_password.db_master.result)}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.database_name}?schema=public&sslmode=require"
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username     = var.database_username
    password     = random_password.db_master.result
    host         = aws_db_instance.postgres.address
    port         = tostring(aws_db_instance.postgres.port)
    dbname       = var.database_name
    DATABASE_URL = local.database_url
  })
}

# ===== Cognito =====

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-${var.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Verify your ${var.project_name} email"
    email_message        = "Your verification code is {####}"
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  mfa_configuration   = "OFF"
  deletion_protection = var.cognito_deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = {
    Environment = var.name
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-${var.name}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_group" "this" {
  for_each     = toset(["admins", "organisers", "customers"])
  user_pool_id = aws_cognito_user_pool.this.id
  name         = each.key
}

# ===== Amplify branch =====

resource "aws_amplify_branch" "this" {
  app_id      = var.amplify_app_id
  branch_name = var.branch_name
  stage       = var.amplify_stage

  enable_auto_build = var.auto_build_enabled

  environment_variables = merge(
    {
      DATABASE_URL = local.database_url
    },
    var.extra_branch_environment_variables,
  )
}
