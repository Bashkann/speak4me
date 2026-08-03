CREATE TABLE "UploadGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadGrant_objectKey_key" ON "UploadGrant"("objectKey");
CREATE INDEX "UploadGrant_userId_expiresAt_idx" ON "UploadGrant"("userId", "expiresAt");

ALTER TABLE "UploadGrant" ADD CONSTRAINT "UploadGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
