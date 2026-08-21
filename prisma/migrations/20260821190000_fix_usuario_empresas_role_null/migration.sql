-- The usuario_empresas table was originally created ad hoc directly in
-- production before it was formalized as a tracked Prisma model (see the
-- usuario_empresa_model migration). That earlier ad hoc table predates the
-- "role" column having a NOT NULL DEFAULT, so existing rows can hold NULL,
-- which the Prisma client (generated from the current non-nullable schema)
-- fails to read. Backfill and enforce the constraint. Idempotent.

UPDATE "usuario_empresas" SET "role" = 'MEMBER' WHERE "role" IS NULL;

ALTER TABLE "usuario_empresas" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "usuario_empresas" ALTER COLUMN "role" SET NOT NULL;
