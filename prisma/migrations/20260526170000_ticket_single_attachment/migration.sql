ALTER TABLE "Ticket"
ADD COLUMN "anexoUrl" TEXT,
ADD COLUMN "anexoPath" TEXT,
ADD COLUMN "anexoNome" TEXT,
ADD COLUMN "anexoMimeType" TEXT,
ADD COLUMN "anexoSizeBytes" BIGINT,
ADD COLUMN "anexoUploadedAt" TIMESTAMP(3),
ADD COLUMN "anexoUploadedBy" TEXT;
