-- Tracks when each user last viewed Operacional Loja, so the nav item can
-- show an unread indicator for changes made by "the other side" (loja vs.
-- atendimento) since their last visit.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "operacional_loja_visitado_em" TIMESTAMP(3);
