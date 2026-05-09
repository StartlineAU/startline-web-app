provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  # Per-environment resources also set Environment={prod|nonprod} via the env
  # module's resource-level tags, which override this default.
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
