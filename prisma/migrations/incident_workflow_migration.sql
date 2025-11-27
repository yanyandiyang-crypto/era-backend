-- Incident Workflow Migration
-- This migration adds support for the new 4-stage incident workflow with multi-personnel response

-- =====================================================
-- 1. UPDATE ENUMS
-- =====================================================

-- Add new incident statuses
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'RESPONDING';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';

-- Add new personnel statuses
ALTER TYPE "PersonnelStatus" ADD VALUE IF NOT EXISTS 'RESPONDING';
ALTER TYPE "PersonnelStatus" ADD VALUE IF NOT EXISTS 'ON_SCENE';

-- =====================================================
-- 2. CREATE INCIDENT_RESPONDERS TABLE (Multi-Personnel Support)
-- =====================================================

CREATE TABLE IF NOT EXISTS "incident_responders" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "personnelId" TEXT NOT NULL,
  
  -- Timestamps
  "acceptedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "arrivedAt" TIMESTAMP,
  "leftAt" TIMESTAMP,
  
  -- Role tracking
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  "notes" TEXT,
  
  -- Foreign keys
  CONSTRAINT "incident_responders_incidentId_fkey" 
    FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "incident_responders_personnelId_fkey" 
    FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE CASCADE,
  
  -- Prevent duplicate assignments
  CONSTRAINT "incident_responders_incidentId_personnelId_key" 
    UNIQUE ("incidentId", "personnelId")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "incident_responders_incidentId_idx" 
  ON "incident_responders"("incidentId");
  
CREATE INDEX IF NOT EXISTS "incident_responders_personnelId_idx" 
  ON "incident_responders"("personnelId");

-- =====================================================
-- 3. ADD NEW FIELDS TO INCIDENTS TABLE
-- =====================================================

-- Primary responder tracking
ALTER TABLE "incidents" 
  ADD COLUMN IF NOT EXISTS "primaryResponderId" TEXT;

-- Workflow timestamps
ALTER TABLE "incidents" 
  ADD COLUMN IF NOT EXISTS "respondingAt" TIMESTAMP;

-- Resolution tracking
ALTER TABLE "incidents" 
  ADD COLUMN IF NOT EXISTS "resolutionNotes" TEXT;

ALTER TABLE "incidents" 
  ADD COLUMN IF NOT EXISTS "resolvedById" TEXT;

-- Add foreign key for primary responder
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'incidents_primaryResponderId_fkey'
  ) THEN
    ALTER TABLE "incidents"
      ADD CONSTRAINT "incidents_primaryResponderId_fkey"
      FOREIGN KEY ("primaryResponderId") 
      REFERENCES "personnel"("id") 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for resolved by
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'incidents_resolvedById_fkey'
  ) THEN
    ALTER TABLE "incidents"
      ADD CONSTRAINT "incidents_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") 
      REFERENCES "users"("id") 
      ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 4. CREATE INCIDENT_TIMELINE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "incident_timeline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  
  -- Status tracking
  "status" "IncidentStatus" NOT NULL,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Actor tracking
  "userId" TEXT,
  "personnelId" TEXT,
  
  -- Additional context
  "notes" TEXT,
  "metadata" JSONB,
  
  -- Foreign keys
  CONSTRAINT "incident_timeline_incidentId_fkey" 
    FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "incident_timeline_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "incident_timeline_personnelId_fkey" 
    FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE SET NULL
);

-- Create composite index for timeline queries
CREATE INDEX IF NOT EXISTS "incident_timeline_incidentId_timestamp_idx" 
  ON "incident_timeline"("incidentId", "timestamp" DESC);

-- =====================================================
-- 5. UPDATE EXISTING DATA (Optional - for clean migration)
-- =====================================================

-- Update any IN_PROGRESS incidents to RESPONDING
UPDATE "incidents" 
SET "status" = 'RESPONDING' 
WHERE "status" = 'IN_PROGRESS';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Run this to verify the migration:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'incidents';
-- SELECT * FROM information_schema.tables WHERE table_name = 'incident_responders';
-- SELECT * FROM information_schema.tables WHERE table_name = 'incident_timeline';
