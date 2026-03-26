-- Add refresh token fields to sessions table
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT UNIQUE;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "refresh_expires_at" TIMESTAMPTZ(6);

-- Create index for refresh token lookups
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh_token" ON "sessions"("refresh_token");