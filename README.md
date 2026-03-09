# Sistema Interno de Tickets de Reclamação (Marketplace)

<<<<<<< HEAD
## Stack
- Next.js + React + TypeScript
- PostgreSQL + Prisma ORM
- Supabase Auth (sessão real)
- Deploy compatível com Render (`output: standalone`)

## Arquitetura
- `src/app`: páginas e rotas API (App Router)
- `src/lib`: autenticação, RBAC, auditoria, validação, serviços, erros e logging
- `src/components`: UI por domínio (auth, dashboard, tickets, admin)
- `prisma`: schema, migrations e seed

## Segurança e autenticação
- Sessão real via Supabase (`createServerComponentClient`, `createRouteHandlerClient`, `createMiddlewareClient`).
- Middleware protege páginas e APIs sem sessão.
- Sem fallback de admin automático.
- Usuário precisa estar provisionado na tabela `Usuario` e ativo.

## Autorização
- RBAC por perfil (`ATENDENTE`, `SUPERVISOR`, `ADMIN`).
- Bloqueio de campos sensíveis no PATCH de tickets para perfis sem `ticket.update_sensitive`.
- Escopo de dados por perfil (`ATENDENTE` restrito a tickets próprios/responsável).
- Exportações e relatórios protegidos por permissões.

## Auditoria
- CREATE / UPDATE / STATUS_CHANGE / SOFT_DELETE por ticket.
- Registro por campo alterado com valor antigo/novo, usuário e timestamp.

## Banco e migrations
- `Usuario`, `Ticket`, `TicketAuditoria`
- Enums fechados de domínio
- Campos calculados persistidos: `mesReclamacao`, `anoReclamacao`, `slaStatus`
- FK de responsável (`Ticket.responsavelId -> Usuario.id`)

## Setup local
1. `cp .env.example .env`
2. Configure variáveis de Supabase e PostgreSQL
3. `npm install`
4. `npm run prisma:generate`
5. `npm run prisma:migrate:dev`
6. `npm run prisma:seed`
7. `npm run dev`

## Variáveis de ambiente
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`

## Deploy no Render
### Web Service
- Build: `npm install && npm run build`
- Start: `npm run start`
- Runtime: Node 20+

### Banco
- Render PostgreSQL
- Executar migrations: `npm run prisma:migrate`
- Seed opcional: `npm run prisma:seed`

## Checklist de prontidão para Render
- [ ] Variáveis de ambiente configuradas por ambiente (dev/homolog/prod)
- [ ] Serviço Supabase Auth configurado com provedores/senha
- [ ] Usuários provisionados na tabela `Usuario` com `authUserId` válido
- [ ] Migrations aplicadas no banco de produção
- [ ] Health check de login + CRUD + exportações validado
- [ ] Política de backup e retenção de banco definida
- [ ] Alertas de erro/logging conectados no ambiente de produção
=======
## Ajustes técnicos da stack (justificativa)
A stack solicitada foi mantida (Next.js + React + PostgreSQL + Supabase Auth + TypeScript). Foi adicionado **Prisma ORM** como camada de acesso ao banco para garantir:
- migrações versionadas e rastreáveis
- tipagem de ponta a ponta
- manutenção e escalabilidade de queries complexas
- padronização para ambiente Render (build + migrate)

## Fase 1 — Proposta de arquitetura
Arquitetura modular em camadas:
1. **App/UI (Next.js App Router)**: telas administrativas e componentes reutilizáveis.
2. **API Layer (`src/app/api`)**: rotas HTTP seguras e tipadas.
3. **Domínio/Serviços (`src/lib/services`, `src/modules`)**: regras de negócio, validações, auditoria, RBAC.
4. **Persistência (`prisma`)**: schema relacional, migrations e seeds.
5. **Auth/Permissões (`src/lib/auth`, `src/lib/rbac`)**: sessão, escopo e autorização por perfil.

## Fase 2 — Estrutura de pastas
```txt
src/
  app/
    (auth)/login
    dashboard
    tickets
    reports
    users
    admin
    api/
  components/
  lib/
    auth db rbac audit services validation utils
  modules/
prisma/
  migrations/
  schema.prisma
  seed.ts
scripts/
tests/
```

## Fase 3 — Modelo relacional
- `Usuario`: perfil (ATENDENTE, SUPERVISOR, ADMIN), ativo, vínculo com auth.
- `Ticket`: dados de cliente/pedido/reclamação/financeiro/prazo/responsável + soft delete.
- `TicketAuditoria`: log por campo alterado, ação, usuário e timestamp.
- Índices para filtros recorrentes (marketplace, empresa, status, data e responsável).

## Fase 4 — Estratégia de autenticação/autorização
- Autenticação: preparada para Supabase Auth (JWT + sessão), com fallback local por header para desenvolvimento.
- Autorização: RBAC por `perfil` com matriz de permissões centralizada.
- Middleware bloqueia acessos sem sessão.

## Fase 5 — Estratégia de auditoria
- Criação, edição, soft delete e mudança de status geram trilha de auditoria.
- Diferença por campo (`valor_antigo` x `valor_novo`) com usuário e data/hora.
- Histórico recuperável por ticket.

## Fase 6 — Plano de implementação por fases
1. Setup base e padrões.
2. Modelo de dados, migrations, seed.
3. Auth + RBAC + middleware.
4. APIs de tickets e auditoria.
5. UI administrativa (dashboard, lista, detalhe, criar/editar, kanban, relatórios, usuários, admin).
6. Exportação CSV/XLSX.
7. Hardening para produção e deploy Render.

## Funcionalidades já entregues nesta base
- CRUD de tickets (com soft delete)
- Auditoria de alterações
- Dashboard com cards principais
- Listagem com paginação básica + busca
- Telas obrigatórias iniciais
- Exportação CSV e XLSX
- Administração básica de usuários
- Seeds e migrations

## Setup local
1. `cp .env.example .env`
2. Configurar variáveis do Supabase e PostgreSQL.
3. `npm install`
4. `npm run setup`
5. `npm run dev`

## Deploy no Render
### Serviço web
- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Environment:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_BASE_URL`

### Banco
- Criar PostgreSQL no Render.
- Aplicar migrations via Job/Command: `npm run prisma:migrate`.
- Popular seed opcional: `npm run prisma:seed`.

## Ambientes (dev/homolog/prod)
- `.env` para dev local
- variáveis por Environment no Render
- migrations idempotentes em pipeline
- `output: standalone` para container de produção

## Segurança e manutenção
- Princípio do menor privilégio (RBAC)
- Soft delete em registros críticos
- Auditoria completa por campo
- Validação de payload com Zod
- Tipagem estrita TypeScript
- Separação clara de camadas para evolução
>>>>>>> origin/main
