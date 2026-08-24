-- Removes the Google Sheets backup integration: it was never configured
-- with credentials in production (GOOGLE_SERVICE_ACCOUNT_EMAIL /
-- GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID were
-- never set), so every ticket create/update was marking backupSyncStatus
-- as FAILED — showing as a false "backups com falha" alarm on every ticket
-- in the Admin screen instead of a real problem. Not used going forward, so
-- drop the columns, their index and the enum rather than leave dead state.

DROP INDEX IF EXISTS "Ticket_backup_status_idx";

ALTER TABLE "Ticket"
  DROP COLUMN IF EXISTS "backupSheetRowNumber",
  DROP COLUMN IF EXISTS "backupSyncStatus",
  DROP COLUMN IF EXISTS "backupLastSyncedAt",
  DROP COLUMN IF EXISTS "backupSyncError";

DROP TYPE IF EXISTS "BackupSyncStatus";
