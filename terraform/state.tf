# S3 bucket holding Terraform state for StartLine infra.
#
# Bootstrap order (one-time):
#   1. Apply with current local backend to create this bucket.
#   2. Uncomment the backend "s3" block in versions.tf (with the bucket name
#      this resource creates).
#   3. terraform init -migrate-state  (moves local state into the bucket).
# After migration this bucket holds the state that describes itself — fine,
# prevent_destroy guards against accidental teardown.

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project_name}-tf-state-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}