# Relatório de remediação e reauditoria — MeMude Connect

**Data:** 30 de julho de 2026
**Projeto:** `memude-core` / MeMude Connect
**Supabase:** `sistema-memude` (`oxybasvtphosdmlmrfnb`)
**Auditoria de origem:** `AUDITORIA_PRONTIDAO_PRODUCAO_2026-07-29.md`

## 1. Conclusão executiva

Os bloqueadores de segurança e integridade encontrados na auditoria foram
corrigidos no código e no Supabase remoto. O workspace passou por duas rodadas
de revisão, testes automatizados, build de produção, testes reais das Edge
Functions e validações do banco remoto.

O erro que iniciou a investigação — `WEBHOOK_SECRET não configurado` ao
configurar automaticamente o webhook Evolution V2 — está resolvido. Uma
invocação online, autenticada pelo segredo interno armazenado no Vault,
respondeu HTTP `200`, `success: true` e retornou a URL do webhook.

### Parecer por ambiente

| Ambiente | Parecer | Fundamentação |
|---|---|---|
| Supabase remoto | **GO técnico** | Migrações aplicadas, 46/46 Functions ativas, endpoints sensíveis protegidos e filas sem itens travados |
| Workspace local | **GO técnico** | Typecheck, lint, segredos, 66 testes, build, E2E público e auditoria aplicável aprovados |
| Frontend atualmente online | **GO condicionado / ainda não liberar teste oficial** | As alterações locais ainda precisam ser versionadas e publicadas |
| Teste oficial com usuários reais | **Condicionado** | Requer proteção contra senhas vazadas e E2E autenticado em staging |

Dos 36 achados originais, 29 foram encerrados tecnicamente e 7 ficaram
condicionados a publicação, configuração externa, staging ou evolução
arquitetural de médio prazo. Não permanece bloqueador de código conhecido no
workspace ou no backend implantado.

## 2. Resultado dos 36 achados

| ID | Estado | Implementação e evidência |
|---|---|---|
| SEC-001 | **Resolvido** | RPCs destrutivas de visitas agora autorizam explicitamente o ator; parâmetros sombreados foram corrigidos; grants indevidos foram revogados |
| SEC-002 | **Resolvido** | Senders WhatsApp de baixo nível foram restritos a admin ou chamada interna; frontend não envia mais destino/conteúdo arbitrários |
| SEC-003 | **Resolvido** | `send-lead-to-crm` valida admin/interno e deriva os dados sensíveis no servidor |
| STO-001 | **Resolvido** | Bucket `comprovantes` privado, limite de 10 MiB, MIME restrito a PDF/JPEG/PNG e URLs assinadas |
| DEP-001 | **Condicionado à publicação** | Dependências atualizadas; as duas altas restantes do advisory de React Router não se aplicam a esta SPA sem React Server Components e possuem exceção rastreável com validade |
| REL-001 | **Condicionado à publicação** | Migrações reconciliadas e backend implantado; falta transformar o workspace revisado em commit/release do frontend |
| SEC-004 | **Resolvido** | Papel removido de `profiles`; autorização usa exclusivamente `user_roles`; fallback inseguro removido |
| SEC-005 | **Resolvido** | Logger estruturado exige admin/interno e sanitiza campos sensíveis |
| SEC-006 | **Resolvido** | Impressão de relatório deixou de injetar HTML em nova janela; impressão usa árvore React já renderizada |
| SEC-007 | **Resolvido** | Segredos históricos foram removidos das migrações correntes, placeholders documentados e varredura automatizada adicionada |
| SEC-008 | **Resolvido localmente** | CSP e headers de segurança adicionados ao `vercel.json`; entram em vigor com a publicação |
| AUTH-001 | **Configuração externa pendente** | Proteção contra senhas vazadas precisa ser habilitada no painel do Supabase Auth; a sessão disponível não estava autenticada no painel |
| AUTH-002 | **Resolvido** | Recuperação e redefinição de senha adicionadas, resposta não enumerável e mínimo de 12 caracteres |
| QUA-001 | **Resolvido** | Typecheck completo aprovado |
| QUA-002 | **Resolvido** | ESLint aprovado com zero erros e zero avisos |
| TST-001 | **Parcial** | CI, quality gate, smoke E2E e suíte autenticada foram criados; execução autenticada depende das credenciais sintéticas de staging |
| OPS-001 | **Resolvido** | Filas antigas foram encerradas; filas de leads, visitas e mensagens estão com zero itens ativos ou travados há mais de 24 h |
| OPS-002 | **Resolvido** | Limpeza WordPress passou a excluir dependências antes do log; execução manual aprovada e registros antigos zerados |
| PRI-001 | **Resolvido** | Payloads históricos foram redigidos, novos logs são sanitizados e a retenção técnica passou a 30 dias |
| DB-001 | **Parcial / backlog** | Alertas críticos de helper `SECURITY DEFINER` foram eliminados. Restam 67 avisos de descoberta GraphQL coerentes com a SPA + RLS, 1 configuração de Auth e 426 alertas de performance de baixa/média prioridade |
| EDGE-001 | **Resolvido por autenticação própria** | Functions públicas de webhook/cron mantêm `verify_jwt=false` somente quando validam segredo, assinatura ou cabeçalho interno; endpoints sensíveis rejeitaram chamadas anônimas |
| EDGE-002 | **Resolvido** | CORS restrito ao domínio oficial e leitura JSON limitada a 1 MiB; varredura encontrou zero CORS curinga e zero `req.json()` sem limite |
| EDGE-003 | **Resolvido** | Imports de `supabase-js` fixados em `2.57.4`; varredura encontrou zero import não fixado |
| OBS-001 | **Resolvido** | `TEST_CONNECTION` é contabilizado como sucesso nos webhooks Evolution e WAHA |
| FE-001 | **Resolvido** | Consultas diretas `select('*')` eliminadas e resultados de telas críticas limitados |
| FE-002 | **Resolvido** | Consultas relevantes recebem `AbortSignal` do TanStack Query |
| FE-003 | **Parcial** | Cache imutável configurado e chunk de Configurações caiu para 117,77 kB; chunk de gráficos ainda tem 432,79 kB e deve ser otimizado após estabilização |
| FE-004 | **Resolvido** | Logs de perfil e PII removidos do console do frontend |
| DEP-002 | **Resolvido** | Auditoria de dependências valida explicitamente a ausência de RSC, advisory, responsável e prazo da exceção |
| DEP-003 | **Resolvido** | `browserslist` e `caniuse-lite` atualizados |
| GOV-001 | **Resolvido** | `SECURITY.md` descreve os controles reais e deixou de declarar certificação incompatível |
| UX-001 | **Resolvido** | Documento publicado marcado como `pt-BR` |
| SEO-001 | **Resolvido** | Metadados e imagem social apontam para ativos existentes |
| SEO-002 | **Resolvido** | Portal interno marcado como `noindex`, `noarchive` e `robots.txt` restritivo |
| UX-002 | **Resolvido** | Login permite mostrar/ocultar senha com nome acessível |
| GOV-002 | **Parcial** | Suíte autenticada e contrato de credenciais sintéticas foram criados; ainda falta provisionar o ambiente de staging e seus usuários |

## 3. Alterações implementadas

### 3.1 Banco, RLS, papéis e Storage

- autorização destrutiva de visitas corrigida;
- `user_roles` transformada na única fonte de papéis;
- coluna legada `profiles.role` removida;
- wrappers públicos de autorização passaram a `SECURITY INVOKER`;
- helpers privilegiados movidos para schema privado;
- probing de autorização de outro usuário bloqueado;
- bucket financeiro privado e validado;
- chave Evolution legada removida;
- filas de visitas antigas marcadas como falha;
- retenção e redação de logs técnicos implantadas;
- limpeza WordPress corrigida na ordem das chaves estrangeiras;
- migrações locais reconciliadas com as versões do histórico remoto.

Migrações de remediação aplicadas:

- `20260730004820_remediate_production_audit_blockers`
- `20260730011800_rotate_exposed_legacy_evolution_key`
- `20260730012116_remove_legacy_profile_roles`
- `20260730012915_enforce_technical_log_privacy_and_retention`
- `20260730014653_hide_rls_helpers_and_finish_cron_cleanup`
- `20260730014853_restore_safe_role_rpc`

### 3.2 Edge Functions e integrações

- 46 Edge Functions republicadas a partir do código revisado;
- CORS centralizado e restrito a `https://core.memudecore.com.br`;
- corpo JSON limitado a 1 MiB;
- autenticação padronizada para admin, interna, webhook ou assinatura;
- webhooks Evolution/WAHA com segredo e logs sanitizados;
- criação de usuário convertida para convite, sem senha previsível;
- endpoint legado `create-admin` desativado com resposta `410`;
- comprovantes servidos somente por URL assinada;
- `send-visit-reminder` e `send-lead-to-crm` derivam dados no servidor;
- configurador automático Evolution aceita chamada administrativa ou interna.

### 3.3 Frontend

- fluxo completo de recuperação de senha;
- eliminação do fallback de papel;
- correção de XSS na impressão;
- upload privado de comprovantes;
- remoção de logs de PII;
- consultas explícitas, limitadas e canceláveis;
- headers, CSP, `noindex`, idioma e metadados corrigidos;
- otimização do chunk de Configurações;
- controles de UX e acessibilidade no login;
- exportação XLSX testada;
- automações demonstrativas desabilitadas quando não possuíam backend real.

### 3.4 Qualidade, testes e CI

- gate `npm run check`;
- typecheck separado do build Vite;
- ESLint com `--max-warnings 0`;
- scanner de segredos;
- auditoria de advisories aplicáveis;
- testes unitários independentes de ordem;
- teste específico do artefato após build;
- Playwright para login, proteção de rota e 404;
- suíte Playwright autenticada preparada para staging;
- workflow de CI com build, testes, navegador, scanner e SBOM.

## 4. Evidências da segunda revisão

### 4.1 Workspace

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado, zero avisos |
| `npm run scan:secrets` | Aprovado |
| Vitest unitário | 38/38 |
| Vitest do build/rotas | 28/28 |
| Total Vitest | 66/66 |
| Build Vite produção | Aprovado |
| Playwright smoke | 3/3 |
| Auditoria aplicável | Aprovada |
| `git diff --check` | Aprovado após correção de whitespace |

### 4.2 Supabase remoto

| Verificação | Resultado |
|---|---|
| Edge Functions | 46 ativas de 46 |
| Configuração automática Evolution | HTTP 200 e `success: true` |
| Endpoints sensíveis sem credenciais | 401 em todos os nove casos rechecados |
| CORS com origem maliciosa | Resposta permite somente o domínio oficial |
| Filas de lead, visita e mensagem | 0 ativas; 0 travadas há mais de 24 h |
| Bucket `comprovantes` | Privado; 10 MiB; PDF/JPEG/PNG |
| Coluna `profiles.role` | Ausente |
| Helpers públicos `SECURITY DEFINER` auditados | 0 |
| Limpeza WordPress corrigida | Execução manual aprovada; 0 logs antigos residuais |
| Limpeza de logs técnicos | Execução manual aprovada |

### 4.3 Advisors

O Security Advisor passou de 75 alertas para 68 avisos:

- 67 avisos `pg_graphql_authenticated_table_exposed`;
- 1 aviso `auth_leaked_password_protection`.

Os 67 avisos de GraphQL indicam que tabelas consultadas diretamente pela SPA
podem ser descobertas por usuários autenticados. A autorização de linhas
continua sendo feita por RLS. Revogar todos esses grants agora quebraria a
arquitetura de acesso direto do frontend; a redução exige migrar gradualmente
domínios sensíveis para RPCs/Edge Functions.

O Performance Advisor possui:

- 163 índices ainda não usados;
- 263 ocorrências de políticas permissivas sobrepostas.

Esses itens são backlog de performance. Índices não devem ser removidos sem
telemetria de produção, e políticas sobrepostas devem ser consolidadas por
tabela com testes de autorização antes de qualquer alteração.

## 5. Pendências obrigatórias antes do teste oficial

1. Habilitar **Leaked Password Protection** em Supabase Dashboard → Auth →
   Password Security.
2. Criar staging reproduzível e usuários sintéticos `admin`, `corretor` e
   `cliente`.
3. Configurar `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD` somente no secret store
   do CI de staging.
4. Executar `npm run test:e2e:authenticated`.
5. Versionar e publicar o frontend revisado.
6. Executar smoke pós-deploy em `/auth`, `/configuracoes`, CRM, visitas, vendas
   e configuração automática Evolution.
7. Observar por pelo menos um ciclo os jobs
   `cleanup-old-sync-logs` e `cleanup-old-technical-logs`; as funções corrigidas
   passaram manualmente, mas a próxima execução agendada ainda não ocorreu.

## 6. Plano de evolução após estabilização

### P1 — primeiras duas semanas

- staging isolado com dados sintéticos;
- E2E autenticado por papel e fluxos críticos;
- Sentry/OpenTelemetry no navegador sem PII;
- alertas de fila, webhook, cron e taxa de erro;
- teste de restauração de backup;
- runbooks de incidentes para WhatsApp, Auth e distribuição.

### P2 — 30 a 60 dias

- substituir acesso direto às tabelas mais sensíveis por APIs/RPCs orientadas a
  domínio;
- consolidar políticas RLS permissivas sobrepostas;
- medir uso de índices antes de remover redundâncias;
- virtualizar listas grandes;
- carregar gráficos por demanda e reduzir o chunk `charts`;
- testes de contrato para Evolution, WAHA, WordPress e CRM;
- testes de carga em filas e webhooks.

### P3 — excelência contínua

- SLOs por fluxo de negócio;
- canary release e rollback automatizado;
- gestão de consentimento e opt-out de WhatsApp;
- trilha imutável de auditoria administrativa;
- análise periódica de LGPD, retenção e minimização;
- chaos testing das integrações;
- revisão trimestral de ameaças, dependências e permissões.

## 7. Critério final de liberação

O teste oficial pode ser liberado quando todos os itens da seção 5 estiverem
concluídos e o smoke pós-deploy for aprovado. Até lá, o estado correto é:

> **backend e workspace tecnicamente aprovados; release de produção
> condicionada aos gates externos e à publicação.**
