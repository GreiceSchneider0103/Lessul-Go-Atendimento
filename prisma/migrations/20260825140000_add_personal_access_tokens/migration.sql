-- Personal access tokens for out-of-browser integrations (e.g. the planned
-- order-import browser extension), since the normal Supabase session cookie
-- is cross-site from an extension's context and never gets sent.
CREATE TABLE "personal_access_tokens" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_access_tokens_token_hash_key" ON "personal_access_tokens"("token_hash");
CREATE INDEX "personal_access_tokens_usuario_id_idx" ON "personal_access_tokens"("usuario_id");

ALTER TABLE "personal_access_tokens"
  ADD CONSTRAINT "personal_access_tokens_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
