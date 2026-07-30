# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

MeMude Connect (a.k.a. ImobIA / `memude-core`) — a real-estate CRM SaaS for property sales teams. It manages leads, visits (`visitas`), sales (`vendas`), brokers (`corretores`), and developments (`empreendimentos`), and layers on automated lead/visit distribution, WhatsApp AI sales agents, a CRM kanban pipeline, reporting/analytics, and WordPress property sync.

The UI and all user-facing strings are in **Brazilian Portuguese**; code identifiers and comments are mostly English but domain nouns stay Portuguese (`lead`, `visita`, `venda`, `corretor`, `empreendimento`). The app was originally scaffolded with Lovable (hence `lovable-tagger` as a dev-only Vite plugin and the Lovable links in `README.md`).

## Commands

Package manager is **npm** (a stale `bun.lockb` is also present — ignore it; `package-lock.json` is authoritative).

- `npm run dev` — Vite dev server on **port 8080** (host `::`)
- `npm run build` — production build; `npm run build:dev` builds in development mode
- `npm run preview` — serve the production build locally
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run test` — Vitest, single run over `src/**/*.test.ts`
- `npx vitest run src/utils/formatters.test.ts` — run one test file
- `npx vitest run -t "formats phone"` — run tests matching a name; `npx vitest` (no args) for watch mode
- `npx tsc -p tsconfig.app.json --noEmit` — typecheck (there is no `typecheck` npm script, and `vite build` uses SWC so it does **not** typecheck)

Note `tsconfig` is intentionally lenient: `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`, and `noUnusedParameters` are all off. Don't assume strict-mode guarantees.

### Supabase (backend) — uses the Supabase CLI

Project ref: `oxybasvtphosdmlmrfnb`. Edge Functions are Deno, migrations are SQL.

- `supabase db push` — apply migrations in `supabase/migrations/`
- `supabase functions deploy <name>` — deploy one Edge Function
- `supabase functions serve <name>` — run a function locally
- `supabase gen types typescript --linked > src/integrations/supabase/types.ts` — regenerate DB types after a schema change

Migrations named `*_remote_sync.sql` are auto-generated pulls from the remote DB; the hand-written ones carry descriptive names. There is no Deno `import_map.json` — Edge Functions import dependencies directly by URL (`deno.land/std`, `esm.sh`).

## Architecture

### Frontend shape

Single-page app. `src/main.tsx` → `src/App.tsx` wires the global providers in this order: `ErrorBoundary` → `QueryClientProvider` (TanStack Query) → `AuthProvider` → `TooltipProvider` → `BrowserRouter`. Every page is `React.lazy`-loaded. The `@/` path alias maps to `src/` (configured in both `vite.config.ts` and the tsconfigs).

Data access is direct `supabase-js` calls wrapped in TanStack Query — there is no separate API/service layer. Forms use `react-hook-form` + `zod` (schemas live in `src/lib/validations.ts`). Charts use `recharts`. UI is shadcn/ui (Radix primitives) in `src/components/ui`; feature components are grouped by domain under `src/components/*` (e.g. `crm`, `ai-agents`, `automation`, `reports`). Toasts come from two systems that coexist: shadcn `Toaster` and `sonner`.

### Auth and roles (read before touching anything access-related)

Three roles exist: `admin`, `corretor`, `cliente`. Routing is role-gated by `src/components/auth/ProtectedRoute` (`requireAdmin` / `requireCorretor`), and pages are split into `src/pages/admin/*` and `src/pages/corretor/*`.

**Roles are stored in a separate `user_roles` table, never on `profiles`.** This is a deliberate security design (storing the role on `profiles` would let a user escalate privileges with a self-`UPDATE`). The DB exposes a `has_role(user_id, role)` `SECURITY DEFINER` function, and RLS policies are written in terms of it. On the frontend, `src/hooks/useAuth.tsx` reads the role from `user_roles` (falling back to `profiles.role` only if that query fails) and exposes `isAdmin` / `isCorretor`. When adding role checks anywhere (RLS, Edge Function, UI), follow the same pattern. See `SECURITY.md` for the full RBAC/RLS conventions.

### Supabase client and generated files

`src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` are **generated — do not hand-edit**. The client hardcodes the project URL and the *publishable* (anon) key; this is expected, not a leaked secret. `types.ts` is the source of truth for the ~60 tables (e.g. `leads`, `visitas`, `vendas`, `corretores`, `empreendimentos`, `crm_*`, `ai_agents`, `agent_*`, `distribution_*`, `evolution_instances`, `wp_*`).

### Edge Functions and core backend flows

Backend logic lives in `supabase/functions/*` (each is a Deno `index.ts`), with reusable modules in `supabase/functions/_shared/`. Many functions set `verify_jwt = false` in `supabase/config.toml` — these are webhooks, cron targets, or functions that perform **their own** auth. Per `SECURITY.md`, any function that mutates or reads sensitive data must still validate the `Authorization` header and the caller's role manually (template in `SECURITY.md` §3.2), and must use the service-role vs anon key deliberately.

The major cross-file flows:

- **Lead/visit distribution** — the assignment engine is `_shared/distribution-logic.ts`, driven by `distribute-lead` / `distribute-visit`, the `*-timeout-checker` functions, and the `distribution_queue` / `visit_distribution_queue` tables. It assigns leads/visits to brokers with scoring and timeout-based reassignment.
- **AI WhatsApp agents** — `ai-agent-processor` is the orchestrator. It supports multiple LLM providers (OpenAI, Gemini, Anthropic) and composes the `_shared` modules: `intent-detector`, `context-builder`, `bant-scorer` (BANT qualification), `objection-handler`, `human-handoff`, and `cache-manager`. Conversation state lives in the `agent_*` / `ai_*` tables. `ai-generate-embeddings` + `ai-property-search` provide semantic property search via `property_embeddings`.
- **WhatsApp transport** — two providers: Evolution API (`evolution-*`) and WAHA (`waha-*`), unified by `universal-whatsapp-sender` and a `message_queue`.
- **CRM pipeline** — `src/hooks/useCrmPipeline.tsx` + `src/components/crm` over the `crm_pipelines` / `crm_stages` / `crm_leads` / `crm_automations` tables.
- **Reporting** — `Relatorios`/`Analytics` pages backed by `calculate-metrics`, `export-reports`, and `schedule-reports`.
- **WordPress sync** — `sync-wordpress-properties` populates `empreendimentos` / `wp_*` cache tables.

### Shared frontend utilities

`src/lib/` holds cross-cutting helpers: `validations.ts` (zod), `utils.ts` (`cn`, etc.), `retryLogic.ts`. `src/utils/` holds `formatters`, `dateHelpers`, `phoneHelpers` (all with `.test.ts` coverage — the only unit-tested layer). `src/e2e/routes.test.ts` smoke-tests the route table.

## Deployment

Deployed on **Vercel** as an SPA — `vercel.json` rewrites all paths to `/index.html`. The Vite build defines manual vendor chunks (`vendor`, `ui`, `query`, `supabase`, `charts`, `utils`) in `vite.config.ts`; keep large new dependencies in mind relative to that chunking.

## Repo notes

- `.agent/` is a generic, dropped-in "Antigravity Kit" agent framework (its `rules/GEMINI.md`, `agents/`, `skills/`, `workflows/`) — it is **not** this project's engineering conventions or build tooling. Don't treat its rules as project requirements.
- `docs/` contains design/ops references worth consulting for specific subsystems: `WHATSAPP_MESSAGING.md`, `WHATSAPP_BUTTONS.md`, `MONITORING.md` / `MONITORING_QUERIES.md`, `MIGRATION_V2.md`, `TESTING_PLAN.md`, `SECURITY_AUDIT_REPORT.md`.
- Root-level `eslint-*.json/txt`, `tsc-errors.txt`, `evo-lint.json`, and `scratch/` are throwaway analysis artifacts, not part of the app.
