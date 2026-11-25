-- CreateTable
CREATE TABLE "Fingerprint" (
    "id" TEXT NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "attrs" JSONB NOT NULL,
    "userAgent" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "firstLink" TEXT NOT NULL,
    "lastLink" TEXT NOT NULL,
    "lastSample" JSONB NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fingerprint_hash_key" ON "Fingerprint"("hash");

-- CreateIndex
CREATE INDEX "Fingerprint_lastSeen_idx" ON "Fingerprint"("lastSeen");

-- CreateIndex
CREATE INDEX "Fingerprint_hits_idx" ON "Fingerprint"("hits");

