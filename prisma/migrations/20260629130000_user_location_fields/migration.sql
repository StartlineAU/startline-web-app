-- User profile location fields (map centering on login)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" TEXT;
