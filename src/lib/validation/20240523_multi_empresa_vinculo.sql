-- migration: 20240523_multi_empresa_vinculo.sql

-- 1. Criar a tabela intermediária para relacionamento Muitos-para-Muitos
CREATE TABLE IF NOT EXISTS "usuario_empresas" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "usuario_id" TEXT NOT NULL, -- Corrigido para TEXT
    "empresa" "Empresa" NOT NULL, -- Usando o enum existente
    "role" TEXT DEFAULT 'MEMBER', -- Reservado para permissões específicas por empresa no futuro
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_empresas_usuario_id_fkey" FOREIGN KEY ("usuario_id")
        REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE -- Corrigido para "Usuario" e TEXT
);

-- 2. Unique constraint para evitar duplicidade de vínculo.
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_empresas_usuario_id_empresa_key"
    ON "usuario_empresas"("usuario_id", "empresa");

-- 3. Índices para performance em filtros e joins
CREATE INDEX IF NOT EXISTS "usuario_empresas_usuario_id_idx" ON "usuario_empresas"("usuario_id");
CREATE INDEX IF NOT EXISTS "usuario_empresas_empresa_idx" ON "usuario_empresas"("empresa");

-- 4. Migração de dados: Preservar vínculos atuais
INSERT INTO "usuario_empresas" (usuario_id, empresa)
SELECT id, "empresaVinculada"
FROM "Usuario" -- Corrigido para "Usuario"
WHERE "empresaVinculada" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Nota: O campo 'empresaVinculada' em 'Usuario' deve permanecer (nullable) por enquanto
-- para evitar quebra de código legado que ainda não foi atualizado.
-- Se o campo 'empresaVinculada' não for nullable, ele precisará ser alterado para nullable
-- Exemplo: ALTER TABLE "Usuario" ALTER COLUMN "empresaVinculada" DROP NOT NULL;