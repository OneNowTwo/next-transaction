-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "isFictional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'Industrial',
    "landAreaSqm" DOUBLE PRECISION,
    "buildingAreaSqm" DOUBLE PRECISION,
    "ownerEntity" TEXT,
    "tenant" TEXT,
    "lastSaleDate" TIMESTAMP(3),
    "leaseExpiry" TIMESTAMP(3),
    "leaseOptionInfo" TEXT,
    "leaseVerifiedAt" TIMESTAMP(3),
    "assignedAgent" TEXT,
    "relationshipNotes" TEXT,
    "isFictional" BOOLEAN NOT NULL DEFAULT false,
    "importKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "signalCategory" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "excerpt" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "eventKey" TEXT,
    "isFictional" BOOLEAN NOT NULL DEFAULT false,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 30,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "whyNow" TEXT NOT NULL,
    "evidenceQuality" TEXT NOT NULL,
    "missingInfo" TEXT,
    "suggestedAction" TEXT,
    "dismissReason" TEXT,
    "reviewDate" TIMESTAMP(3),
    "newestEvidenceAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "isFictional" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityRule" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "weightApplied" INTEGER NOT NULL,

    CONSTRAINT "OpportunityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEvidence" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "OpportunityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT,
    "opportunityId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "labels" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnector" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastSuccessAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastRetrievedCount" INTEGER NOT NULL DEFAULT 0,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "retrievedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "logJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedRecord" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addressRaw" TEXT,
    "suburb" TEXT,
    "councilRef" TEXT,
    "companySymbol" TEXT,
    "signalHint" TEXT,
    "rawJson" TEXT NOT NULL DEFAULT '{}',
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "propertyId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ingestedRecordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "candidatePropertyId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_workspaceId_suburb_idx" ON "Property"("workspaceId", "suburb");

-- CreateIndex
CREATE INDEX "Property_workspaceId_address_idx" ON "Property"("workspaceId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Property_workspaceId_importKey_key" ON "Property"("workspaceId", "importKey");

-- CreateIndex
CREATE INDEX "Evidence_workspaceId_propertyId_idx" ON "Evidence"("workspaceId", "propertyId");

-- CreateIndex
CREATE INDEX "Evidence_workspaceId_eventKey_idx" ON "Evidence"("workspaceId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "Rule_workspaceId_key_key" ON "Rule"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "Opportunity_workspaceId_status_priority_idx" ON "Opportunity"("workspaceId", "status", "priority");

-- CreateIndex
CREATE INDEX "Opportunity_workspaceId_type_idx" ON "Opportunity"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityRule_opportunityId_ruleId_key" ON "OpportunityRule"("opportunityId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityEvidence_opportunityId_evidenceId_key" ON "OpportunityEvidence"("opportunityId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_opportunityId_key" ON "Feedback"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_workspaceId_opportunityId_key" ON "Feedback"("workspaceId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConnector_key_key" ON "SourceConnector"("key");

-- CreateIndex
CREATE INDEX "IngestionRun_connectorId_startedAt_idx" ON "IngestionRun"("connectorId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestedRecord_dedupeKey_key" ON "IngestedRecord"("dedupeKey");

-- CreateIndex
CREATE INDEX "IngestedRecord_connectorId_retrievedAt_idx" ON "IngestedRecord"("connectorId", "retrievedAt");

-- CreateIndex
CREATE INDEX "IngestedRecord_matchStatus_idx" ON "IngestedRecord"("matchStatus");

-- CreateIndex
CREATE INDEX "IngestedRecord_suburb_idx" ON "IngestedRecord"("suburb");

-- CreateIndex
CREATE INDEX "MatchReview_workspaceId_status_idx" ON "MatchReview"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRule" ADD CONSTRAINT "OpportunityRule_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRule" ADD CONSTRAINT "OpportunityRule_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvidence" ADD CONSTRAINT "OpportunityEvidence_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvidence" ADD CONSTRAINT "OpportunityEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "SourceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestedRecord" ADD CONSTRAINT "IngestedRecord_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "SourceConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestedRecord" ADD CONSTRAINT "IngestedRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReview" ADD CONSTRAINT "MatchReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReview" ADD CONSTRAINT "MatchReview_ingestedRecordId_fkey" FOREIGN KEY ("ingestedRecordId") REFERENCES "IngestedRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

