data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "amplify_assume" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [
        "amplify.amazonaws.com",
        "amplify.${var.aws_region}.amazonaws.com",
      ]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "amplify" {
  name_prefix        = "${var.project_name}-amplify-"
  assume_role_policy = data.aws_iam_policy_document.amplify_assume.json
}

resource "aws_iam_role_policy_attachment" "amplify_admin" {
  role       = aws_iam_role.amplify.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

locals {
  # coalesce(null, "") errors (empty strings are skipped); test explicitly instead.
  connect_repository = var.amplify_repository_url != null && trimspace(var.amplify_repository_url) != ""

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
            - env | grep -E '^(DATABASE_URL|RESEND_API_KEY)=' >> .env.production
            - npx prisma migrate deploy
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT
}

resource "aws_amplify_app" "this" {
  name       = var.project_name
  platform   = "WEB_COMPUTE"
  build_spec = local.build_spec

  iam_service_role_arn = aws_iam_role.amplify.arn
  compute_role_arn     = aws_iam_role.amplify.arn

  repository   = local.connect_repository ? var.amplify_repository_url : null
  access_token = local.connect_repository ? var.amplify_repository_access_token : null

  environment_variables = merge(
    {
      DATABASE_URL = local.database_url
    },
    var.resend_api_key != null ? { RESEND_API_KEY = var.resend_api_key } : {},
    var.amplify_environment_variables,
  )

  lifecycle {
    precondition {
      condition = !local.connect_repository || (
        var.amplify_repository_access_token != null &&
        var.amplify_repository_access_token != ""
      )
      error_message = "amplify_repository_access_token must be set when amplify_repository_url is set."
    }
  }
}

resource "aws_amplify_branch" "production" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.production_branch
  stage       = "PRODUCTION"

  enable_auto_build = local.connect_repository
}

resource "aws_amplify_domain_association" "this" {
  count       = var.amplify_custom_domain != null ? 1 : 0
  app_id      = aws_amplify_app.this.id
  domain_name = var.amplify_custom_domain

  # Default behavior blocks until ACM/Amplify reports AVAILABLE, which can only
  # happen after the DNS records below are propagated at the registrar. Skip
  # the wait so apply returns the records to add at GoDaddy.
  wait_for_verification = false

  # Apex (startlineau.com) and www both routed to the production branch.
  # DNS lives in Route 53; aws_route53_record entries below resolve the apex
  # via ALIAS to the Amplify CloudFront distribution.
  sub_domain {
    branch_name = aws_amplify_branch.production.branch_name
    prefix      = ""
  }

  sub_domain {
    branch_name = aws_amplify_branch.production.branch_name
    prefix      = "www"
  }
}
