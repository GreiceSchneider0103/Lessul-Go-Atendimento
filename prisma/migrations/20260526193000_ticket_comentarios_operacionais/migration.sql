CREATE TABLE IF NOT EXISTS "TicketComentarioOperacional" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "autorId" TEXT,
  "autorNome" TEXT,
  "autorPerfil" "Perfil",
  "comentario" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketComentarioOperacional_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketComentarioOperacional_ticketId_criadoEm_idx"
ON "TicketComentarioOperacional"("ticketId", "criadoEm");

ALTER TABLE "TicketComentarioOperacional"
ADD CONSTRAINT "TicketComentarioOperacional_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
