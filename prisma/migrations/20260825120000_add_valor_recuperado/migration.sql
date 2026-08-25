-- Tracks how much was actually recovered from the marketplace for a
-- returned product (the "cobrança ao marketplace" flow triggered by
-- DEVOLUCAO_RECEBIDA), editable by staff on any ticket. Not part of
-- custosTotais — this is money coming back, not a cost.
ALTER TABLE "Ticket"
  ADD COLUMN "valorRecuperado" DECIMAL(12,2) NOT NULL DEFAULT 0;
