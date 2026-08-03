ALTER TABLE "Room" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 2;

CREATE TABLE "RoomRound" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "roundNo" INTEGER NOT NULL,
  "speakerUserId" TEXT NOT NULL,
  "listenerUserId" TEXT NOT NULL,
  "topicId" TEXT,
  "topicSwapCount" INTEGER NOT NULL DEFAULT 0,
  "topicLocked" BOOLEAN NOT NULL DEFAULT false,
  "shownTopicIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "continuedPrevious" BOOLEAN NOT NULL DEFAULT false,
  "previousRoundId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "RoomRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomRound_previousRoundId_key" ON "RoomRound"("previousRoundId");
CREATE UNIQUE INDEX "RoomRound_roomId_roundNo_key" ON "RoomRound"("roomId", "roundNo");
CREATE INDEX "RoomRound_roomId_endedAt_idx" ON "RoomRound"("roomId", "endedAt");
CREATE INDEX "RoomRound_speakerUserId_idx" ON "RoomRound"("speakerUserId");
CREATE INDEX "RoomRound_listenerUserId_idx" ON "RoomRound"("listenerUserId");

ALTER TABLE "RoomRound" ADD CONSTRAINT "RoomRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomRound" ADD CONSTRAINT "RoomRound_speakerUserId_fkey" FOREIGN KEY ("speakerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomRound" ADD CONSTRAINT "RoomRound_listenerUserId_fkey" FOREIGN KEY ("listenerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomRound" ADD CONSTRAINT "RoomRound_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomRound" ADD CONSTRAINT "RoomRound_previousRoundId_fkey" FOREIGN KEY ("previousRoundId") REFERENCES "RoomRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
