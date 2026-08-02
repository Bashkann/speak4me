ALTER TYPE "EnglishLevel" ADD VALUE IF NOT EXISTS 'A1' BEFORE 'A2';
ALTER TYPE "EnglishLevel" ADD VALUE IF NOT EXISTS 'C2' AFTER 'C1';
ALTER TYPE "TopicLevel" ADD VALUE IF NOT EXISTS 'A1' BEFORE 'A2';
ALTER TYPE "TopicLevel" ADD VALUE IF NOT EXISTS 'C2' AFTER 'C1';

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "nativeLanguage" TEXT,
  ADD COLUMN "goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "suspendedAt" TIMESTAMP(3);

ALTER TABLE "Report" ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_suspendedAt_idx" ON "User"("suspendedAt");
CREATE INDEX "Report_resolvedAt_createdAt_idx" ON "Report"("resolvedAt", "createdAt");
