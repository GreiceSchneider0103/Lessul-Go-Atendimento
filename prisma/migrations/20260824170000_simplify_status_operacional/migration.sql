-- Split from the original single-file migration: adding a new value to a
-- Postgres enum cannot be used within the same transaction it was added in,
-- so it has to land, committed, before the migration that backfills rows
-- onto it (20260824171000_simplify_status_operacional_backfill).
--
-- StatusOperacionalLoja (Ticket.statusOperacionalLoja) has included both
-- 'ASSISTENCIA_ENVIADA' and 'DEVOLUCAO_A_CAMINHO' since it was created.
-- StatusOperacional (OperationalRequest.status) never had either one — the
-- first is what made the original migration fail on production with
-- "invalid input value for enum StatusOperacional: ASSISTENCIA_ENVIADA",
-- and the second fails the same way one statement later (the backfill's
-- `WHERE "status" IN ('DEVOLUCAO_SOLICITADA', 'DEVOLUCAO_A_CAMINHO')` needs
-- both literals to parse as the enum type even though no OperationalRequest
-- row can already hold the value that was never a member).
ALTER TYPE "StatusOperacional" ADD VALUE IF NOT EXISTS 'ASSISTENCIA_ENVIADA';
ALTER TYPE "StatusOperacional" ADD VALUE IF NOT EXISTS 'DEVOLUCAO_A_CAMINHO';
