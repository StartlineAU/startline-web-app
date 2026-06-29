# Custom policy for the MCP server — broad read + focused write on Startline infra.
resource "aws_iam_policy" "mcp_server" {
  name        = "StartlineMCPAccess"
  description = "Permissions for MCP server to manage Startline project infrastructure"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadAllServices"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "s3:List*",
          "s3:Get*",
          "rds:Describe*",
          "iam:List*",
          "iam:Get*",
          "cognito-idp:Describe*",
          "cognito-idp:List*",
          "amplify:Get*",
          "amplify:List*",
          "route53:List*",
          "route53:Get*",
          "secretsmanager:List*",
          "secretsmanager:GetResourcePolicy",
          "cloudwatch:Describe*",
          "cloudwatch:Get*",
          "cloudwatch:List*",
          "logs:Describe*",
          "logs:Get*",
          "logs:List*",
          "acm:List*",
          "acm:Describe*",
          "kms:List*",
          "kms:Describe*",
          "ecr:Describe*",
          "ecr:List*",
          "elasticache:Describe*",
          "elasticache:List*",
        ]
        Resource = "*"
      },
      {
        Sid    = "StartlineProjectWrite"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:CreateBucket",
          "s3:PutBucketPolicy",
          "s3:PutBucketVersioning",
          "s3:PutBucketPublicAccessBlock",
          "s3:PutBucketEncryption",
          "cognito-idp:CreateUserPool",
          "cognito-idp:UpdateUserPool",
          "cognito-idp:DeleteUserPool",
          "cognito-idp:CreateUserPoolClient",
          "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:DeleteUserPoolClient",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminAddUserToGroup",
          "amplify:CreateApp",
          "amplify:UpdateApp",
          "amplify:DeleteApp",
          "amplify:CreateBranch",
          "amplify:UpdateBranch",
          "amplify:DeleteBranch",
          "amplify:StartJob",
          "amplify:StopJob",
          "rds:CreateDBInstance",
          "rds:ModifyDBInstance",
          "rds:DeleteDBInstance",
          "rds:CreateDBSubnetGroup",
          "rds:ModifyDBSubnetGroup",
          "rds:DeleteDBSubnetGroup",
          "ec2:CreateVpc",
          "ec2:DeleteVpc",
          "ec2:CreateSubnet",
          "ec2:DeleteSubnet",
          "ec2:CreateInternetGateway",
          "ec2:DeleteInternetGateway",
          "ec2:CreateRouteTable",
          "ec2:DeleteRouteTable",
          "ec2:CreateRoute",
          "ec2:DeleteRoute",
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:AllocateAddress",
          "ec2:ReleaseAddress",
          "ec2:AssociateAddress",
          "ec2:DisassociateAddress",
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DeleteSecret",
          "route53:CreateHostedZone",
          "route53:DeleteHostedZone",
          "route53:ChangeResourceRecordSets",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_user_policy_attachment" "mcp_server" {
  user       = aws_iam_user.mcp_server.name
  policy_arn = aws_iam_policy.mcp_server.arn
}

# ponytail: both access keys get created fresh after import; old keys
# are deactivated/deleted manually once the new ones are in ~/.aws/credentials.
resource "aws_iam_access_key" "admin" {
  user = aws_iam_user.admin.name
}

resource "aws_iam_access_key" "mcp_server" {
  user = aws_iam_user.mcp_server.name
}
