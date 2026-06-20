#!/usr/bin/env bash
set -euo pipefail

EP="http://localhost:9229"
POOL="local_1zg1VuY1"
CLIENT="5um8ef5csarhmsyqi8jbkug94"
REGION="us-east-1"
PASSWORD="Password123!"

echo "🔐 Setting up cognito-local..."

# Create user pool
echo "  Creating user pool..."
aws cognito-idp create-user-pool \
  --endpoint "$EP" --pool-name StartlineLocal --region "$REGION" \
  > /dev/null

# Create app client
echo "  Creating app client..."
aws cognito-idp create-user-pool-client \
  --endpoint "$EP" --user-pool-id "$POOL" --client-name startline-app \
  --region "$REGION" --no-generate-secret \
  > /dev/null

# Create admin group
echo "  Creating admin group..."
aws cognito-idp create-group \
  --endpoint "$EP" --user-pool-id "$POOL" --group-name admin-nonprod-users \
  --region "$REGION" \
  > /dev/null

# Users to create
USERS=(
  "test.organiser@startlineau.com"
  "hello@coastaltrailrunning.com.au"
  "info@urbanfitnessevents.com.au"
  "admin@startlineau.com"
  "sarah.kovac@example.com"
  "tom.rendell@example.com"
  "brooke.mitchell@example.com"
  "liam.oconnor@example.com"
)

for email in "${USERS[@]}"; do
  echo "  Creating user: $email"
  aws cognito-idp sign-up \
    --endpoint "$EP" --client-id "$CLIENT" \
    --username "$email" --password "$PASSWORD" --region "$REGION" \
    > /dev/null

  aws cognito-idp admin-confirm-sign-up \
    --endpoint "$EP" --user-pool-id "$POOL" --username "$email" \
    --region "$REGION" \
    > /dev/null
done

# Add admin to admin group
echo "  Adding admin to admin-nonprod-users..."
aws cognito-idp admin-add-user-to-group \
  --endpoint "$EP" --user-pool-id "$POOL" \
  --username "admin@startlineau.com" --group-name admin-nonprod-users \
  --region "$REGION" \
  > /dev/null

echo ""
echo "✅ cognito-local setup complete."
echo ""
echo "Login emails (password: ${PASSWORD}):"
echo "  test.organiser@startlineau.com      (Organiser — Apex Endurance Events)"
echo "  hello@coastaltrailrunning.com.au    (Organiser — Coastal Trail Running)"
echo "  info@urbanfitnessevents.com.au      (Organiser — Urban Fitness Events)"
echo "  admin@startlineau.com               (Admin)"
echo "  sarah.kovac@example.com             (Athlete)"
echo "  tom.rendell@example.com             (Athlete)"
echo "  brooke.mitchell@example.com         (Athlete)"
echo "  liam.oconnor@example.com            (Athlete)"
