resource "aws_iam_group" "admin" {
  name = "Admin"
}

resource "aws_iam_group" "readonly" {
  name = "ReadOnly"
}

resource "aws_iam_group_policy_attachment" "admin" {
  group      = aws_iam_group.admin.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_group_policy_attachment" "readonly" {
  group      = aws_iam_group.readonly.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_user" "admin" {
  name = "Admin"
}

resource "aws_iam_user" "readonly" {
  name = "ReadOnly"
}

resource "aws_iam_user" "mcp_server" {
  name = "mcp-server"
  tags = {
    Purpose = "mcp-server"
  }
}

resource "aws_iam_user_group_membership" "admin" {
  user   = aws_iam_user.admin.name
  groups = [aws_iam_group.admin.name]
}

resource "aws_iam_user_group_membership" "readonly" {
  user   = aws_iam_user.readonly.name
  groups = [aws_iam_group.readonly.name]
}
