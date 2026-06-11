-- Migration: add concluidoEm to Ticket
ALTER TABLE "Ticket" ADD COLUMN "concluidoEm" timestamptz;
