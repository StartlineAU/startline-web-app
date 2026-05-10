-- Switch Admin from password-based to Cognito-based auth

ALTER TABLE "Admin" DROP COLUMN "password";
ALTER TABLE "Admin" ADD COLUMN "cognitoSub" TEXT NOT NULL;
ALTER TABLE "Admin" ALTER COLUMN "name" DROP NOT NULL;

CREATE UNIQUE INDEX "Admin_cognitoSub_key" ON "Admin"("cognitoSub");
