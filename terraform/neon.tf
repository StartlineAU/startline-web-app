# Neon (managed Postgres) — one project per environment, replacing RDS.
#
# Plan is org-scoped in Neon (currently Free); Terraform only manages projects.
# The API key + org id live in startline/ci-bootstrap (local.bootstrap).
provider "neon" {
  api_key = local.bootstrap.neon_api_key
}

resource "neon_project" "prod" {
  name                      = "startline-prod"
  org_id                    = local.bootstrap.neon_org_id
  pg_version                = 16
  region_id                 = "aws-ap-southeast-2"
  history_retention_seconds = 21600 # Free plan cap (6 h); Launch allows up to 7 d

  primary_compute {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 1
  }
}

resource "neon_project" "staging" {
  name                      = "startline-staging"
  org_id                    = local.bootstrap.neon_org_id
  pg_version                = 16
  region_id                 = "aws-ap-southeast-2"
  history_retention_seconds = 21600

  primary_compute {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 1
  }
}