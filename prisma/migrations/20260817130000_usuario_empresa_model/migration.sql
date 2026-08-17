-- Formalizes the "usuario_empresas" table as a tracked Prisma model.
-- This table previously existed only as an ad hoc addition applied directly
-- against the production database (never captured by a migration), which the
-- raw SQL in src/app/api/users/route.ts depended on. Idempotent: safe to run
-- whether or not the table already exists in this environment.

CREATE TABLE IF NOT EXISTS "usuario_empresas" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "empresa" "Empresa" NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usuario_empresas_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuario_empresas_usuario_id_empresa_key'
  ) THEN
    ALTER TABLE "usuario_empresas"
      ADD CONSTRAINT "usuario_empresas_usuario_id_empresa_key" UNIQUE ("usuario_id", "empresa");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuario_empresas_usuario_id_fkey'
  ) THEN
    ALTER TABLE "usuario_empresas"
      ADD CONSTRAINT "usuario_empresas_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "usuario_empresas_usuario_id_idx" ON "usuario_empresas"("usuario_id");
