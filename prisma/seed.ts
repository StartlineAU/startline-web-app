// Admin accounts are created automatically on first Cognito login.
// Add users to the "Admins" group in the Cognito User Pool via the AWS console.

async function main() {
  console.log("No seed data to apply — admin accounts are provisioned via Cognito.");
}

main().catch((e) => { console.error(e); process.exit(1); });
