-- Data migration: promote the account requested as the sole initial MASTER user.
-- Safe no-op if the user does not exist yet in this environment.
UPDATE "Usuario" SET perfil = 'MASTER' WHERE email = 'atendimento@lessul.com.br';
