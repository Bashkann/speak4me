CREATE TYPE "EnglishLevel" AS ENUM ('A2', 'B1', 'B2', 'C1');
CREATE TYPE "TopicLevel" AS ENUM ('A2', 'B1', 'B2', 'C1', 'ALL');
CREATE TYPE "RoomType" AS ENUM ('matchmade', 'private');
CREATE TYPE "RoomStatus" AS ENUM ('waiting', 'ready', 'round1', 'break', 'round2', 'finished', 'aborted');
CREATE TYPE "Pair" AS ENUM ('A', 'B');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "englishLevel" "EnglishLevel" NOT NULL,
  "isBanned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Topic" (
  "id" TEXT NOT NULL,
  "textEn" TEXT NOT NULL,
  "level" "TopicLevel" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "code" CHAR(6) NOT NULL,
  "type" "RoomType" NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'waiting',
  "roundDurationSec" INTEGER NOT NULL DEFAULT 420,
  "currentRound" INTEGER,
  "roundEndsAt" TIMESTAMP(3),
  "topicRound1Id" TEXT,
  "topicRound2Id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RoomParticipant" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seat" INTEGER NOT NULL,
  "pair" "Pair" NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MatchQueueEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "englishLevel" "EnglishLevel" NOT NULL,
  "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchQueueEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Topic_level_isActive_idx" ON "Topic"("level", "isActive");
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE INDEX "Room_status_idx" ON "Room"("status");
CREATE INDEX "Room_createdAt_idx" ON "Room"("createdAt");
CREATE UNIQUE INDEX "RoomParticipant_roomId_userId_key" ON "RoomParticipant"("roomId", "userId");
CREATE UNIQUE INDEX "RoomParticipant_roomId_seat_key" ON "RoomParticipant"("roomId", "seat");
CREATE INDEX "RoomParticipant_userId_leftAt_idx" ON "RoomParticipant"("userId", "leftAt");
CREATE UNIQUE INDEX "MatchQueueEntry_userId_key" ON "MatchQueueEntry"("userId");
CREATE INDEX "MatchQueueEntry_enqueuedAt_idx" ON "MatchQueueEntry"("enqueuedAt");
CREATE INDEX "Report_reportedUserId_createdAt_idx" ON "Report"("reportedUserId", "createdAt");
CREATE INDEX "Report_roomId_idx" ON "Report"("roomId");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

ALTER TABLE "Room" ADD CONSTRAINT "Room_topicRound1Id_fkey" FOREIGN KEY ("topicRound1Id") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_topicRound2Id_fkey" FOREIGN KEY ("topicRound2Id") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchQueueEntry" ADD CONSTRAINT "MatchQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
