-- One-time recovery codes for the authenticator app. Only the SHA-256 of each
-- code is stored; the plaintext exists once, when the app is set up.
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recovery_codes_userId_idx" ON "recovery_codes"("userId");

ALTER TABLE "recovery_codes"
  ADD CONSTRAINT "recovery_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
