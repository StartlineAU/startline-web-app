data "aws_caller_identity" "current" {}

# Per-environment infrastructure: VPC + networking, RDS, Cognito, Amplify branch.
#
# One instance of this module is created per environment (prod, nonprod). The
# Amplify app, IAM roles, Route 53 zone, and apex-domain records stay in the
# root module — only resources whose lifecycle is environment-scoped live here.

# ===== Database =====
# Postgres runs on Neon (managed outside AWS); this module only receives the
# connection string and passes it on to the app secret + Amplify branch.

locals {
  environment_tag = var.name == "prod" ? "Prod" : "Stage"
}

resource "random_password" "guest_email_verification" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.project_name}/${var.name}/app"
  recovery_window_in_days = 0

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    NEXT_PUBLIC_COGNITO_USER_POOL_ID = aws_cognito_user_pool.this.id
    NEXT_PUBLIC_COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.web.id
    GUEST_EMAIL_VERIFICATION_SECRET  = random_password.guest_email_verification.result
    AWS_S3_BUCKET                    = aws_s3_bucket.uploads.id
    AWS_S3_REGION                    = "ap-southeast-2"
    NEXT_PUBLIC_CDN_URL              = var.cdn_custom_domain != null ? "https://${var.cdn_custom_domain}" : "https://${aws_cloudfront_distribution.cdn.domain_name}"
    DATABASE_URL                     = var.database_url
    NEXT_PUBLIC_SITE_URL             = var.site_url
    NEXT_PUBLIC_BASE_URL             = var.site_url
    NEXT_PUBLIC_AWS_REGION           = "ap-southeast-2"
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN  = var.mapbox_access_token
    NEXT_PUBLIC_TURNSTILE_SITE_KEY   = var.turnstile_site_key
    TURNSTILE_SECRET_KEY             = var.turnstile_secret_key
  })
}

# ===== Cognito custom message Lambda =====

resource "aws_iam_role" "cognito_email_lambda" {
  name = "${var.project_name}-${var.name}-cognito-email-lambda"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "cognito_email_lambda" {
  role = aws_iam_role.cognito_email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

data "archive_file" "cognito_email_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/email-sender/index.mjs"
  output_path = "${path.module}/lambda/email-sender.zip"
}

resource "aws_lambda_function" "cognito_email" {
  function_name    = "${var.project_name}-${var.name}-cognito-email"
  role             = aws_iam_role.cognito_email_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.cognito_email_lambda.output_path
  source_code_hash = data.archive_file.cognito_email_lambda.output_base64sha256
  timeout          = 5

  environment {
    variables = {
      SITE_URL = var.site_url
    }
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_lambda_permission" "cognito_email" {
  statement_id  = "AllowCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_email.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn

  depends_on = [aws_cognito_user_pool.this]
}

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-${var.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Changing email from Settings: the old address stays in force until the
  # code sent to the new one is entered. Without this Cognito switches the
  # address straight away, and a typo locks the person out of their account.
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

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

  lambda_config {
    custom_message = aws_lambda_function.cognito_email.arn
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

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = true
  }

  deletion_protection = var.cognito_deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
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
  for_each     = toset(["admins", "users"])
  user_pool_id = aws_cognito_user_pool.this.id
  name         = each.key
}

# ===== Amplify branch =====

locals {
  # Server-only values the running app reads from process.env. They cannot come
  # from Secrets Manager: the build writes that into .env.production, and
  # `output: "standalone"` ships only .next, so the file never reaches the
  # server. See the note above the variables in variables.tf.
  runtime_secrets = {
    GUEST_EMAIL_VERIFICATION_SECRET = random_password.guest_email_verification.result
    TURNSTILE_SECRET_KEY            = var.turnstile_secret_key
    RESEND_API_KEY                  = var.resend_api_key
    RESEND_FROM                     = var.resend_from
    STRIPE_SECRET_KEY               = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET           = var.stripe_webhook_secret
    ABR_GUID                        = var.abr_guid
  }

  # Drop blanks rather than publishing empty entries. The app treats "" and
  # unset the same way, but an empty variable reads as configured in the Amplify
  # console, which is how a missing key stays missing. `try` also absorbs the
  # null default on resend_api_key.
  runtime_secret_variables = {
    for name, value in local.runtime_secrets : name => value
    if try(trimspace(value), "") != ""
  }

  # Names only, so safe to unmark. Left sensitive, Terraform refuses to print
  # the precondition's message and the failed apply never says which key is
  # missing, which is how Stripe stayed off both environments unnoticed (#322).
  missing_prod_runtime_secrets = var.name != "prod" ? [] : sort(nonsensitive(tolist(setsubtract(
    ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "ABR_GUID"],
    keys(local.runtime_secret_variables),
  ))))
}

resource "aws_amplify_branch" "this" {
  app_id      = var.amplify_app_id
  branch_name = var.branch_name
  stage       = var.amplify_stage

  enable_auto_build           = var.auto_build_enabled
  enable_pull_request_preview = var.enable_pull_request_preview

  environment_variables = merge(
    {
      DATABASE_URL                    = var.database_url
      UPLOADS_BUCKET                  = aws_s3_bucket.uploads.id
      UPLOADS_BUCKET_REGIONAL_DOMAIN  = aws_s3_bucket.uploads.bucket_regional_domain_name
      CDN_URL                         = var.cdn_custom_domain != null ? "https://${var.cdn_custom_domain}" : "https://${aws_cloudfront_distribution.cdn.domain_name}"
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = var.mapbox_access_token
      NEXT_PUBLIC_TURNSTILE_SITE_KEY  = var.turnstile_site_key
    },
    local.runtime_secret_variables,
    var.extra_branch_environment_variables,
  )

  lifecycle {
    create_before_destroy = false

    precondition {
      condition     = contains(["PRODUCTION", "BETA", "DEVELOPMENT"], var.amplify_stage)
      error_message = "amplify_stage must be one of PRODUCTION, BETA, or DEVELOPMENT."
    }

    # This resource owns the whole environment_variables map, so anything set by
    # hand in the Amplify console is deleted on the next apply. Before that
    # could quietly take payments and email offline, fail the plan instead and
    # say which key is missing from startline/ci-bootstrap.
    precondition {
      condition = length(local.missing_prod_runtime_secrets) == 0
      error_message = format(
        "Missing prod runtime secrets: %s. Add the matching keys to the startline/ci-bootstrap secret (stripe_secret_key_prod, stripe_webhook_secret_prod, resend_api_key, abr_guid) — applying without them would strip the values from the Amplify branch and break checkout, email and ABN lookup.",
        join(", ", local.missing_prod_runtime_secrets),
      )
    }
  }

  tags = {
    Environment = var.name == "prod" ? "Prod" : "Stage"
    Service     = var.project_name
  }
}

# ===== S3 upload bucket =====

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-${var.name}-uploads"

  force_destroy = var.name != "prod"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
  rule {
    id     = "expire-old-objects"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "uploads_oac" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/uploads/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }

  statement {
    sid    = "DenyNonSSL"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.uploads.arn,
      "${aws_s3_bucket.uploads.arn}/*",
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads_oac" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.uploads_oac.json
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  dynamic "cors_rule" {
    for_each = [for i, v in var.bucket_cors_allowed_origins : {
      origin = v
    }]
    content {
      allowed_headers = ["*"]
      allowed_methods = ["GET", "PUT", "POST", "DELETE"]
      allowed_origins = [cors_rule.value.origin]
      expose_headers  = ["ETag"]
      max_age_seconds = 3600
    }
  }
}

# ===== CloudFront CDN for upload bucket =====

resource "aws_wafv2_web_acl" "cdn" {
  count    = var.cdn_waf_enabled ? 1 : 0
  provider = aws.us_east_1

  name        = "${var.project_name}-${var.name}-cdn-waf"
  description = "Rate-limiting WAF for ${var.name} CDN"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 5000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = false
      metric_name                = "${var.project_name}_${var.name}_cdn_rate_limit"
      sampled_requests_enabled   = false
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = false
    metric_name                = "${var.project_name}_${var.name}_cdn_waf"
    sampled_requests_enabled   = false
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_cloudfront_origin_access_control" "cdn" {
  name                              = "${var.project_name}-${var.name}-cdn-oac"
  description                       = "OAC for ${var.name} upload bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  web_acl_id          = var.cdn_waf_enabled ? aws_wafv2_web_acl.cdn[0].arn : null
  comment             = "CDN for ${var.name} upload bucket"
  price_class         = "PriceClass_100"
  aliases             = var.cdn_custom_domain != null ? [var.cdn_custom_domain] : []

  origin {
    domain_name              = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.cdn.id
    origin_id                = "s3-uploads"
  }

  default_cache_behavior {
    target_origin_id       = "s3-uploads"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 3600
    default_ttl = 86400
    max_ttl     = 604800
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_custom_domain != null ? [1] : []
    content {
      acm_certificate_arn      = var.cdn_cert_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_custom_domain == null ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}
