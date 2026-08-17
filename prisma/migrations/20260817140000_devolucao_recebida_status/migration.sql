-- AlterEnum
-- New intermediate step: the store has physically received a returned
-- product and needs to hand it off to the internal team so they can charge
-- the marketplace for it, distinct from DEVOLUCAO_REALIZADA (fully closed).
ALTER TYPE "StatusOperacionalLoja" ADD VALUE IF NOT EXISTS 'DEVOLUCAO_RECEBIDA';
ALTER TYPE "StatusOperacional" ADD VALUE IF NOT EXISTS 'DEVOLUCAO_RECEBIDA';
