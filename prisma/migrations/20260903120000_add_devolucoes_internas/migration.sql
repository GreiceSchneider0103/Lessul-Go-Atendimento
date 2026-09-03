-- Internal returns control for Lessul (the main, first-party store) —
-- replaces the manual "recebimento de devolução" spreadsheet. Deliberately
-- outside the Ticket/OperationalRequest flow: it's the attendance team's
-- own record of what happened to a returned product and how much they
-- recovered from the marketplace, not a customer complaint or a task
-- assigned to another store.

CREATE TYPE "DevolucaoDefeito" AS ENUM (
  'NENHUM',
  'EMBALAGEM_DANIFICADA',
  'PECAS_DANIFICADAS',
  'PRODUTO_DANIFICADO',
  'PRODUTO_PARCIALMENTE_DANIFICADO',
  'DEVOLVIDO_ERRADO',
  'OUTRO'
);

CREATE TYPE "DevolucaoSolucao" AS ENUM (
  'SOLICITADO_ASSISTENCIA',
  'ENCAMINHADO_OUTRO_DESTINO',
  'TROCA_EMBALAGEM_ESTOQUE',
  'VOLTOU_ESTOQUE',
  'OUTRO'
);

CREATE SEQUENCE "devolucoes_internas_numero_seq" AS INTEGER START 1;

CREATE TABLE "devolucoes_internas" (
  "id" TEXT NOT NULL,
  "numero" INTEGER NOT NULL DEFAULT nextval('devolucoes_internas_numero_seq'),
  "empresa" "Empresa" NOT NULL DEFAULT 'LESSUL',
  "codigo_venda" TEXT NOT NULL,
  "cliente" TEXT NOT NULL,
  "canal_marketplace" TEXT NOT NULL,
  "produto" TEXT NOT NULL,
  "sku" TEXT,
  "defeito" "DevolucaoDefeito" NOT NULL,
  "data_recebimento" TIMESTAMP(3),
  "data_revisao" TIMESTAMP(3),
  "solucao" "DevolucaoSolucao",
  "solicitado_reembolso" BOOLEAN NOT NULL DEFAULT false,
  "valor_recuperado" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "observacao" TEXT,
  "criado_por_id" TEXT NOT NULL,
  "atualizado_por_id" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "devolucoes_internas_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "devolucoes_internas_numero_seq" OWNED BY "devolucoes_internas"."numero";

CREATE UNIQUE INDEX "devolucoes_internas_numero_key" ON "devolucoes_internas"("numero");
CREATE INDEX "DevolucaoInterna_data_recebimento_idx" ON "devolucoes_internas"("data_recebimento");

ALTER TABLE "devolucoes_internas"
  ADD CONSTRAINT "devolucoes_internas_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "Usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "devolucoes_internas_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "Usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
