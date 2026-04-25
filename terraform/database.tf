# PostgreSQL (RDS) in a small public VPC. Amplify SSR runs outside this VPC, so the
# instance is publicly reachable when database_publicly_accessible is true. Restrict
# database_allowed_cidr_blocks as far as you can; for stricter setups, move the app
# into the same VPC (e.g. ECS) and set publicly_accessible to false.

data "aws_availability_zones" "database" {
  state = "available"
}

resource "aws_vpc" "database" {
  cidr_block           = var.database_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_internet_gateway" "database" {
  vpc_id = aws_vpc.database.id
}

resource "aws_subnet" "database_public" {
  count                   = 2
  vpc_id                  = aws_vpc.database.id
  cidr_block              = cidrsubnet(var.database_vpc_cidr, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.database.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_route_table" "database_public" {
  vpc_id = aws_vpc.database.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.database.id
  }
}

resource "aws_route_table_association" "database_public" {
  count          = 2
  subnet_id      = aws_subnet.database_public[count.index].id
  route_table_id = aws_route_table.database_public.id
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-postgres"
  subnet_ids = aws_subnet.database_public[*].id
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = aws_vpc.database.id
  description = "PostgreSQL ingress for ${var.project_name}"

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
}

resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-postgres"
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
  final_snapshot_identifier    = var.database_skip_final_snapshot ? null : "${var.project_name}-postgres-final"
  backup_retention_period      = var.database_backup_retention_period
  deletion_protection          = var.database_deletion_protection
  performance_insights_enabled = var.database_performance_insights_enabled
}

resource "aws_secretsmanager_secret" "database" {
  name_prefix             = "${var.project_name}/database/"
  recovery_window_in_days = var.database_secret_recovery_window_days
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
