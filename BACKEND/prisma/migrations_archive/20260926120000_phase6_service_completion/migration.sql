CREATE TYPE "JobPhotoType" AS ENUM ('BEFORE', 'AFTER');

ALTER TABLE "Job"
  ADD COLUMN "problemFound" TEXT,
  ADD COLUMN "workPerformed" TEXT,
  ADD COLUMN "workNotes" TEXT,
  ADD COLUMN "completionNotes" TEXT;

-- Existing photo rows predate photo classification. Preserve them as AFTER photos,
-- then remove the temporary default so all new records must explicitly provide a type.
ALTER TABLE "JobPhoto"
  ADD COLUMN "type" "JobPhotoType" NOT NULL DEFAULT 'AFTER';

ALTER TABLE "JobPhoto"
  ALTER COLUMN "type" DROP DEFAULT;
