/*
  Warnings:

  - Added the required column `ownerId` to the `havrutot` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add new columns to havrutot table
ALTER TABLE "havrutot" ADD COLUMN "lastPlace" TEXT NOT NULL DEFAULT '';
ALTER TABLE "havrutot" ADD COLUMN "ownerId" TEXT;

-- Step 2: Populate ownerId with creatorId for existing records
UPDATE "havrutot" SET "ownerId" = "creatorId" WHERE "ownerId" IS NULL;

-- Step 3: Make ownerId required now that it's populated
ALTER TABLE "havrutot" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 4: Add new columns to sessions table
ALTER TABLE "sessions" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "sessions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "sessions" ADD COLUMN "startingSection" TEXT NOT NULL DEFAULT '';
ALTER TABLE "sessions" ADD COLUMN "endingSection" TEXT;
ALTER TABLE "sessions" ADD COLUMN "coverageRange" TEXT;

-- Step 5: Migrate existing session data
-- Set status to 'completed' for sessions that have an endTime
UPDATE "sessions" SET "status" = 'completed' WHERE "endTime" IS NOT NULL;

-- Set status to 'active' for sessions that started but haven't ended
UPDATE "sessions" SET "status" = 'active' WHERE "startTime" <= NOW() AND "endTime" IS NULL;

-- Populate startingSection from havruta's currentSection for existing sessions
UPDATE "sessions" 
SET "startingSection" = h."currentSection"
FROM "havrutot" h 
WHERE "sessions"."havrutaId" = h."id" AND "sessions"."startingSection" = '';

-- Step 6: Create invitations table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "invitations" (
    "id" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitationToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "inviterUserId" TEXT NOT NULL,
    "havrutaId" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_invitationToken_key" ON "invitations"("invitationToken");
CREATE INDEX IF NOT EXISTS "sessions_havrutaId_status_idx" ON "sessions"("havrutaId", "status");
CREATE INDEX IF NOT EXISTS "sessions_status_idx" ON "sessions"("status");
CREATE INDEX IF NOT EXISTS "sessions_type_status_idx" ON "sessions"("type", "status");

-- Step 8: Add foreign key constraints
ALTER TABLE "havrutot" ADD CONSTRAINT "havrutot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign keys for invitations table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitations_inviterUserId_fkey') THEN
        ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitations_havrutaId_fkey') THEN
        ALTER TABLE "invitations" ADD CONSTRAINT "invitations_havrutaId_fkey" FOREIGN KEY ("havrutaId") REFERENCES "havrutot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;