# Auditoria completa de prontidão para produção — MeMude Connect

**Data da auditoria:** 29 de julho de 2026
**Aplicação:** MeMude Connect / `memude-core`
**Frontend de produção:** `https://core.memudecore.com.br`
**Supabase:** projeto `sistema-memude` (`oxybasvtphosdmlmrfnb`)
**Commit atualmente publicado:** `063ce0319a0f7be61937df1c73ba134eda47926c`
**Conclusão:** **NO-GO para o teste oficial em produção**

> **Atualização de 30/07/2026:** a remediação e a segunda auditoria estão
> documentadas em
> [`RELATORIO_REMEDIACAO_E_REAUDITORIA_2026-07-30.md`](./RELATORIO_REMEDIACAO_E_REAUDITORIA_2026-07-30.md).
> O backend Supabase e o workspace foram corrigidos e aprovados nos gates
> automatizados. A aplicação online continua condicionada à publicação do
> frontend, à ativação da proteção de senhas vazadas no Supabase Auth e ao
> E2E autenticado em staging.

---

## 1. Resumo executivo

A aplicação possui uma base funcional ampla e tecnicamente promissora: autenticação, papéis, CRM, leads, corretores, empreendimentos, visitas, vendas, WhatsApp, agentes de IA, relatórios, automações e sincronização WordPress estão implementados. O projeto Supabase está saudável, todas as 85 tabelas públicas usam RLS, as 44 Edge Functions estão ativas e o frontend publicado responde corretamente nas rotas públicas verificadas.

Entretanto, esta auditoria encontrou riscos que impedem uma aprovação responsável para o teste oficial:

- qualquer usuário autenticado pode executar três funções `SECURITY DEFINER` para excluir, restaurar ou apagar permanentemente visitas arbitrárias;
- usuários autenticados podem usar Edge Functions privilegiadas para enviar mensagens WhatsApp a números arbitrários;
- a função de integração com o CRM permite consultar e transmitir dados de qualquer visita sem validar papel ou propriedade;
- o bucket destinado a comprovantes financeiros está público e sem restrição de tamanho ou MIME;
- a versão publicada contém 20 vulnerabilidades de dependências, incluindo uma crítica e 15 altas;
- os ajustes de segurança feitos no banco e no workspace não estão integralmente versionados nem publicados;
- a produção não passa em typecheck nem lint e não possui um pipeline de CI versionado que impeça releases defeituosos;
- existem cinco distribuições de visita travadas há mais de 160 dias e dois jobs de limpeza falhando repetidamente;
- dados pessoais, mensagens e payloads completos são gravados em logs;
- há uma possibilidade de XSS armazenado na impressão de relatórios.

### Nota de prontidão por dimensão

| Dimensão | Nota | Situação |
|---|---:|---|
| Segurança e autorização | 3,0/10 | Bloqueadores críticos confirmados |
| Integridade de dados | 4,5/10 | RPCs destrutivas e filas antigas |
| Qualidade do código publicado | 5,0/10 | Build passa; typecheck e lint falham |
| Testes e prevenção de regressão | 3,5/10 | Cobertura pequena e sem E2E autenticado |
| Operação e observabilidade | 5,5/10 | Jobs principais saudáveis; gaps e PII em logs |
| Performance e escalabilidade | 6,0/10 | SPA funcional; consultas e chunks precisam evoluir |
| Deploy e reprodutibilidade | 3,5/10 | Forte divergência entre Git, workspace e remoto |
| UX, acessibilidade e SEO | 6,5/10 | Fluxo público funciona; faltam recursos essenciais |
| **Prontidão global atual** | **4,7/10** | **NO-GO** |

> A nota não mede quantidade de funcionalidades. Ela mede o risco de colocar a versão atual sob uso oficial com dados e usuários reais.

---

## 2. Escopo e metodologia

### 2.1 Camadas auditadas

- arquitetura e mapa funcional do frontend;
- rotas, autenticação e autorização;
- componentes React e consultas Supabase;
- validação, tratamento de erros e exportações;
- build Vite, chunks e configuração Vercel;
- dependências de produção e desenvolvimento;
- testes Vitest e desenho dos testes de rotas;
- banco PostgreSQL remoto, RLS, views, funções e grants;
- Supabase Auth, Storage, Edge Functions, cron e Vault;
- integrações Evolution API, WAHA, WordPress e CRM;
- filas de mensagens, leads e visitas;
- logs, monitoramento, documentação e governança de release;
- comportamento público online em navegador real.

### 2.2 Linhas de base separadas

Esta separação é indispensável:

1. **Produção:** commit `063ce03`, atualmente servido pela Vercel.
2. **Workspace:** contém dezenas de alterações locais ainda não commitadas.
3. **Supabase remoto:** contém migrações e funções implantadas que não estão integralmente no commit de produção.

Um build local aprovado não comprova a qualidade da versão online. Da mesma forma, um banco corrigido manualmente não torna o repositório reproduzível.

### 2.3 Verificações executadas

| Verificação | Produção `063ce03` | Workspace atual |
|---|---:|---:|
| Build Vite | Aprovado | Aprovado |
| Testes após build | 65 aprovados | 66 aprovados |
| Testes sem build prévio | 11 falhas | Dependência de ordem ainda existe |
| Typecheck | **20 erros** | Aprovado |
| ESLint | **2 erros + 462 avisos** | 0 erros + **466 avisos** |
| `npm audit` | **20 vulnerabilidades** | **2 altas** |
| Vercel runtime errors, últimos 7 dias | Nenhum registrado | Não aplicável |
| Navegação pública `/auth` | Aprovada | Não aplicável |
| Redirecionamento anônimo `/configuracoes` → `/auth` | Aprovado | Não aplicável |
| Rota 404 | Aprovada | Não aplicável |

### 2.4 Limitações conscientes

- Não foram executadas operações destrutivas para explorar as falhas de autorização.
- Não foi utilizado usuário de teste autenticado porque não existe credencial segura e documentada no repositório.
- Não foram enviados WhatsApps reais durante esta auditoria.
- Não foi realizado teste de carga distribuído.
- Evolution, WAHA, WordPress e Krayin não foram submetidos a pentest externo.
- A ausência de erros de runtime na Vercel não cobre erros do navegador de uma SPA estática; o projeto ainda não envia telemetria completa do cliente.

Essas limitações impedem qualquer declaração de que a aplicação está “sem erros”. O relatório é uma avaliação de risco técnica, baseada em evidências, no ponto do tempo indicado.

---

## 3. Mapa funcional auditado

### 3.1 Núcleo operacional

- **Dashboard administrativo e do corretor:** indicadores, resumos e atalhos.
- **Leads:** cadastro, qualificação, status, atribuição e distribuição.
- **CRM:** pipelines, etapas, kanban, automações e detalhes do lead.
- **Corretores:** cadastro, avaliação, ativação, suspensão e disponibilidade.
- **Empreendimentos:** catálogo, relacionamento com leads e sincronização WordPress.
- **Visitas:** agendamento, distribuição, aceite, rejeição, timeout, cancelamento e histórico.
- **Vendas:** fechamento, comissões, pagamentos e comprovantes.

### 3.2 Comunicação e automação

- **Evolution API V1/V2 e WAHA:** transporte de WhatsApp.
- **Webhook de mensagens:** recebimento e processamento de eventos.
- **Fila de mensagens:** entrega assíncrona e tentativas.
- **Distribuição de leads e visitas:** pontuação, filas e redistribuição.
- **Notificações proativas e lembretes:** follow-up, visitas e financeiro.

### 3.3 Inteligência artificial

- agentes configuráveis;
- OpenAI, Gemini e Anthropic;
- BANT e temperatura do lead;
- detecção de intenção e objeções;
- handoff humano;
- busca semântica de imóveis e embeddings;
- follow-ups e agendamento.

### 3.4 Administração, análise e integrações

- gestão de usuários e papéis;
- configurações gerais, comunicação, automações e financeiro;
- relatórios, exportações, agendamentos e analytics;
- monitoramento de integrações e filas;
- sincronização de empreendimentos WordPress;
- envio de visita/lead ao CRM externo.

---

## 4. Controles positivos confirmados

Os seguintes controles devem ser preservados:

- as 85 tabelas do schema `public` estão com RLS habilitado;
- não foi encontrada tabela pública com RLS desabilitado e grants diretos para `anon`/`authenticated`;
- as três views públicas usam comportamento seguro para o chamador;
- `evolution_instances` e `system_settings` estão restritas a administradores;
- o webhook Evolution V2 exige segredo e rejeita chamadas não autenticadas com `401`;
- os principais jobs `memude-*` usam Vault/cabeçalho interno e estão executando;
- não há mensagens pendentes ou falhas recentes na `message_queue`;
- não há distribuição de leads travada;
- a última sincronização WordPress foi concluída;
- o frontend usa lazy loading por rota;
- a versão online redireciona corretamente usuários anônimos;
- HTTPS e HSTS estão ativos;
- a página 404 é funcional e orienta o usuário.

Esses pontos não anulam os bloqueadores, mas demonstram que a correção pode ser incremental, sem reescrever o sistema.

---

## 5. Critério de severidade

| Nível | Definição |
|---|---|
| **P0 — bloqueador** | Possível perda/exposição de dados, abuso imediato, comprometimento de autorização ou release não confiável. Deve ser corrigido antes de qualquer teste oficial. |
| **P1 — alto** | Falha com impacto operacional, de privacidade, segurança ou qualidade significativa. Deve ser corrigida antes da entrada de usuários reais. |
| **P2 — médio** | Dívida capaz de causar regressão, lentidão ou dificuldade operacional. Deve entrar no primeiro ciclo pós-estabilização. |
| **P3 — melhoria** | Evolução de experiência, governança ou excelência técnica sem risco imediato. |

### Inventário consolidado

| Severidade | Quantidade | IDs |
|---|---:|---|
| **P0** | **6** | SEC-001, SEC-002, SEC-003, STO-001, DEP-001, REL-001 |
| **P1** | **13** | SEC-004 a SEC-008, AUTH-001 a AUTH-002, QUA-001 a QUA-002, TST-001, OPS-001 a OPS-002, PRI-001 |
| **P2** | **12** | DB-001, EDGE-001 a EDGE-003, OBS-001, FE-001 a FE-004, DEP-002 a DEP-003, GOV-001 |
| **P3** | **5** | UX-001, UX-002, SEO-001, SEO-002, GOV-002 |
| **Total** | **36** | 6 bloqueadores e 30 itens de alta, média ou evolutiva prioridade |

---

## 6. Achados P0 — bloqueadores absolutos

### SEC-001 — RPCs destrutivas de visitas acessíveis a qualquer usuário autenticado

**Evidência**

- `soft_delete_visita`, `restore_visita` e `hard_delete_visita` são `SECURITY DEFINER`.
- As três funções são executáveis por `authenticated`.
- Não há verificação de `auth.uid()`, papel administrativo, corretor proprietário ou relacionamento com a visita.
- Em `hard_delete_visita`, as cláusulas `WHERE visita_id = visita_id` sombreiam o parâmetro e a coluna. Isso pode produzir ambiguidade ou afetar todas as linhas relacionadas.
- Fontes: `supabase/migrations/20251004234802_7b5b13fb-63b4-481f-a2f0-b31e93a65983.sql`, linhas 41–99, e `supabase/migrations/20260727210436_harden_security_rls_and_database_advisors.sql`, linhas 165–167.

**Impacto**

Um corretor ou cliente autenticado pode apagar, restaurar ou alterar visitas fora de seu escopo, contornando RLS. A exclusão permanente também pode corromper filas e tentativas de outras visitas.

**Plano de correção**

1. Revogar imediatamente `EXECUTE` de `anon`, `authenticated` e `public`.
2. Recriar as funções com nomes de parâmetro distintos, por exemplo `_visita_id`.
3. Para exclusão permanente, permitir somente `has_role(auth.uid(), 'admin')`.
4. Para soft delete/restauração, definir regra explícita: somente admin ou corretor vinculado, se o negócio permitir.
5. Remover `SECURITY DEFINER` quando RLS puder resolver a autorização; se ele for necessário, fixar `search_path` e autorizar dentro da função.
6. Usar aliases em todos os `DELETE`, por exemplo `WHERE vda.visita_id = _visita_id`.
7. Registrar auditoria imutável com ator, alvo, motivo e timestamp.
8. Criar testes SQL negativos para `cliente`, `corretor` não proprietário e sessão anônima.

**Critérios de aceite**

- todos os perfis não autorizados recebem `42501`/`403`;
- um administrador exclui somente a visita informada;
- nenhuma fila de outra visita é alterada;
- teste transacional demonstra rollback seguro;
- Supabase Advisor não aponta as funções como executáveis indevidamente.

---

### SEC-002 — Usuário autenticado pode enviar WhatsApp arbitrário com credenciais privilegiadas

**Evidência**

- `evolution-send-whatsapp-v2`, `evolution-send-whatsapp` e `enhanced-whatsapp-sender` aceitam o modo `authenticated` ou `authenticated-or-internal`.
- O helper compartilhado valida somente que existe um usuário e devolve um cliente com `SUPABASE_SERVICE_ROLE_KEY`.
- O chamador informa número, mensagem, instância e metadados.
- Não há validação de papel, ownership do lead/corretor, consentimento ou finalidade.
- Exemplo: `supabase/functions/evolution-send-whatsapp-v2/index.ts`, linhas 54–79; `supabase/functions/_shared/security.ts`, linhas 145–184.

**Impacto**

Qualquer conta autenticada pode usar a infraestrutura MeMude para spam, fraude, engenharia social e consumo de recursos, além de falsificar vínculos em logs e filas.

**Plano de correção**

1. Tornar os senders de baixo nível exclusivamente `internal`.
2. Criar um endpoint de negócio por caso de uso, com payload mínimo e autorização explícita.
3. Derivar telefone, instância, lead e corretor do banco; não confiar nesses campos enviados pelo cliente.
4. Implementar autorização por papel e ownership.
5. Exigir estado de consentimento/LGPD antes do envio.
6. Adicionar idempotency key, limite por usuário, número, lead e janela de tempo.
7. Criar allowlist de templates e proibir texto livre para perfis não administrativos.
8. Alertar sobre volume anormal, destinos inéditos e rejeições da Evolution/WAHA.

**Critérios de aceite**

- JWT de corretor não chama sender de baixo nível;
- somente fluxos internos assinados enviam mensagens;
- destino e conteúdo são derivados de entidades autorizadas;
- testes de abuso retornam `403`/`429`;
- existe trilha de auditoria sem conteúdo sensível integral.

---

### SEC-003 — BOLA e transmissão externa indevida em `send-lead-to-crm`

**Evidência**

- a função requer JWT, mas não valida papel nem ownership;
- recebe `visitaId` diretamente do usuário;
- lê visita, lead, empreendimento e corretor usando service role;
- envia os dados ao Krayin e registra o payload completo no console;
- arquivo: `supabase/functions/send-lead-to-crm/index.ts`, especialmente linhas 18–42 e 109.

**Impacto**

Qualquer usuário autenticado pode provocar leitura e transmissão de dados pessoais de uma visita arbitrária para um sistema externo. Trata-se de BOLA, risco de exfiltração e processamento sem base de autorização.

**Plano de correção**

1. Restringir a função a `admin-or-internal`.
2. Validar papel no servidor mesmo com `verify_jwt=true`.
3. Se corretores precisarem do fluxo, conferir `corretor_id` e escopo da visita.
4. Selecionar somente campos necessários ao contrato com o CRM.
5. Remover PII dos logs.
6. Adicionar idempotência e registrar apenas hash/ID da operação.
7. Definir timeout, retry com backoff e dead-letter.
8. Documentar controlador, operador, finalidade e retenção dos dados enviados ao CRM.

**Critérios de aceite**

- usuário sem permissão recebe `403` sem consulta privilegiada;
- visita fora do escopo não é lida nem enviada;
- logs não contêm nome, telefone, e-mail ou payload completo;
- testes de integração cobrem sucesso, duplicidade, timeout e indisponibilidade do CRM.

---

### STO-001 — Bucket de comprovantes financeiros público e irrestrito

**Evidência**

- bucket `comprovantes` está com `public=true`;
- não possui `file_size_limit`;
- não possui `allowed_mime_types`;
- a migração o cria deliberadamente como público em `supabase/migrations/20260602190000_add_comprovantes_to_vendas.sql`, linhas 6–9;
- no momento da auditoria, o bucket estava vazio.

**Impacto**

Comprovantes futuros poderão ser baixados sem autenticação por quem obtiver ou adivinhar a URL. Uploads sem limite de tamanho/MIME aumentam risco de custo, malware e armazenamento abusivo.

**Plano de correção**

1. Alterar o bucket para privado antes do primeiro upload real.
2. Limitar arquivos, por exemplo, a PDF/JPEG/PNG e tamanho compatível com o processo.
3. Gerar caminhos com UUID aleatório; nunca usar CPF, nome, e-mail ou venda no nome público.
4. Servir arquivos somente por signed URL curta, criada após autorização.
5. Restringir leitura a admin e, se necessário, ao corretor da venda.
6. Adicionar varredura de malware e validação real de magic bytes.
7. Definir retenção, exclusão e registro de acesso.
8. Criar teste que confirme `403` em URL pública e expiração da signed URL.

**Critérios de aceite**

- endpoint público não entrega arquivos;
- MIME e tamanho são rejeitados no Storage e na aplicação;
- URL assinada expira e não pode ser reutilizada após o prazo;
- acesso fica auditado;
- política de retenção está documentada.

---

### DEP-001 — Produção contém uma vulnerabilidade crítica e 15 altas

**Evidência**

O `npm audit` executado em uma cópia limpa do commit publicado encontrou:

- 1 crítica;
- 15 altas;
- 4 moderadas;
- 20 no total.

Pacotes diretos afetados incluem `jspdf`, `react-router-dom`, `postcss`, `vite` e `xlsx`. `xlsx` não possui correção disponível na linha usada. O workspace já atualizou/removou parte deles, mas ainda possui duas vulnerabilidades altas no React Router.

**Impacto**

Exposição a vulnerabilidades conhecidas, riscos de processamento malicioso de arquivos, falhas no toolchain e ausência de conformidade mínima para release.

**Plano de correção**

1. Partir de uma branch limpa baseada no commit publicado.
2. Incorporar e revisar as atualizações locais de `jspdf`, Vite, PostCSS e utilitários.
3. Remover `xlsx` e manter a substituição segura já iniciada com `fflate`.
4. Atualizar `react-router`/`react-router-dom` para a versão corrigida mais recente compatível.
5. Reexecutar testes de rotas, autenticação, navegação e exportação.
6. Bloquear CI para vulnerabilidades aplicáveis altas/críticas.
7. Manter exceções somente por ID de advisory, justificativa técnica, proprietário e validade.
8. Ativar Dependabot/Renovate com PRs pequenos e frequentes.

**Critérios de aceite**

- zero vulnerabilidade aplicável alta ou crítica;
- exportações CSV/XLSX/PDF validadas com entradas hostis;
- navegação e guards de papel aprovados;
- lockfile reproduzível com `npm ci`;
- relatório de SBOM armazenado como artefato da release.

---

### REL-001 — Produção, Git, workspace e Supabase remoto não representam o mesmo sistema

**Evidência**

- produção executa `063ce03`;
- o workspace possui dezenas de arquivos modificados e novos, sem commit;
- quatro migrações de hardening de 27/07 estão aplicadas no Supabase, mas não existem no commit publicado;
- essas migrações aparecem como não rastreadas no workspace;
- headers de segurança, cache, CI, upgrades e correções de typecheck existem apenas localmente;
- o repositório continua contendo migração com segredo literal e job com placeholder;
- uma migração financeira adicional existe localmente e não está no remoto.

**Impacto**

Não é possível reconstruir produção a partir do Git, revisar todas as mudanças aplicadas, fazer rollback confiável ou provar qual código gerou o estado atual.

**Plano de correção**

1. Congelar mudanças diretas no projeto principal até reconciliar o estado.
2. Criar inventário assinado de commit frontend, versões das 44 Functions e migrations remotas.
3. Classificar todas as alterações locais por origem e responsável; preservar trabalho do usuário.
4. Transformar mudanças remotas legítimas em migrations idempotentes versionadas.
5. Corrigir ou retirar migrations legadas com segredo/placeholder.
6. Validar tudo em branch Supabase ou projeto de staging.
7. Fazer PR único de estabilização com revisão e evidências.
8. Implantar somente artefato originado do commit aprovado.
9. Criar runbook de rollback do frontend, Functions e banco.

**Critérios de aceite**

- `git status` limpo no artefato de release;
- `supabase migration list` coincide com o diretório versionado;
- versões implantadas das Functions correspondem ao commit;
- produção Vercel aponta para o SHA aprovado;
- rollback ensaiado em staging;
- nenhuma alteração manual não documentada permanece.

---

## 7. Achados P1 — alta prioridade

### SEC-004 — Modelo de papéis ainda aceita `profiles.role`

**Evidência**

- `user_roles` é a fonte de verdade pretendida;
- `profiles.role` continua existindo;
- `get_current_user_role()` lê o papel legado;
- `useAuth` usa `profiles.role` como fallback e monta `isAdmin`/`isCorretor` a partir dele;
- `authenticated` possui `UPDATE` em todas as colunas de `profiles`, inclusive `role`, `is_active`, `id`, `user_id` e timestamps;
- o `WITH CHECK` da policy do próprio perfil não restringe explicitamente a coluna legada.

**Impacto**

Há duas fontes de autorização, com possibilidade de divergência e elevação aparente no frontend. Mesmo que a maioria das policies use `has_role`, funções e telas legadas podem tomar decisões incorretas.

**Plano**

1. Remover todo fallback de `profiles.role`.
2. Alterar `get_current_user_role()` para consultar exclusivamente `user_roles`.
3. Remover a coluna legada após mapear dependências.
4. Até a remoção, impedir `INSERT/UPDATE` da coluna por usuários comuns.
5. Centralizar helpers server-side de papel.
6. Testar matriz `admin`, `corretor`, `cliente`, suspenso e usuário sem role.

**Aceite:** não existe decisão de autorização baseada em `profiles.role`; tentativa de alterar papel pelo perfil é rejeitada.

---

### SEC-005 — Logs estruturados podem ser falsificados por qualquer usuário autenticado

**Evidência**

`structured-logger` recebe `user_id`, `corretor_id`, `lead_id`, nível, stack e metadados do payload e grava tudo com service role, sem conferir identidade ou escopo.

**Impacto**

Log poisoning, falsificação de auditoria, associação indevida a usuários/leads e armazenamento de conteúdo arbitrário.

**Plano**

1. Tornar a função interna ou limitar campos aceitos.
2. Derivar `user_id` do JWT.
3. Não aceitar `corretor_id`/`lead_id` sem validar ownership.
4. Limitar tamanho, nível, cardinalidade e chaves de metadata.
5. Separar log operacional de trilha de auditoria imutável.
6. Aplicar rate limit e detecção de abuso.

**Aceite:** usuário não falsifica ator ou entidade; payload excessivo retorna `413`; eventos de auditoria são somente server-side.

---

### SEC-006 — XSS armazenado na impressão de relatórios

**Evidência**

`GeneratedReportDialog.tsx` usa `document.write` e interpola sem escaping:

- nome e descrição do relatório;
- nome e status de leads;
- outras strings derivadas dos dados.

O código está nas linhas 110–209.

**Impacto**

Uma string persistida contendo HTML/script pode executar na janela de impressão, no contexto do usuário administrativo, com potencial acesso ao `window.opener`.

**Plano**

1. Remover `document.write`.
2. Renderizar a página de impressão com React e CSS `@media print`.
3. Se uma nova janela for indispensável, construir nós com `textContent`.
4. Usar `noopener,noreferrer` e remover acesso ao `opener`.
5. Validar/normalizar nomes de arquivo de exportação.
6. Adicionar testes com payloads XSS em nome, descrição e lead.

**Aceite:** strings hostis aparecem como texto; nenhum script/event handler executa; CSP permanece sem `unsafe-eval`.

---

### SEC-007 — Segredo de cron versionado em repositório público

**Evidência**

- o repositório GitHub é público;
- `20260528190000_secure_cron_and_vault.sql`, linha 20, contém um segredo literal previsível;
- `99999_enable_cron_monitor_visits.sql`, linha 17, contém `YOUR_SERVICE_ROLE_KEY`.

**Impacto**

Se o segredo literal ainda for aceito em qualquer caminho, deve ser considerado comprometido. O placeholder também torna a implantação inconsistente.

**Plano**

1. Rotacionar o segredo, independentemente de acreditar que não foi usado.
2. Confirmar que nenhum job ou Function aceita o valor antigo.
3. Usar Vault/secret manager e referência indireta.
4. Remover valores do histórico quando útil, sem considerar isso substituto da rotação.
5. Instalar secret scanning pre-commit e no GitHub.

**Aceite:** valor antigo falha; jobs usam segredo rotacionado; scanner não encontra credenciais.

---

### SEC-008 — Produção sem headers de segurança do navegador

**Evidência**

Na resposta online existem HTTPS e HSTS, mas faltam:

- `Content-Security-Policy`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- `X-Content-Type-Options`;
- `X-Frame-Options`;
- `Cross-Origin-Opener-Policy`.

Esses headers já estão preparados no `vercel.json` local, mas não publicados.

**Impacto**

Aumenta a superfície de XSS, clickjacking, MIME sniffing e vazamento de referência. A ausência de CSP agrava o achado SEC-006.

**Plano**

1. Revisar e publicar a configuração local.
2. Testar CSP inicialmente em `Report-Only`.
3. Remover dependência de inline style progressivamente.
4. Validar login, Supabase Realtime, imagens, downloads e impressão.
5. Adicionar teste automatizado de headers.

**Aceite:** observatório de headers aprova; aplicação funciona sem violações CSP relevantes; iframe externo é bloqueado.

---

### AUTH-001 — Proteção contra senhas vazadas está desativada

**Evidência**

O Supabase Security Advisor reporta “leaked password protection disabled”.

**Impacto**

Usuários podem utilizar credenciais já presentes em vazamentos conhecidos, elevando risco de credential stuffing.

**Plano**

1. Ativar proteção de senhas vazadas.
2. Exigir política de força razoável.
3. Implantar MFA obrigatório para administradores e recomendado para corretores.
4. Revisar sessões, expiração e revogação.
5. Alertar logins anômalos e tentativas excessivas.

**Aceite:** senha comprometida é rejeitada; admin sem MFA não acessa área sensível após período de transição.

Referência oficial: [Supabase — Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

---

### AUTH-002 — Não existe recuperação de senha no frontend

**Evidência**

A página de autenticação contém apenas e-mail, senha e botão de login. Não há chamada a `resetPasswordForEmail`, rota de recuperação ou troca autenticada.

**Impacto**

Usuários bloqueados dependem de intervenção administrativa, aumentando suporte e incentivando práticas inseguras.

**Plano**

1. Implementar “Esqueci minha senha”.
2. Configurar redirect URL somente para domínios permitidos.
3. Criar tela de definição de nova senha e invalidar sessões antigas.
4. Não revelar se o e-mail existe.
5. Adicionar rate limit e telemetria de abuso.

**Aceite:** fluxo completo funciona em staging e produção; respostas não permitem enumeração de usuários.

---

### QUA-001 — Código publicado falha no typecheck

**Evidência**

Foram encontrados 20 erros, incluindo:

- tipos incompletos de experimentos e resultados de A/B;
- inferência excessivamente profunda em métricas e auditoria;
- casts incompatíveis de logs e qualificação;
- acesso inválido a `Json.error`;
- símbolo `User` ausente;
- enums inválidos em criação/edição de usuários e vendas;
- `profile_id` divergente dos tipos gerados;
- duplicidade incompatível de `AIAgent`.

**Impacto**

Inconsistências reais entre UI, banco e contratos podem permanecer ocultas porque o build SWC não executa TypeScript.

**Plano**

1. Incorporar as correções locais já existentes, revisando cada cast.
2. Regenerar tipos Supabase a partir do schema reconciliado.
3. Evitar `as any` para silenciar divergências.
4. Tornar `npm run typecheck` obrigatório antes do build.
5. Corrigir a configuração gradualmente para `strictNullChecks`.

**Aceite:** typecheck zero erros em clone limpo; tipos gerados coincidem com o remoto.

---

### QUA-002 — Lint publicado falha e o workspace ainda possui 466 avisos

**Evidência**

- produção: 2 erros e 462 avisos;
- workspace: 0 erros e 466 avisos;
- 449 avisos locais são `no-explicit-any`;
- 8 são dependências ausentes de hooks;
- 9 são de React Refresh.

**Impacto**

`any` e hooks incompletos ocultam bugs, stale closures e divergências de contratos.

**Plano**

1. Corrigir imediatamente as oito dependências de hooks após revisar efeitos colaterais.
2. Definir orçamento de avisos decrescente.
3. Atacar primeiro autenticação, vendas, distribuição e integrações.
4. Trocar `any` por tipos de domínio, `unknown` e validação Zod.
5. Configurar `--max-warnings` no CI.

**Aceite:** zero erro, zero warning de hooks e redução contínua mensurável de `any`.

---

### TST-001 — Não há quality gate versionado nem suíte E2E autenticada

**Evidência**

- `.github/workflows/ci.yml` existe apenas como arquivo não rastreado;
- o commit publicado não possui workflow;
- o workflow local executa `npm test` antes de `npm run build`, mas os testes de rota exigem `dist`;
- executar testes antes do build produz 11 falhas;
- os “E2E” atuais inspecionam arquivos e chunks; não automatizam jornadas autenticadas;
- falhas de rede em testes online são capturadas e não falham a suíte.

**Impacto**

Vercel publica porque o build passa, mesmo com typecheck, lint ou segurança quebrados. Fluxos críticos não têm proteção contra regressão.

**Plano**

1. Corrigir a ordem e separar testes unitários de verificação do build.
2. Versionar CI com `npm ci`, typecheck, lint, testes, build e audit.
3. Adicionar Playwright para admin, corretor e permissões negativas.
4. Criar projeto Supabase/staging com dados sintéticos.
5. Testar webhook, distribuição, aceite, rejeição, timeout, venda e exportação.
6. Fazer falha de rede falhar no smoke test de produção.

**Aceite:** branch protection exige CI verde; E2E cobre jornadas P0; nenhum teste depende de artefato residual.

---

### OPS-001 — Cinco distribuições de visita estão travadas há meses

**Evidência**

Há cinco registros `visit_distribution_queue.status='in_progress'`, iniciados entre janeiro e fevereiro de 2026, com idade aproximada de 167 a 193 dias, `current_attempt=1` e sem motivo de falha.

**Impacto**

Visitas podem permanecer sem corretor, métricas ficam incorretas e o mecanismo de timeout não cumpre sua função.

**Plano**

1. Investigar cada visita e preservar evidência antes de corrigir estado.
2. Reconciliar tentativa, visita, lead e mensagens enviadas.
3. Marcar como `failed`/`cancelled` ou redistribuir com decisão de negócio.
4. Corrigir o timeout checker para detectar filas sem tentativa ativa.
5. Criar invariant checker e alerta para fila acima do SLA.
6. Adicionar idempotência e lock por visita.

**Aceite:** zero fila antiga; alerta dispara dentro do SLA; teste simula worker interrompido e recuperação.

---

### OPS-002 — Dois jobs de limpeza WordPress falham repetidamente

**Evidência**

`cleanup-old-sync-logs` falha diariamente e `cleanup-sync-logs-weekly` falha semanalmente. O delete em `wp_sync_log` viola a FK `wp_sync_performance_sync_log_id_fkey`.

**Impacto**

Crescimento de tabelas, ruído operacional e retenção de logs além do necessário.

**Plano**

1. Definir política de retenção para pai e filhos.
2. Escolher `ON DELETE CASCADE`, delete ordenado ou anonimização, conforme requisito.
3. Corrigir ambos os jobs em uma migration versionada.
4. Testar com relações existentes e transação.
5. Alertar cron failures consecutivas.

**Aceite:** três execuções consecutivas bem-sucedidas; nenhuma FK órfã; retenção documentada.

---

### PRI-001 — PII e conteúdo de mensagens são registrados em logs

**Evidência**

Foram localizados logs com telefone, e-mail, texto de mensagem, payload de CRM e respostas externas em múltiplas Functions, incluindo handlers Evolution/WAHA, follow-up, criação de usuário, distribuição e senders. `webhook_logs` também armazena payload com telefone/texto.

**Impacto**

Ampliação desnecessária da superfície LGPD, acesso administrativo excessivo, retenção indefinida e possível vazamento por observabilidade.

**Plano**

1. Criar logger compartilhado com allowlist e redaction.
2. Mascarar telefones/e-mails e nunca registrar corpo integral por padrão.
3. Separar debug temporário, protegido por flag e prazo.
4. Definir retenção por classe de log.
5. Restringir tabelas/log drains por papel.
6. Apagar ou anonimizar histórico conforme política e base legal.
7. Criar scanner automatizado de PII em logs.

**Aceite:** amostra de logs de todas as jornadas não contém PII integral; retenção e acesso estão aplicados.

---

## 8. Achados P2 — prioridade média

### DB-001 — 75 alertas de segurança e 449 alertas de performance no Supabase Advisor

**Evidência**

- 67 tabelas autenticadas expostas ao `pg_graphql`;
- 7 funções `SECURITY DEFINER` executáveis por autenticados;
- 1 alerta de senha vazada;
- 285 alertas de múltiplas policies permissivas;
- 164 índices não utilizados.

Os alertas GraphQL não provam vazamento, porque RLS está habilitado, mas indicam grants mais amplos que o necessário.

**Plano**

1. Corrigir primeiro as funções destrutivas.
2. Revogar acesso GraphQL de objetos que o frontend não utiliza.
3. Revisar grants de `anon` e `authenticated` por matriz de uso.
4. Consolidar policies equivalentes para reduzir custo e ambiguidade.
5. Avaliar índices com estatística de uso e planos reais antes de removê-los.
6. Medir novamente após ciclo representativo de staging.

**Aceite:** zero alerta crítico de função; grants mínimos documentados; redução dos advisors sem regressão.

Referências oficiais: [Supabase Product Security](https://supabase.com/docs/guides/security/product-security) e [Database Linter](https://supabase.com/docs/guides/database/database-linter).

---

### EDGE-001 — 40 de 44 Functions usam `verify_jwt=false`

**Evidência**

A maioria possui autenticação própria e não foi encontrada Function privilegiada totalmente aberta após o hardening. Mesmo assim, o desenho depende de cada handler lembrar de validar segredo/JWT corretamente.

**Impacto**

Maior risco de regressão: uma nova Function pode ser implantada pública por engano.

**Plano**

1. Usar `verify_jwt=true` por padrão para rotas de usuário.
2. Manter `false` somente para webhooks/cron com autenticação própria.
3. Criar teste automático que classifique cada Function e rejeite modo sem justificativa.
4. Padronizar autenticação e resposta de erro.

**Aceite:** inventário versionado informa ameaça, auth mode e consumidor de cada Function.

Referência oficial: [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth).

---

### EDGE-002 — CORS amplo e ausência de limite de corpo em diversas Functions

**Evidência**

- 41 Functions retornam `Access-Control-Allow-Origin: *`;
- 25 fazem `req.json()` diretamente, sem o helper de limite de tamanho.

**Impacto**

CORS amplo não substitui autorização, mas facilita abuso via navegador quando JWT está disponível. Corpos grandes podem elevar custo e memória.

**Plano**

1. Restringir CORS às origens MeMude para endpoints de browser.
2. Não adicionar CORS a endpoints exclusivamente internos.
3. Aplicar `readJson` com limites específicos.
4. Limitar media por URL/tamanho e usar upload direto seguro.
5. Retornar `413` e métricas de rejeição.

**Aceite:** testes de origem não permitida e payload excessivo falham corretamente.

---

### EDGE-003 — Imports Deno não totalmente fixados

**Evidência**

Várias Functions importam `https://esm.sh/@supabase/supabase-js@2` sem patch fixo.

**Impacto**

Builds podem resolver versões diferentes e introduzir regressão ou risco de supply chain.

**Plano**

Fixar versões, centralizar dependências e registrar lock/artefato implantado.

**Aceite:** redeploy do mesmo commit produz o mesmo grafo de dependências.

---

### OBS-001 — Evento de teste de webhook aparece como falha

**Evidência**

Um `TEST_CONNECTION` recebeu HTTP `200`, mas foi salvo com `processed_successfully=false` porque caiu no fluxo de evento ignorado.

**Impacto**

Dashboard gera falso negativo e dificulta diagnóstico.

**Plano**

Criar status `ignored`/`test_success`, separar transporte de processamento e ajustar métricas.

**Aceite:** teste válido aparece como sucesso de conectividade, sem contar como mensagem processada.

---

### FE-001 — Consultas carregam colunas e conjuntos excessivos

**Evidência**

- 26 ocorrências de `.select('*')`;
- apenas duas chamadas `.range(...)`;
- 20 chamadas `.limit(...)`;
- módulos como CRM, dashboards, automações, configurações e WordPress carregam objetos completos.

**Impacto**

Maior transferência de PII, renderização lenta e degradação progressiva com crescimento do banco.

**Plano**

1. Selecionar somente colunas usadas.
2. Adotar paginação server-side em listas.
3. Usar count/head para métricas simples.
4. Criar RPCs/views de dashboard com agregação segura.
5. Definir stale time e invalidação por domínio.

**Aceite:** nenhuma lista ilimitada; payload e tempo medidos antes/depois; PII não utilizada deixa de trafegar.

---

### FE-002 — Requisições do frontend não usam cancelamento

**Evidência**

Não foram encontrados `AbortController` ou sinais de cancelamento nas consultas auditadas.

**Impacto**

Respostas obsoletas podem chegar após troca de filtro/rota, desperdiçando rede e causando estados inconsistentes.

**Plano**

Propagar o `AbortSignal` do TanStack Query e cancelar buscas dependentes de filtros.

**Aceite:** troca rápida de rota/filtro cancela requisições antigas sem toast falso.

---

### FE-003 — Chunks grandes e cache de assets ineficiente na produção

**Evidência**

No build publicado:

- `Configuracoes`: 384,26 kB, 118,19 kB gzip;
- `charts`: 432,14 kB, 113,59 kB gzip;
- `vendor`: 162,69 kB;
- `ui`: 131,79 kB;
- `supabase`: 125,87 kB.

Assets online usam `Cache-Control: public, max-age=0, must-revalidate`. O cache imutável existe apenas no `vercel.json` local.

**Plano**

1. Publicar cache anual para assets com hash.
2. Dividir configurações por aba/feature.
3. Carregar gráficos somente nas telas necessárias.
4. Executar bundle analyzer e estabelecer budget.
5. Pré-carregar somente rotas de alta probabilidade.

**Aceite:** assets hashados ficam `immutable`; budgets impedem regressão; Web Vitals são medidos.

---

### FE-004 — Dados de perfil são impressos no console do navegador

**Evidência**

`useAuth` registra o objeto completo de perfil em `console.log`.

**Impacto**

Exposição local desnecessária e ruído em produção.

**Plano**

Remover logs de dados pessoais, usar logger por ambiente e sanitizar erros.

**Aceite:** console de produção não contém perfil, token, telefone ou e-mail.

---

### DEP-002 — Script de auditoria contém exceção de advisory frágil

**Evidência**

`scripts/audit-dependencies.mjs` ignora `GHSA-qwww-vcr4-c8h2` por considerar que o projeto não usa RSC/server actions. O `npm audit` ainda informa duas altas no workspace.

**Impacto**

Uma mudança arquitetural futura pode tornar a exceção aplicável sem reavaliação.

**Plano**

Registrar proprietário, justificativa, data de expiração e teste que confirme ausência do runtime afetado; preferir atualização para versão corrigida.

**Aceite:** exceção expira automaticamente ou deixa de ser necessária.

---

### DEP-003 — Browserslist desatualizado

**Evidência**

`caniuse-lite` está aproximadamente 13 meses desatualizado.

**Impacto**

Transpilação e compatibilidade podem não refletir navegadores atuais.

**Plano**

Atualizar lockfile e executar matriz mínima Chrome, Edge, Safari e dispositivos móveis.

---

### GOV-001 — `SECURITY.md` declara certificação incompatível com o estado real

**Evidência**

O documento contém “CERTIFICADO DE AUDITORIA DE SEGURANÇA” e recomenda nova revisão para janeiro de 2026, data já expirada.

**Impacto**

Cria falsa confiança, prejudica governança e pode ser interpretado como declaração de conformidade.

**Plano**

Substituir certificado por status vivo, escopo, data, limitações, riscos aceitos e responsável.

**Aceite:** documentação coincide com os findings abertos e não declara certificação sem auditoria independente.

---

## 9. Achados P3 — excelência e experiência

### UX-001 — HTML publicado está marcado como inglês

O commit online usa `<html lang="en">`, embora todo o produto esteja em português. O workspace já altera para `pt-BR`.

**Ajuste:** publicar `pt-BR` e testar leitores de tela.

### SEO-001 — Imagem Open Graph configurada não existe

`/og-image.jpg` retorna o HTML da SPA com HTTP 200, e não uma imagem.

**Ajuste:** adicionar imagem real, URL absoluta e teste de `Content-Type`.

### SEO-002 — `robots.txt` permite indexar todas as rotas do portal

Embora dados protegidos não sejam entregues sem sessão, páginas internas e autenticação podem ser indexadas.

**Ajuste:** definir estratégia de indexação; normalmente o sistema central deve usar `noindex`/`Disallow`, mantendo o portal público separado.

### UX-002 — Login não oferece exibir senha

**Ajuste:** adicionar botão acessível de mostrar/ocultar senha, sem bloquear colar/autofill.

### GOV-002 — Ausência de ambiente de staging reproduzível e dados sintéticos

**Ajuste:** adotar branch Supabase/staging, contas sintéticas por papel e integrações sandbox.

---

## 10. Plano de correção por fases

### Fase 0 — contenção, 0 a 24 horas

1. Revogar execução das três RPCs destrutivas.
2. Restringir senders WhatsApp e `send-lead-to-crm`.
3. Tornar `comprovantes` privado e limitar uploads.
4. Rotacionar o segredo de cron exposto.
5. Suspender o teste oficial.
6. Tirar snapshot lógico e registrar versões implantadas.
7. Abrir incident log interno, mesmo sem evidência atual de exploração.

**Saída:** vetores P0 ficam indisponíveis e auditáveis.

### Fase 1 — estabilização, 1 a 3 dias

1. Corrigir RPCs e testes de autorização.
2. Corrigir BOLA do CRM e abuso dos senders.
3. Corrigir XSS de relatório.
4. Reconciliar as cinco filas travadas.
5. Corrigir os jobs WordPress.
6. Eliminar PII de logs novos.
7. Reconciliar migrations e Functions com o Git.
8. Atualizar dependências críticas.

**Saída:** zero P0 confirmado.

### Fase 2 — quality gate, 3 a 7 dias

1. Typecheck e lint obrigatórios.
2. CI versionado e branch protection.
3. E2E por papel em staging.
4. Headers de segurança e cache publicados.
5. Recuperação de senha e proteção de senhas vazadas.
6. Testes de integração dos webhooks, filas e CRM.
7. Smoke test pós-deploy automatizado.

**Saída:** release candidate reproduzível.

### Fase 3 — ensaio oficial, 1 a 2 semanas

1. Rodar carga com volume esperado e pico de 3–5 vezes.
2. Executar teste de falha de Evolution, WAHA, WordPress e CRM.
3. Ensaiar rollback.
4. Executar UAT com dados sintéticos.
5. Monitorar SLOs por 72 horas.
6. Fazer go/no-go com evidência assinada.

**Saída:** autorização para teste oficial controlado.

### Fase 4 — excelência, 2 a 6 semanas

1. Paginação e queries agregadas.
2. Redução de chunks e melhoria de Web Vitals.
3. Remoção gradual de `any` e ativação de TypeScript mais estrito.
4. MFA, trilha imutável e revisão LGPD.
5. Chaos testing de filas e integrações.
6. Métricas de produto e qualidade por jornada.

---

## 11. Matriz de testes obrigatória antes do GO

### Segurança

- usuário anônimo não acessa dados ou Functions privadas;
- cliente não acessa módulos administrativos;
- corretor só vê e altera entidades autorizadas;
- corretor não envia mensagem fora de seu escopo;
- IDs arbitrários em RPC/Function retornam `403`;
- comprovante privado exige signed URL;
- payload XSS não executa;
- segredo antigo é rejeitado;
- logs não contêm PII integral.

### Jornadas administrativas

- criar/editar/bloquear usuário;
- criar e qualificar lead;
- cadastrar corretor e empreendimento;
- agendar e reagendar visita;
- fechar venda, comissão e comprovante;
- configurar Evolution/WAHA;
- gerar e exportar relatório;
- sincronizar WordPress;
- configurar agente de IA.

### Jornadas do corretor

- login e recuperação de senha;
- visualizar somente seus leads/visitas;
- aceitar/rejeitar visita;
- atualizar andamento permitido;
- consultar comissão;
- atualizar perfil sem alterar papel.

### Automação e falhas

- distribuição com sucesso;
- rejeição e próximo corretor;
- timeout e redistribuição;
- máximo de tentativas;
- worker interrompido;
- mensagem duplicada;
- webhook duplicado, fora de ordem e assinatura inválida;
- Evolution indisponível com fallback WAHA;
- CRM indisponível com retry e dead-letter;
- cron atrasado e retomada.

### Não funcionais

- carga e concorrência;
- acessibilidade WCAG 2.2 AA nas jornadas principais;
- Chrome, Edge, Safari e mobile;
- backup e restore;
- rollback de frontend, Function e migration;
- Web Vitals e orçamento de bundle;
- retenção e exclusão LGPD.

---

## 12. SLOs e observabilidade recomendados

| Indicador | Meta inicial |
|---|---:|
| Disponibilidade do portal | 99,9% |
| Login bem-sucedido, p95 | < 2 s |
| Consulta de listas, p95 | < 1,5 s |
| Enfileiramento de WhatsApp, p95 | < 1 s |
| Entrega aceita pelo provedor, p95 | < 10 s |
| Webhook processado, p95 | < 2 s |
| Distribuição de visita iniciada | < 60 s |
| Fila travada acima do SLA | 0 |
| Cron failures consecutivas | 0 |
| Erros frontend não tratados | < 0,5% das sessões |
| Vulnerabilidades altas/críticas aplicáveis | 0 |
| PII integral em logs | 0 |

Alertas devem apontar proprietário, severidade, runbook e prazo de resposta.

---

## 13. Melhorias para tornar a aplicação referência mundial

### 13.1 Motor inteligente de matching

- ranking explicável entre lead, empreendimento e corretor;
- disponibilidade e distância em tempo real;
- fairness para evitar concentração excessiva;
- aprendizado baseado em aceite, visita e venda;
- simulação offline antes de alterar pesos;
- fallback determinístico quando IA estiver indisponível.

### 13.2 Qualificação omnichannel

- continuidade entre WhatsApp, voz, web e e-mail;
- consentimento granular por canal;
- detecção de intenção, urgência e objeção;
- resumo automático para o corretor;
- handoff com contexto completo, sem revelar prompt ou dados de outros clientes;
- avaliação contínua de qualidade e alucinação.

### 13.3 Operação imobiliária de alta conversão

- SLA visível por etapa;
- previsão de chance de visita e venda;
- next-best-action por lead;
- roteamento por especialidade e empreendimento;
- no-show prediction e reconfirmação inteligente;
- jornada pós-visita e recuperação de leads frios.

### 13.4 Plataforma de dados confiável

- catálogo de eventos de negócio;
- trilha de auditoria append-only;
- data quality checks e reconciliação diária;
- dashboards de funil com definições versionadas;
- feature flags para lançamentos;
- experimentos com guardrails estatísticos;
- warehouse separado para analytics pesado.

### 13.5 Segurança e privacidade by design

- MFA/passkeys;
- least privilege;
- secrets manager e rotação;
- DLP em logs e exports;
- retenção automática;
- atendimento a direitos do titular;
- threat modeling por nova integração;
- pentest independente antes de abertura ampla.

### 13.6 Engenharia de confiabilidade

- staging idêntico a produção;
- deploy canário;
- rollback automático por SLO;
- idempotência em todos os jobs e webhooks;
- dead-letter queues;
- tracing distribuído com correlation ID;
- game days trimestrais;
- RPO/RTO testados.

### 13.7 Experiência do corretor

- interface mobile-first e PWA;
- inbox unificada;
- agenda sincronizada;
- modo de baixa conectividade;
- notificações acionáveis;
- explicação transparente do motivo de cada lead;
- reputação baseada em qualidade, não apenas velocidade.

---

## 14. Checklist final de GO/NO-GO

O teste oficial só deve ser liberado quando todos os itens abaixo estiverem comprovados:

- [ ] SEC-001 a SEC-003 corrigidos e testados negativamente.
- [ ] STO-001 corrigido.
- [ ] DEP-001 com zero vulnerabilidade alta/crítica aplicável.
- [ ] REL-001 reconciliado e release reproduzível.
- [ ] Typecheck, lint, testes, build e audit verdes em clone limpo.
- [ ] CI obrigatório na branch principal.
- [ ] E2E autenticado para admin, corretor e cliente.
- [ ] Filas antigas reconciliadas.
- [ ] Crons de limpeza com três execuções consecutivas bem-sucedidas.
- [ ] PII removida dos logs novos e política de retenção aplicada.
- [ ] Headers de segurança publicados.
- [ ] Backup e rollback ensaiados.
- [ ] Staging aprovado com dados sintéticos.
- [ ] Monitoramento e alertas ativos.
- [ ] UAT assinado pelos responsáveis de negócio.
- [ ] Plano de incidente e contatos de plantão definidos.

---

## 15. Decisão final

**A versão atual não deve seguir para o teste oficial em produção.**

O motivo não é falta de funcionalidade, e sim a existência de falhas confirmadas de autorização, integridade, privacidade, dependências e reprodutibilidade. A correção é viável sem reescrever a aplicação, mas precisa começar pelos seis bloqueadores P0, seguida de um release candidate criado a partir de estado limpo, versionado e validado em staging.

Após a conclusão da Fase 0 e da Fase 1, deve ser feita uma auditoria de remediação focada em provar que cada vetor deixou de existir. Somente então a equipe deve avançar para o ensaio oficial.

---

## 16. Referências técnicas atuais

- [Supabase Security](https://supabase.com/docs/guides/security)
- [Supabase Product Security](https://supabase.com/docs/guides/security/product-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Securing Supabase Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase Changelog — Edge Functions](https://supabase.com/changelog?tags=edge+functions)
- [Supabase Breaking Changes](https://supabase.com/changelog?types=breaking-change)
