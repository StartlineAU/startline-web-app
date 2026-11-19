-- An invitation to join an organisation, accepted by the invitee.
CREATE TABLE "organiser_invites" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "organiser_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organiser_invites_tokenHash_key" ON "organiser_invites"("tokenHash");
CREATE INDEX "organiser_invites_organiserId_idx" ON "organiser_invites"("organiserId");
CREATE INDEX "organiser_invites_email_idx" ON "organiser_invites"("email");

ALTER TABLE "organiser_invites" ADD CONSTRAINT "organiser_invites_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
