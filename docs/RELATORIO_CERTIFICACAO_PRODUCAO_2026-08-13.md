# Relatório de certificação de produção — MeMude Connect

**Data da auditoria:** 13 de agosto de 2026
**Projeto Supabase:** `sistema-memude` (`oxybasvtphosdmlmrfnb`)
**Aplicação pública:** `https://core.memudecore.com.br`
**Veredito atual:** **GO CONDICIONAL / ainda não liberar para usuários externos**

O código, o build e o backend corrigido passaram por todos os testes automatizados disponíveis. A liberação oficial permanece condicionada aos quatro gates operacionais da seção “Pendências impeditivas”: E2E autenticado com contas sintéticas dos três papéis, ativação de proteção contra senhas vazadas, ensaio de restauração/rollback e publicação do frontend com confirmação de paridade de commit.

## 1. Escopo e método

A auditoria percorreu integralmente o conteúdo legível do repositório, excluindo apenas dependências, artefatos de build, metadados Git e temporários. O passe de leitura contabilizou:

- 474 arquivos auditáveis;
- 469 arquivos textuais, 92.759 linhas e aproximadamente 11,27 MB;
- 25 rotas declaradas, incluindo dois aliases e a rota 404;
- 21 páginas, 122 componentes de aplicação e 47 Edge Functions;
- 165 migrações remotas antes das três migrações corretivas desta auditoria;
- 1.159 controles de interface alcançáveis — botões, links, formulários, inputs, seletores, switches, abas e itens de menu.

O inventário estruturado está em [production-ui-inventory.json](./production-ui-inventory.json). O checklist operacional, com origem de arquivo/linha e critério de aceite de cada controle, está em [CHECKLIST_CERTIFICACAO_PRODUCAO_2026-08-13.md](./CHECKLIST_CERTIFICACAO_PRODUCAO_2026-08-13.md).

O ciclo aplicado a cada achado foi: reproduzir ou provar por inspeção → identificar causa-raiz → definir correção → implementar → executar validações focadas → executar novamente a suíte completa.

## 2. Mapa completo de páginas

| Rota | Papel | Arquivos alcançados | Controles inventariados | Situação desta rodada |
|---|---:|---:|---:|---|
| `/auth` | público | 2 | 6 | smoke E2E aprovado; mutações reais não executadas |
| `/reset-password` | público | 1 | 6 | inventariada; fluxo de e-mail requer ensaio controlado |
| `/unauthorized` | público | 2 | 4 | rota e renderização cobertas estaticamente |
| `/` | autenticado | 9 | 84 | inventariada; E2E autenticado bloqueado |
| `/admin/users` | admin | 6 | 119 | inventariada; E2E autenticado bloqueado |
| `/leads` | admin | 7 | 45 | RBAC corrigido; inventariada; E2E autenticado bloqueado |
| `/crm` | admin | 12 | 63 | edição/criação/totalização corrigidas; E2E bloqueado |
| `/corretores` | admin | 7 | 68 | cadastro e regras de perfil corrigidos; E2E bloqueado |
| `/empreendimentos` | admin | 5 | 30 | inventariada; E2E autenticado bloqueado |
| `/visitas` | admin | 11 | 94 | RBAC e distribuição corrigidos; E2E bloqueado |
| `/vendas` | admin | 5 | 47 | upload e descarte corrigidos; E2E bloqueado |
| `/comunicacoes` | admin | 13 | 101 | envio/reenvio reais corrigidos; E2E bloqueado |
| `/relatorios` | admin | 8 | 75 | exportação e edição corrigidas; E2E bloqueado |
| `/sincronizacao-wordpress` | admin | 6 | 23 | inventariada; integração externa requer cenário de staging |
| `/configuracoes` | admin | 14 | 115 | backup honesto e Evolution inventariados; E2E bloqueado |
| `/admin/analytics` | admin | 4 | 10 | inventariada; E2E autenticado bloqueado |
| `/admin/monitoring` | admin | 4 | 10 | inventariada; backend/cron verificados |
| `/admin/ai-agents` | admin | 11 | 119 | inventariada; provedores externos não exercitados |
| `/meus-leads` | corretor | 4 | 15 | telefone/WhatsApp corrigidos; E2E corretor bloqueado |
| `/minhas-visitas` | corretor | 9 | 86 | inventariada; E2E corretor bloqueado |
| `/minhas-comissoes` | corretor | 4 | 13 | inventariada; E2E corretor bloqueado |
| `/perfil` | autenticado | 4 | 24 | autocadastro seguro corrigido; E2E cliente bloqueado |
| `/ai-agents` | alias admin | 0 | 0 | redireciona a `/admin/ai-agents` |
| `/ai-agentes` | alias admin | 0 | 0 | redireciona a `/admin/ai-agents` |
| `*` | público | 1 | 2 | E2E 404 aprovado sem erro de console |

## 3. Evidências de aprovação

### REL-001 — qualidade estática

- TypeScript (`tsc --noEmit`): aprovado;
- ESLint com zero warnings: aprovado;
- scanner de segredos: aprovado;
- auditoria automática de UI sobre 114 arquivos: aprovada, sem simulações ou botões inertes detectáveis;
- parser de todas as rotas e inventário de controles: aprovado.

### REL-002 — testes

- Vitest: 43/43 testes aprovados em 8 arquivos;
- testes estruturais de rotas: 28/28 aprovados;
- Playwright público: 3/3 aprovados — login, proteção de rota administrativa e 404;
- auditoria focal de distribuição: aprovada, incluindo IDs `accept_lead`, `reject_lead`, `accept_visit`, `reject_visit`, respostas com acento, negação e falsos positivos.

### REL-003 — build e dependências

- Vite produção: 3.392 módulos transformados, build concluído;
- auditoria de dependências: nenhuma vulnerabilidade alta ou crítica aplicável;
- `git diff --check`: sem erro de whitespace;
- bundle maior: `charts`, aproximadamente 432,79 kB bruto/110,19 kB gzip — aceitável, mas candidato a otimização posterior.

### REL-004 — smoke no domínio público

Uma sessão real do navegador interno, sem autenticação, confirmou diretamente em `https://core.memudecore.com.br`:

- `/auth` renderiza logo, e-mail, senha, exibição de senha, recuperação e login;
- `/configuracoes` redireciona o anônimo para `/auth` após a resolução da sessão;
- uma rota inexistente renderiza a página 404 e suas duas ações de retorno;
- zero `console.error` ou warning nos três cenários.

Não havia sessão autenticada disponível nesse navegador; nenhum dado pessoal ou credencial humana foi solicitado/inspecionado.

### DB-001 — banco remoto

As migrações `repair_lead_distribution_queue_integrity`, `harden_self_service_corretor_profile` e `harden_atomic_distribution_acceptance` foram aplicadas com sucesso pelo plugin Supabase. A divergência histórica de versão da migração financeira também foi reconciliada localmente com a versão remota `20260730155203`.

Pós-migração:

- tentativas de lead sem `queue_id`: 0;
- filas de lead ativas antigas: 0;
- filas de lead ativas: 0;
- filas de visita ativas: 0;
- duas filas antigas foram encerradas como `failed`, preservando motivo e `completed_at`;
- índice único parcial impede mais de uma fila ativa por lead;
- trigger de autocadastro de corretor e policy de `INSERT` autenticado estão ativos.

### SEC-001 — autorização no banco

- 83 tabelas públicas com RLS habilitado;
- `accept_lead_distribution` e `accept_visit_distribution` são transacionais, validam tentativa/corretor, travam a fila e só concedem `EXECUTE` ao `service_role`;
- `anon` e `authenticated` não executam esses RPCs;
- autocadastro força `em_avaliacao`, métricas zeradas e impede autoaprovação ou alteração de credenciais/métricas por usuário comum.

### SEC-002 — Edge Functions

Oito funções alteradas foram publicadas e ficaram `ACTIVE`: `distribute-lead`, `distribution-timeout-checker`, `distribution-webhook-handler`, `evolution-send-whatsapp-v2`, `monitor-visits`, `visit-distribution-timeout-checker`, `evolution-webhook-handler` e `waha-webhook-handler`.

Todas retornaram HTTP 401 para `POST` anônimo. Os logs confirmaram que as novas versões carregaram corretamente; os checkers invocados pelos crons retornaram 200 autenticados.

### OPS-001 — operação

- os 13 jobs cron consultados haviam executado com sucesso, sem falha nas últimas 24 horas;
- filas de distribuição, visita e mensagens sem itens presos no recorte auditado;
- chamadas anônimas não causaram mutação;
- não foi observado erro de importação ou inicialização nas versões recém-publicadas.

## 4. Achados corrigidos e plano executado

### F-001 — distribuição de lead criava tentativas órfãs — criticidade alta

**Causa:** tentativa inicial e retries não persistiam `queue_id`; rejeição usava uma sentinela `current_attempt = 99`, e falhas de número/envio não avançavam a fila.
**Risco:** filas eternamente `in_progress`, tentativas desconectadas e leads sem corretor.
**Ajuste:** associação obrigatória à fila, ação explícita `force_advance_lead_id`, avanço com compare-and-set, limite configurado, índice único e reparo dos registros antigos.
**Reteste:** auditoria focal aprovada; banco remoto zerado de órfãos/filas antigas; cron novo retornou 200.
**Status:** corrigido e publicado.

### F-002 — aceite não era atomicamente seguro e usava status inválido — alta

**Causa:** RPCs legados aceitavam tentativa incorreta, permitiam filas falhas e escreviam `em_contato`, inexistente no enum.
**Risco:** dois corretores vencerem a mesma oportunidade ou transação abortar após a resposta.
**Ajuste:** lock de tentativa/fila, validação de corretor e estados ativos, atualização integral em uma transação, cancelamento dos concorrentes e status válidos `corretor_designado`/`visita_agendada`.
**Reteste:** migração aplicada; assinatura, grants e definições consultadas remotamente; acesso restrito ao serviço.
**Status:** corrigido e publicado.

### F-003 — botões do WhatsApp não eram reconhecidos e texto podia gerar falso aceite — alta

**Causa:** botões enviavam IDs `accept_lead`/`reject_lead`, enquanto o webhook só procurava palavras; `includes('sim')` classificava “simplesmente” como aceite.
**Risco:** perda ou atribuição indevida de oportunidade.
**Ajuste:** analisador único, normalização de acentos/underscore, vocabulário exato, tokenização e precedência de negação.
**Reteste:** dez casos automatizados aprovados, incluindo botões, “NÃO”, “não posso”, “simplesmente depois” e “bom dia”.
**Status:** corrigido e publicado.

### F-004 — fallback de LID podia associar mensagem ao corretor errado — alta

**Causa:** na ausência de mapeamento LID, o fallback selecionava uma tentativa pendente global.
**Risco:** aceite/rejeição de lead de outro corretor.
**Ajuste:** fallback global removido; envio persiste mapeamentos `@lid` e `@s.whatsapp.net`; LID desconhecido não processa distribuição.
**Reteste:** regra proibitiva na auditoria de distribuição e versões Evolution/WAHA publicadas.
**Status:** corrigido e publicado.

### F-005 — autocadastro de corretor em `/perfil` era impossível e inseguro se liberado diretamente — alta

**Causa:** UI permitia candidatura, mas não havia policy de `INSERT`; update próprio era amplo.
**Risco:** erro de cadastro ou autoaprovação/alteração de métricas.
**Ajuste:** policy de candidatura própria, trigger com invariantes, status inicial `em_avaliacao` e métricas zero; UI alinhada ao enum remoto e tratamento de erro.
**Reteste:** policy/trigger confirmados no banco e suíte completa aprovada. O fluxo visual final ainda depende da conta sintética cliente.
**Status:** backend corrigido/publicado; E2E visual pendente.

### F-006 — CRM não carregava/retinha etapas e não criava o primeiro funil — alta

**Causa:** persistência parcial e modal de criação renderizado somente quando já existia `currentPipeline`.
**Risco:** salvar zerava etapas e organização comercial era perdida.
**Ajuste:** carregamento completo, salvamento atômico por RPC, modal independente da existência de funil, fechamento somente em sucesso e deduplicação por todos os leads do CRM.
**Reteste:** typecheck, lint, build e testes de rota aprovados; E2E de mutação aguarda conta admin sintética.
**Status:** código corrigido; publicação do frontend pendente.

### F-007 — colunas do funil não totalizavam o valor previsto — média

**Causa:** cabeçalho calculava apenas a quantidade.
**Ajuste:** soma determinística de `opportunity_value` por etapa, mantendo quantidade e moeda brasileira.
**Reteste:** build/typecheck aprovados; verificação visual autenticada pendente.
**Status:** código corrigido; publicação do frontend pendente.

### F-008 — comunicações e distribuição exibiam ações simuladas — alta

**Causa:** WhatsApp/reenvio/distribuição produziam feedback local ou dados fictícios; SMS/e-mail eram apresentados como disponíveis.
**Ajuste:** integração real com `evolution-send-whatsapp-v2`, reenvio real, métricas/configurações remotas, limite de lote; canais ainda não implementados ficam explicitamente indisponíveis.
**Reteste:** auditoria de UI sem marcadores de simulação, compilação e autenticação negativa da função aprovadas.
**Status:** código/backend corrigidos; frontend pendente de publicação.

### F-009 — rotas operacionais acessíveis a papel inadequado — alta

**Causa:** páginas administrativas usavam apenas autenticação genérica.
**Ajuste:** `/leads`, `/crm`, `/visitas`, `/comunicacoes` e `/relatorios` exigem admin; menu cliente separado; testes de rota fortalecidos.
**Reteste:** 28 testes de rota aprovados e smoke anônimo redireciona para login.
**Status:** código corrigido; teste negativo autenticado por papel ainda pendente.

### F-010 — exportação de distribuição perdia seções e campos — média

**Causa:** CSV exportava só tentativas e selects omitiam ordem/campos de comunicação; opção PDF não tinha implementação.
**Ajuste:** selects completos, nulos protegidos, CSV multi-arquivo empacotado em ZIP, opção PDF removida e falhas comunicadas.
**Reteste:** typecheck/lint/build aprovados.
**Status:** código corrigido; download autenticado pendente.

### F-011 — anexos de venda podiam ficar órfãos — média

**Causa:** fechar/cancelar modal após upload deixava arquivos sem registro; substituições não limpavam o original.
**Ajuste:** rastreamento por sessão, bloqueio de fechamento durante upload e limpeza de abandonados/substituídos após confirmação. Validação numérica também foi endurecida.
**Reteste:** typecheck/lint/build aprovados.
**Status:** código corrigido; teste com bucket privado e conta sintética pendente.

### F-012 — telefones de corretor podiam receber DDI duplicado — média

**Causa:** links concatenavam `55` sobre valores já normalizados.
**Ajuste:** uso central de `normalizePhoneNumber` e `noopener`.
**Reteste:** testes utilitários e build aprovados.
**Status:** código corrigido.

### F-013 — controles inertes e promessas falsas — média

**Causa:** filtros sem implementação, botão “Avaliar Lead em breve”, backup/restore fictício e edição de template sem ação.
**Ajuste:** controles inertes removidos, backup aponta ao painel real, edição de template implementada e histórico do dashboard navega corretamente.
**Reteste:** auditoria automática de 114 arquivos aprovada.
**Status:** código corrigido.

### F-014 — drift histórico de migração — média

**Causa:** mesmo conteúdo financeiro registrado local e remotamente com versões diferentes.
**Ajuste:** arquivo local alinhado à versão remota `20260730155203`; novas correções receberam versões monotônicas.
**Reteste:** migrations novas aplicadas pelo plugin.
**Status:** corrigido.

## 5. Pendências impeditivas para liberação oficial

### B-001 — E2E autenticado dos três papéis

Não há no ambiente as seis variáveis `E2E_*_EMAIL`/`E2E_*_PASSWORD` para admin, corretor e cliente, e não é seguro usar conta humana de produção. A suíte `npm run test:e2e:certification` percorre todas as rotas de admin e corretor, o perfil do cliente e a matriz de negação entre papéis; ela interrompe corretamente antes do build quando essas credenciais sintéticas não estão no secret store.

**Plano:** criar em staging contas descartáveis de admin, corretor e cliente; adicionar segredos apenas ao CI; executar cada item mutável do checklist, consultar a escrita no banco e apagar os dados de teste. Cobrir ao menos Chrome, Edge e viewport móvel.
**Critério:** zero erro de console/rede inesperado e todas as 1.159 ações marcadas com evidência.
**Status:** bloqueado por credenciais sintéticas.

### B-002 — proteção contra senhas vazadas desabilitada

O advisor Supabase ainda informa `auth_leaked_password_protection` em nível WARN.

**Plano:** Supabase Dashboard → Authentication → Sign In / Password Security → habilitar leaked-password protection; testar uma senha conhecida como comprometida e uma senha forte.
**Critério:** advisor sem esse alerta.
**Referência:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
**Status:** ação manual no painel.

### B-003 — restauração e rollback não ensaiados

O link de backup é real, mas não há evidência nesta rodada de restore em projeto isolado nem de rollback de aplicação.

**Plano:** restaurar o backup mais recente em branch/projeto descartável, executar queries de integridade e medir RTO/RPO; documentar rollback de frontend, Edge Functions e migrations forward-only.
**Critério:** dados amostrados íntegros e tempos registrados no runbook.
**Status:** bloqueado por ensaio operacional controlado.

### B-004 — frontend corrigido ainda não está comprovadamente no domínio público

As migrações e Edge Functions foram publicadas, mas as alterações React desta auditoria estão no worktree e não houve pedido explícito nesta rodada para commit/push/deploy.

**Plano:** após B-001, criar commit, push, aguardar deployment, confirmar o SHA servido e repetir smoke no domínio.
**Critério:** repositório, deployment e artefato apontam para o mesmo commit, com health check aprovado.
**Status:** pendente de publicação coordenada.

## 6. Alertas não impeditivos e dívida técnica

O advisor Supabase retornou 69 warnings de segurança, sem ERROR:

- 67 objetos visíveis no schema GraphQL para `authenticated`. A aplicação depende de acesso direto via Supabase e todas as tabelas públicas têm RLS; a visibilidade do schema não comprova leitura indevida. Ainda assim, deve-se revogar `SELECT` de objetos internos que nenhum usuário precise descobrir. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- 1 função `SECURITY DEFINER` executável por autenticados (`save_crm_pipeline_configuration`). Ela valida admin internamente e é necessária ao CRM; manter com teste negativo por papel e revisar a cada alteração. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- 1 alerta de senha vazada, tratado como gate B-002.

O advisor de performance retornou 420 itens: 155 índices ainda sem uso observado, 264 combinações de policies permissivas e 1 bloat em `net._http_response`. Não se deve remover índice apenas pelo advisor sem janela de observação. Consolidar policies equivalentes por tabela/ação com `EXPLAIN (ANALYZE, BUFFERS)` antes/depois. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## 7. Ordem recomendada para encerrar a certificação

1. Habilitar proteção contra senhas vazadas.
2. Provisionar contas e dados sintéticos em staging.
3. Executar o checklist página a página; a cada falha repetir diagnóstico → ajuste → suíte focal → suíte completa.
4. Ensaiar backup/restore e rollback.
5. Fazer commit/push/deploy do frontend aprovado.
6. Repetir smoke no domínio público e conferir SHA/logs/advisors.
7. Liberar usuários em ondas, com monitoramento de erros, filas, latência e integrações nas primeiras 24 horas.

## 8. Conclusão

A auditoria eliminou falhas críticas reais em distribuição, autorização, autocadastro, CRM, comunicação e integridade operacional. O backend corrigido está ativo e saudável, e o código local passa integralmente pela suíte automatizada. A aplicação ainda não deve ser declarada “perfeita” nem liberada sem os quatro gates impeditivos — sobretudo o teste autenticado por papéis, que é a única forma segura de provar cada botão e mutação real do checklist.
