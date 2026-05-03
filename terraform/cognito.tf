# Cognito User Pool for StartLine.
#
# Email + password only. The Next.js app's sign-in UI is built later and will
# call Cognito directly via the SDK (USER_SRP_AUTH) — no Hosted UI / OAuth /
# callback URLs needed. Add social IdPs back here when needed.

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-users"

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
}

# Confidential client (with secret) — the Next.js app runs server-side on
# Amplify SSR, so it can keep the secret. Switch generate_secret to false if
# you ever need to use this client from a pure browser SPA.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = true

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
