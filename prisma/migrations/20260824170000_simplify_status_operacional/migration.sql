-- Simplifies the operational status list from 14 down to 11 values (10
-- selectable + the EM_ABERTO default), per updated requirements. Backfills
-- existing rows away from the 5 values being dropped, mapping each to the
-- closest surviving state, before recreating both enum types with the final
-- value set (Postgres has no direct "DROP VALUE" for enums).
--
-- Mapping for removed values:
--   ASSISTENCIA_A_CAMINHO -> ASSISTENCIA_ENVIADA (in-transit tracking dropped)
--   ASSISTENCIA_ENTREGUE  -> CONCLUIDA (delivery already meant "done")
--   DEVOLUCAO_SOLICITADA  -> EM_ABERTO (no more granular pre-receipt tracking)
--   DEVOLUCAO_A_CAMINHO   -> EM_ABERTO
--   DEVOLUCAO_REALIZADA   -> CONCLUIDA (already meant the return was finished)
--
-- New values added: ENVIAR_ASSISTENCIA, COLETAR (explicit "not started yet"
-- states for the assistência/coleta flows, replacing the generic EM_ABERTO
-- default in that context).

UPDATE "Ticket" SET "statusOperacionalLoja" = 'ASSISTENCIA_ENVIADA' WHERE "statusOperacionalLoja" = 'ASSISTENCIA_A_CAMINHO';
UPDATE "Ticket" SET "statusOperacionalLoja" = 'CONCLUIDA' WHERE "statusOperacionalLoja" = 'ASSISTENCIA_ENTREGUE';
UPDATE "Ticket" SET "statusOperacionalLoja" = 'EM_ABERTO' WHERE "statusOperacionalLoja" IN ('DEVOLUCAO_SOLICITADA', 'DEVOLUCAO_A_CAMINHO');
UPDATE "Ticket" SET "statusOperacionalLoja" = 'CONCLUIDA' WHERE "statusOperacionalLoja" = 'DEVOLUCAO_REALIZADA';

UPDATE "OperationalRequest" SET "status" = 'ASSISTENCIA_ENVIADA' WHERE "status" = 'ASSISTENCIA_A_CAMINHO';
UPDATE "OperationalRequest" SET "status" = 'CONCLUIDA' WHERE "status" = 'ASSISTENCIA_ENTREGUE';
UPDATE "OperationalRequest" SET "status" = 'EM_ABERTO' WHERE "status" IN ('DEVOLUCAO_SOLICITADA', 'DEVOLUCAO_A_CAMINHO');
UPDATE "OperationalRequest" SET "status" = 'CONCLUIDA' WHERE "status" = 'DEVOLUCAO_REALIZADA';

-- Recreate StatusOperacionalLoja (used by Ticket.statusOperacionalLoja).
ALTER TYPE "StatusOperacionalLoja" RENAME TO "StatusOperacionalLoja_old";

CREATE TYPE "StatusOperacionalLoja" AS ENUM (
  'EM_ABERTO',
  'ENVIAR_ASSISTENCIA',
  'ASSISTENCIA_ENVIADA',
  'COLETAR',
  'COLETA_SOLICITADA',
  'COLETA_FEITA',
  'DEVOLUCAO_RECEBIDA',
  'REEMBOLSO_PENDENTE',
  'REEMBOLSO_REALIZADO',
  'AGUARDANDO_ATENDENTE',
  'CONCLUIDA'
);

ALTER TABLE "Ticket" ALTER COLUMN "statusOperacionalLoja" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "statusOperacionalLoja" TYPE "StatusOperacionalLoja" USING ("statusOperacionalLoja"::text::"StatusOperacionalLoja");
ALTER TABLE "Ticket" ALTER COLUMN "statusOperacionalLoja" SET DEFAULT 'EM_ABERTO';

DROP TYPE "StatusOperacionalLoja_old";

-- Recreate StatusOperacional (used by OperationalRequest.status) the same way.
ALTER TYPE "StatusOperacional" RENAME TO "StatusOperacional_old";

CREATE TYPE "StatusOperacional" AS ENUM (
  'EM_ABERTO',
  'ENVIAR_ASSISTENCIA',
  'ASSISTENCIA_ENVIADA',
  'COLETAR',
  'COLETA_SOLICITADA',
  'COLETA_FEITA',
  'DEVOLUCAO_RECEBIDA',
  'REEMBOLSO_PENDENTE',
  'REEMBOLSO_REALIZADO',
  'AGUARDANDO_ATENDENTE',
  'CONCLUIDA'
);

ALTER TABLE "OperationalRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OperationalRequest" ALTER COLUMN "status" TYPE "StatusOperacional" USING ("status"::text::"StatusOperacional");
ALTER TABLE "OperationalRequest" ALTER COLUMN "status" SET DEFAULT 'EM_ABERTO';

DROP TYPE "StatusOperacional_old";
