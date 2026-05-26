-- AlterEnum
ALTER TYPE "Perfil" ADD VALUE IF NOT EXISTS 'LOJA';
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "empresaVinculada" "Empresa";
CREATE TYPE "TipoAcaoOperacional" AS ENUM ('ASSISTENCIA','COLETA','DEVOLUCAO','REEMBOLSO');
CREATE TYPE "StatusOperacional" AS ENUM ('EM_ABERTO','ASSISTENCIA_A_CAMINHO','ASSISTENCIA_ENTREGUE','COLETA_SOLICITADA','COLETA_FEITA','DEVOLUCAO_SOLICITADA','DEVOLUCAO_REALIZADA','REEMBOLSO_PENDENTE','REEMBOLSO_REALIZADO','AGUARDANDO_ATENDENTE','CONCLUIDA');
CREATE TYPE "TipoAnexoOperacional" AS ENUM ('IMAGEM_PECA','CTE','COMPROVANTE_REEMBOLSO','OUTRO');
CREATE TABLE "OperationalRequest" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "empresa" "Empresa" NOT NULL,
  "tipoAcao" "TipoAcaoOperacional" NOT NULL,
  "status" "StatusOperacional" NOT NULL DEFAULT 'EM_ABERTO',
  "prazoOperacional" TIMESTAMP(3),
  "comentarioAtendente" TEXT,
  "comentarioLoja" TEXT,
  "valorReembolso" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "valorCte" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "valorColetaEnvioPecas" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "codigoRastreio" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OperationalRequestAttachment" (
  "id" TEXT NOT NULL,
  "operationalRequestId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "empresa" "Empresa" NOT NULL,
  "tipoAnexo" "TipoAnexoOperacional" NOT NULL,
  "fileUrl" TEXT,
  "storagePath" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalRequestAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalRequest_empresa_status_idx" ON "OperationalRequest"("empresa", "status");
CREATE INDEX "OperationalRequest_ticket_idx" ON "OperationalRequest"("ticketId");
CREATE INDEX "OperationalRequest_tipo_created_idx" ON "OperationalRequest"("tipoAcao", "createdAt");
CREATE INDEX "OperationalRequestAttachment_request_idx" ON "OperationalRequestAttachment"("operationalRequestId");
ALTER TABLE "OperationalRequest" ADD CONSTRAINT "OperationalRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalRequestAttachment" ADD CONSTRAINT "OperationalRequestAttachment_request_fkey" FOREIGN KEY ("operationalRequestId") REFERENCES "OperationalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalRequestAttachment" ADD CONSTRAINT "OperationalRequestAttachment_ticket_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "OperationalRequest_unique_active" ON "OperationalRequest"("ticketId", "tipoAcao") WHERE "status" <> 'CONCLUIDA';
