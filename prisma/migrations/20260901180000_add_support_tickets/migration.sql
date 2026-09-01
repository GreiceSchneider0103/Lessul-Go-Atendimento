-- Suporte tab: support tickets opened by LOJA users for general requests
-- (não relacionados a reclamações de marketplace) directed at the team that
-- administers the store accounts. Kept fully separate from the Ticket table.

CREATE TYPE "SupportCategoria" AS ENUM ('GERAL', 'ALTERACAO', 'DUVIDA', 'OUTRO');
CREATE TYPE "SupportStatus" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_LOJA', 'CONCLUIDO');
CREATE TYPE "SupportTipoAnexo" AS ENUM ('IMAGEM', 'PDF', 'OUTRO');

ALTER TABLE "Usuario" ADD COLUMN "suporte_visitado_em" TIMESTAMP(3);

CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "empresa" "Empresa" NOT NULL,
  "categoria" "SupportCategoria" NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "status" "SupportStatus" NOT NULL DEFAULT 'ABERTO',
  "prazo_resposta" TIMESTAMP(3) NOT NULL,
  "sla_status" TEXT NOT NULL DEFAULT 'NO_PRAZO',
  "responsavel_id" TEXT,
  "criado_por_id" TEXT NOT NULL,
  "atualizado_por_id" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  "concluido_em" TIMESTAMP(3),

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_comentarios" (
  "id" TEXT NOT NULL,
  "support_ticket_id" TEXT NOT NULL,
  "autor_id" TEXT,
  "autor_nome" TEXT,
  "autor_perfil" "Perfil",
  "comentario" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_comentarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_anexos" (
  "id" TEXT NOT NULL,
  "support_ticket_id" TEXT NOT NULL,
  "tipo_anexo" "SupportTipoAnexo" NOT NULL,
  "storage_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" BIGINT,
  "uploaded_by" TEXT,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_anexos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_empresa_status_idx" ON "support_tickets"("empresa", "status");
CREATE INDEX "SupportTicket_status_prazo_idx" ON "support_tickets"("status", "prazo_resposta");
CREATE INDEX "SupportComentario_ticket_criado_idx" ON "support_comentarios"("support_ticket_id", "criado_em");
CREATE INDEX "SupportAnexo_ticket_idx" ON "support_anexos"("support_ticket_id");

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "support_tickets_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "Usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "support_tickets_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "Usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "support_comentarios"
  ADD CONSTRAINT "support_comentarios_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "support_comentarios_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_anexos"
  ADD CONSTRAINT "support_anexos_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "support_anexos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
