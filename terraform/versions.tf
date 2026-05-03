terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Uncomment and configure for remote state (recommended for teams).
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "startline/terraform.tfstate"
  #   region         = "ap-southeast-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}
