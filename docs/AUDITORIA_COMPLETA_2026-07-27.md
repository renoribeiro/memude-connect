# Auditoria Completa — MeMude Connect

**Data:** 27 de julho de 2026
**Escopo:** frontend React/Vite, autenticação e autorização, Supabase/RLS, migrations, Edge Functions, integrações, automações, observabilidade, testes, dependências, desempenho e arquitetura de produto.
**Método:** revisão estática de 444 arquivos, execução local de build, testes, TypeScript, ESLint e auditoria de dependências.

## 1. Resumo executivo

O MeMude Connect já possui uma base funcional ampla e coerente com a operação descrita: captura de leads, qualificação, agendamento de visitas, distribuição para corretores, CRM, vendas, comissões, comunicação, relatórios, IA conversacional e sincronização com WordPress.

Entretanto, o sistema **não deve ser considerado pronto para escalar com segurança no estado atual**. A auditoria identificou riscos críticos em quatro áreas:

1. Edge Functions públicas usam a chave `service_role` sem autenticar o chamador.
2. Credenciais da Evolution API podem ser lidas por qualquer usuário autenticado.
3. Webhooks aceitam eventos sem validar assinatura, permitindo falsificação de mensagens e estados.
4. A malha de cron jobs e migrations é inconsistente, podendo interromper redistribuição de leads, relatórios e sincronizações.

Além disso, há 20 erros de TypeScript, 469 ocorrências de lint, 20 vulnerabilidades conhecidas em dependências, baixa cobertura de testes dos fluxos críticos e métricas de conversão conceitualmente incorretas.

### Avaliação geral

| Dimensão | Nota | Situação |
|---|---:|---|
| Cobertura funcional | 8/10 | Ampla e bem alinhada ao negócio |
| Segurança de aplicação | 3/10 | Há exposições críticas |
| Confiabilidade operacional | 4/10 | Cron, filas e observabilidade precisam de correção |
| Qualidade de código | 5/10 | Build passa, mas tipos e lint falham |
| Testabilidade | 3/10 | Testes cobrem principalmente utilitários |
| Escalabilidade | 5/10 | Há boas iniciativas, porém consultas e módulos monolíticos limitam crescimento |
| Produto e dados | 6/10 | Bons módulos, mas métricas e governança precisam amadurecer |

**Decisão recomendada:** executar primeiro um ciclo de estabilização e segurança de 2 a 4 semanas. Novas funcionalidades devem ser limitadas até concluir os itens P0 e P1 deste relatório.

## 2. Funcionamento e mapa dos módulos

### 2.1 Fluxo principal do negócio

1. Um lead chega pelo portal, WordPress, webhook, WhatsApp ou cadastro manual.
2. Os dados são persistidos em `leads`, associados opcionalmente a um `empreendimento`.
3. O agente de IA pode conduzir conversa, detectar intenção, qualificar por BANT, tratar objeções e solicitar transferência humana.
4. Uma visita é criada em `visitas`.
5. A distribuição seleciona corretores elegíveis por regras, score, disponibilidade e timeout.
6. O corretor recebe a oportunidade por WhatsApp e pode aceitar ou rejeitar.
7. A fila tenta o próximo corretor quando há recusa, falha de entrega ou timeout.
8. O lead pode ser acompanhado no CRM Kanban.
9. A operação registra visita, feedback, venda, comissão e comprovantes.
10. Dashboards, relatórios e logs apresentam o desempenho da operação.

### 2.2 Módulos de frontend

- **Autenticação e RBAC:** login Supabase, perfis e papéis `admin`, `corretor` e `cliente`.
- **Dashboard administrativo:** leads, corretores ativos, visitas e taxa de conversão.
- **Dashboard do corretor:** leads e visitas atribuídos.
- **Leads:** cadastro, edição, filtros, lixeira e distribuição.
- **Corretores:** cadastro, avaliação, cobertura geográfica, preferências e status.
- **Empreendimentos:** catálogo e integração com WordPress.
- **Visitas:** calendário, confirmações, feedback, lembretes e distribuição.
- **Vendas e comissões:** valores, impostos, comissão, pagamento e comprovantes.
- **CRM:** funis, etapas, drag-and-drop, notas e automações.
- **Comunicações:** templates e histórico.
- **Relatórios e analytics:** métricas, gráficos, exportação e agendamento.
- **IA:** agentes, prompts, conversas, BANT, objeções, handoff, follow-ups, A/B tests e analytics.
- **Configurações:** Evolution API, WAHA, SMTP, APIs, distribuição e integrações.
- **Monitoramento:** logs de integração, webhooks e saúde operacional.

### 2.3 Backend

Foram identificadas 45 Edge Functions e 152 migrations. Os grupos principais são:

- Distribuição de leads e visitas.
- Timeouts, confirmações e monitoramento de visitas.
- Transporte WhatsApp via Evolution API e WAHA.
- Agentes de IA e busca semântica.
- Usuários, notificações e convites.
- WordPress e Google Sheets.
- Relatórios e métricas.
- Webhooks de entrada.

## 3. Resultado das verificações automatizadas

### Build

O build de produção foi concluído:

- 3.636 módulos transformados.
- Maior chunk: `charts`, aproximadamente 432 kB antes de gzip.
- `Configuracoes` possui aproximadamente 383 kB antes de gzip.
- O build não executa TypeScript e, por isso, não detecta os 20 erros de tipo existentes.

### Testes

- 5 arquivos de teste.
- 63 testes aprovados.
- A maioria cobre formatadores, datas, telefones e schemas.
- O arquivo chamado `e2e/routes.test.ts` é, na prática, um teste estático de arquivos e chunks; não navega na aplicação.
- As verificações do site em produção capturam erros de rede e apenas imprimem avisos, portanto podem passar mesmo com o site indisponível.

### TypeScript

Foram encontrados **20 erros**, concentrados em:

- criação e edição de usuários/corretores;
- cadastro e atualização de vendas;
- A/B testing e analytics de IA;
- logs de auditoria;
- qualificação BANT;
- dashboard do corretor;
- configurações Evolution;
- modelos duplicados de `AIAgent`.

### ESLint

Foram encontradas **469 ocorrências**:

- 450 usos explícitos de `any`;
- 8 dependências ausentes em React Hooks;
- 9 problemas de Fast Refresh;
- 2 erros `prefer-const`.

### Dependências

O `npm audit` encontrou:

- 1 vulnerabilidade crítica;
- 15 altas;
- 4 moderadas;
- 20 no total.

Dependências diretas relevantes:

- `jspdf`: vulnerabilidade crítica;
- `react-router-dom`: vulnerabilidades altas;
- `xlsx`: vulnerabilidades altas e sem correção disponível no pacote atualmente instalado;
- `vite`: vulnerabilidades altas;
- `postcss`: vulnerabilidade alta.

## 4. Achados críticos — P0

### P0-01 — Edge Functions públicas executam com `service_role` sem autenticação

**Evidência:** várias funções possuem `verify_jwt = false`, criam cliente com `SUPABASE_SERVICE_ROLE_KEY` e não chamam `auth.getUser`, não validam segredo interno e não verificam assinatura.

Exemplos confirmados:

- `ai-agent-processor`
- `ai-generate-embeddings`
- `ai-property-search`
- `ai-schedule-visit`
- `calculate-metrics`
- `create-notification`
- `proactive-notifications`
- `send-welcome-email`
- `send-whatsapp-invitation`
- `template-renderer`
- funções de conexão/configuração Evolution

**Impacto:** qualquer pessoa que descubra a URL pode gerar custos de IA, criar leads e visitas, alterar conversas, disparar notificações ou mensagens, consultar dados internos por respostas indiretas e executar operações que ignoram RLS.

**Plano de ajuste:**

1. Classificar cada função como `user`, `internal-cron` ou `external-webhook`.
2. Funções de usuário: ativar JWT e validar `user_roles`.
3. Funções internas: exigir segredo rotativo, usar comparação de tempo constante e negar acesso quando o segredo estiver ausente.
4. Webhooks: validar HMAC/assinatura e timestamp do provedor.
5. Nunca aceitar o próprio `service_role` como token HTTP externo.
6. Adicionar testes automatizados para `401`, `403`, replay e payload adulterado.

### P0-02 — Webhooks Evolution e WAHA não validam autenticidade

**Evidência:** os handlers processam payloads e atualizam filas, mensagens e tentativas sem validar assinatura do provedor. O código menciona “signature” em documentação, mas a verificação não está implementada nos handlers.

**Impacto:** um atacante pode falsificar aceite ou rejeição de corretor, status de entrega e mensagens do cliente, provocando atribuição indevida, cancelamento de visita, corrupção de histórico ou disparos de WhatsApp.

**Plano de ajuste:**

1. Configurar um segredo exclusivo por instância.
2. Validar HMAC do corpo bruto antes de fazer `req.json()`.
3. Validar timestamp e rejeitar replay.
4. Criar chave idempotente por `provider + instance + message_id + event`.
5. Armazenar apenas payload sanitizado.
6. Implementar teste de contrato por versão do provedor.

### P0-03 — Token da Evolution API exposto a qualquer usuário autenticado

**Evidência:** a migration `20260118140000_create_evolution_instances.sql` permite `SELECT` com `USING (true)` para `authenticated`. A tabela contém `api_url` e `api_token`, e o frontend executa `.select('*')`.

**Impacto:** um corretor ou cliente autenticado pode obter a chave da instância de WhatsApp e operar a conta fora do MeMude.

**Plano de ajuste:**

1. Revogar imediatamente a política de leitura ampla.
2. Rotacionar todos os tokens Evolution potencialmente expostos.
3. Remover `api_token` da tabela consultada pelo navegador.
4. Guardar segredo no Supabase Vault ou secret manager.
5. Expor ao frontend somente metadados mascarados por uma função admin.
6. Auditar logs de acesso e uso do provedor.

### P0-04 — Segredos estáticos e fallbacks publicados no repositório

**Evidência:**

- `CRON_SECRET` possui fallback `memude-cron-secret-2026-super-secure`.
- `LEADS_WEBHOOK_TOKEN` possui fallback `memude-api-token2026`.
- a migration de 2026 grava o segredo de cron em texto claro em `system_settings`.

**Impacto:** o segredo deixa de ser secreto; qualquer pessoa com acesso ao código pode invocar jobs internos. A ausência de variável de ambiente não bloqueia o sistema e o deixa operar com credencial conhecida.

**Plano de ajuste:**

1. Remover todos os fallbacks.
2. Fazer a função falhar fechada quando o secret não estiver configurado.
3. Rotacionar os segredos atuais.
4. Guardá-los no Vault e limitar leitura ao processo interno.
5. Usar segredos distintos por finalidade.
6. Documentar rotação e resposta a incidente.

### P0-05 — Modelo de papéis permite inconsistência e possível escalada lateral

**Evidência:**

- a política de `profiles` permite que o próprio usuário atualize sua linha inteira;
- a coluna `profiles.role` continua existindo;
- migrations recentes do CRM voltaram a confiar em `profiles.role = 'admin'`;
- `useAuth` usa `profiles.role` como fallback quando `user_roles` falha.

**Impacto:** mesmo que o papel principal esteja em `user_roles`, subsistemas novos podem confiar em um valor modificável pelo próprio usuário. Isso viola a arquitetura de segurança declarada.

**Plano de ajuste:**

1. Remover a coluna `profiles.role` após migrar todas as referências.
2. Até a remoção, impedir alteração dessa coluna por usuário comum com trigger e privilégios de coluna.
3. Substituir todas as políticas por `has_role(auth.uid(), ...)`.
4. Remover o fallback do frontend.
5. Criar teste de RLS para tentativa de elevação de `cliente` e `corretor`.
6. Incluir lint SQL que proíba `profiles.role` em novas migrations.

### P0-06 — Malha de cron jobs e migrations pode deixar fluxos centrais inoperantes

**Evidência:**

- existe uma migration `99999_enable_cron_monitor_visits.sql` com versão de apenas cinco dígitos, executada antes das migrations de 2024 em um banco novo;
- ela agenda chamada com `YOUR_SERVICE_ROLE_KEY`;
- jobs antigos chamam funções com chave anônima;
- funções de timeout agora exigem `CRON_SECRET`;
- a migration de endurecimento reagenda timeout de visitas, mas não corrige claramente o timeout periódico de leads;
- `schedule-reports` não possui agendamento encontrado;
- várias migrations tentam agendar os mesmos nomes de jobs.

**Impacto:** leads podem ficar presos aguardando corretor, visitas podem não ser monitoradas, relatórios podem nunca rodar e sincronizações podem falhar silenciosamente.

**Plano de ajuste:**

1. Consultar `cron.job` e `cron.job_run_details` no ambiente remoto.
2. Criar uma migration canônica que remova todos os jobs legados pelo nome.
3. Recriar somente os jobs necessários, com segredo do Vault.
4. Corrigir a versão da migration `99999`.
5. Adicionar health check que detecte job atrasado.
6. Testar em um banco vazio com `supabase db reset`.
7. Documentar dono, frequência, SLA e alerta de cada job.

### P0-07 — Dependências com vulnerabilidades críticas e altas

**Impacto:** risco de XSS, path traversal, prototype pollution, DoS e exposição de arquivos, dependendo do caminho de uso.

**Plano de ajuste:**

1. Atualizar `jspdf` e validar exportações.
2. Atualizar React Router, Vite, PostCSS e dependências transitivas.
3. Substituir `xlsx` por alternativa mantida ou versão segura distribuída pelo fornecedor.
4. Rodar testes e build após cada grupo.
5. Adicionar `npm audit --audit-level=high` ao CI.
6. Habilitar atualização automatizada semanal.

## 5. Achados de alta prioridade — P1

### P1-01 — Convite por WhatsApp quebra em runtime

`send-whatsapp-invitation` usa `window.location` dentro de uma Edge Function Deno. `window` não existe nesse ambiente.

**Correção:** usar uma variável `APP_URL` validada no servidor; adicionar teste de execução Deno.

### P1-02 — Relatórios agendados não enviam email

`schedule-reports` apenas escreve no log “Email would contain” e mantém um `TODO`.

**Correção:** integrar Resend ou provedor transacional, registrar tentativa, status, idempotência, anexos e retentativas; criar cron e alertas.

### P1-03 — Erros de TypeScript atingem fluxos de negócio

Os 20 erros não são apenas cosméticos: indicam divergência entre tipos e banco em usuários, corretores, vendas e IA.

**Correção:** bloquear merge quando `tsc --noEmit` falhar; corrigir enums e modelos; eliminar interfaces duplicadas; regenerar tipos após confirmar schema remoto.

### P1-04 — Dados pessoais e mensagens completas são registrados em logs

Há logs com telefone, email, conteúdo de mensagem, payload completo de webhook e respostas de provedor.

**Impacto:** exposição de PII, risco LGPD e vazamento por ferramentas de observabilidade.

**Correção:** logger estruturado central, redaction de telefone/email/CPF/token, proibição de payload bruto e política de retenção.

### P1-05 — Endpoints de email, WhatsApp e notificação podem ser usados para abuso

`send-welcome-email`, `send-whatsapp-invitation` e `create-notification` não autenticam o chamador.

**Impacto:** spam, phishing usando a marca MeMude, consumo de cota e criação de notificações falsas.

**Correção:** tornar chamadas internas, exigir autorização admin e nunca aceitar `resetUrl` arbitrária; gerar o link no servidor usando allowlist de domínio.

### P1-06 — Possível SSRF nas funções de configuração/conexão

Funções Evolution aceitam URLs ou configurações e realizam `fetch` sem uma validação de destino suficientemente forte.

**Correção:** exigir admin, aceitar somente HTTPS, bloquear IPs privados/loopback/link-local, aplicar allowlist de hosts e timeout curto.

### P1-07 — `template-manager` usa papel legado e autorização insuficiente

Qualquer usuário autenticado com perfil pode criar e alterar templates não sistêmicos usando `service_role`. Não há escopo por proprietário/equipe. A checagem de admin usa `profile.role`.

**Correção:** usar `user_roles`, definir ACL de templates, remover `service_role` quando RLS for suficiente e validar conteúdo/tamanho.

### P1-08 — Métricas de conversão estão conceitualmente erradas

Em Relatórios, “Convertidos” repete a quantidade de `visita_realizada`. No dashboard, a taxa é `visitas realizadas / total de leads`, podendo passar de 100% se um lead tiver mais de uma visita.

**Correção:** definir funil canônico:

- lead recebido;
- qualificado;
- visita agendada;
- visita realizada;
- proposta;
- venda aprovada;
- venda paga.

Calcular cada etapa por `lead_id` distinto e por coorte de entrada.

### P1-09 — Ausência de CI/CD com gates de qualidade

Não foi encontrada configuração de CI.

**Correção:** pipeline obrigatório com lint, TypeScript, testes, build, auditoria de dependências, validação de migrations e testes de RLS.

### P1-10 — Documentos de segurança estão desatualizados e superestimam a proteção

O relatório de 2025 declara todas as vulnerabilidades corrigidas, OWASP verificado e LGPD preparado, mas o código atual contradiz essas afirmações.

**Correção:** retirar linguagem de “certificado”, versionar controles verificáveis e registrar evidências reproduzíveis.

## 6. Achados de prioridade média — P2

### P2-01 — Cobertura de testes insuficiente

Não há testes automatizados reais para:

- RLS por papel;
- criação, qualificação e distribuição de lead;
- aceite, recusa e timeout;
- webhook e idempotência;
- criação de visita;
- venda e comissão;
- CRM e automações;
- agentes de IA;
- WordPress;
- cron jobs.

**Correção:** pirâmide de testes com unidade, integração Supabase local, contratos de webhook e Playwright para jornadas essenciais.

### P2-02 — “E2E” pode passar sem validar produção

Os `catch` de rede apenas escrevem avisos e não falham o teste.

**Correção:** separar smoke test de produção do teste local; falhar quando o ambiente obrigatório estiver indisponível.

### P2-03 — Paginação feita depois de baixar todos os dados

Corretores, visitas e comunicações carregam o conjunto completo e usam `slice` no navegador.

**Correção:** paginação no banco com `range`, `count: exact`, filtros indexados e busca normalizada.

### P2-04 — Consultas de contagem transferem linhas desnecessárias

O dashboard usa `select('*', { count: 'exact' })` sem `head: true`.

**Correção:** usar `select('id', { count: 'exact', head: true })` ou RPCs agregadas.

### P2-05 — Arquivos monolíticos aumentam risco de regressão

Exemplos:

- `sync-wordpress-properties`: 1.517 linhas;
- `ai-agent-processor`: 1.290 linhas;
- `Configuracoes.tsx`: 1.128 linhas;
- `CorretorForm.tsx`: 1.093 linhas;
- `Relatorios.tsx`: 770 linhas.

**Correção:** separar domínio, adapters, casos de uso, validação e apresentação; manter funções pequenas e testáveis.

### P2-06 — Uso excessivo de `any`

450 ocorrências anulam grande parte do benefício do TypeScript.

**Correção:** começar por fronteiras externas, tipos gerados do banco, payloads de webhook e respostas de IA.

### P2-07 — Fuso horário pode deslocar data de visitas

Há uso frequente de `toISOString().split('T')[0]`, que converte para UTC antes de obter a data.

**Correção:** padronizar `America/Sao_Paulo`, separar `date` de `timestamp` e testar virada do dia/horário de verão histórico.

### P2-08 — Sem headers HTTP de segurança

`vercel.json` contém apenas rewrite SPA.

**Correção:** adicionar CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e proteção contra framing.

### P2-09 — CORS universal — reclassificado

Várias Edge Functions usam `Access-Control-Allow-Origin: *`. A documentação
atual do Supabase confirma que essa também é a política do gateway da plataforma
e que a fronteira de segurança das funções é autenticação/autorização, não a
origem enviada pelo navegador. Portanto, o wildcard isoladamente não constitui
uma vulnerabilidade de acesso.

**Tratamento:** as funções novas ou endurecidas usam a allowlist compartilhada;
as funções legadas mantêm o cabeçalho compatível, mas todas as 40 funções
publicadas com `verify_jwt=false` foram verificadas individualmente e recusam
POST sem a autenticação própria esperada. Webhooks exigem segredo ou HMAC.

### P2-10 — Observabilidade incompleta

O Error Boundary afirma que a equipe foi notificada, mas apenas escreve no console. Não há evidência de SLOs, tracing distribuído ou correlação consistente.

**Correção:** error tracking, trace ID de ponta a ponta, métricas de fila, alertas e runbooks.

### P2-11 — `.env` versionado e `.gitignore` corrompido

O `.env` está no Git. Os valores atuais são publicáveis do frontend, não segredos, mas o padrão aumenta a chance de um segredo real ser commitado. O final do `.gitignore` contém bytes NUL/UTF-16.

**Correção:** reconstruir `.gitignore` em UTF-8, ignorar `.env*`, manter `.env.example` e habilitar secret scanning.

### P2-12 — Semântica de rotas e papéis é inconsistente

Páginas dentro de `pages/admin` como Leads, CRM, Visitas, Comunicações e Relatórios exigem apenas usuário autenticado na rota.

**Correção:** criar matriz explícita de permissões por capacidade, não apenas por nome de rota; alinhar UI, Edge Functions e RLS.

### P2-13 — Papel `cliente` não possui experiência própria

O papel existe, mas não há área dedicada de cliente. Um cliente autenticado cai em uma aplicação concebida para admin/corretor.

**Correção:** decidir se `cliente` é papel futuro ou ativo; se futuro, bloquear login operacional; se ativo, criar jornada própria.

### P2-14 — Imports remotos Deno têm versões inconsistentes

Há versões diferentes de Supabase JS e módulos carregados por URL em runtime.

**Correção:** usar `deno.json`, imports centralizados, lockfile e atualização controlada.

## 7. Pontos positivos

- Separação de papéis em `user_roles` foi uma decisão correta, apesar das regressões posteriores.
- RLS está habilitado na maioria das tabelas sensíveis.
- Há tentativas recentes de resolver concorrência e locking na distribuição.
- O frontend usa lazy loading e chunking.
- O build de produção conclui.
- Existem validações Zod e testes úteis de CPF, telefone, datas e moeda.
- O domínio do negócio está bem representado no schema.
- Há recursos avançados raros em CRMs desse estágio: BANT, objeções, handoff, follow-ups, busca vetorial, A/B testing, múltiplos transportes WhatsApp e automações de CRM.
- A arquitetura tem potencial para se tornar um produto de alto nível após a estabilização.

## 8. Plano de correção recomendado

### Fase 0 — Contenção imediata, 24 a 72 horas

1. Restringir ou desativar temporariamente as Edge Functions públicas P0.
2. Rotacionar Evolution API, cron e webhook tokens.
3. Bloquear leitura de `evolution_instances` para não-admin.
4. Implementar assinatura nos webhooks.
5. Remover fallbacks de segredo.
6. Verificar cron jobs reais e restaurar timeout de leads/visitas.
7. Atualizar `jspdf`, React Router e demais dependências exploráveis.
8. Preservar logs necessários para investigação, com acesso restrito.

**Critério de saída:** nenhum endpoint com `service_role` acessível sem autenticação ou assinatura.

### Fase 1 — Estabilização, semana 1

1. Corrigir os 20 erros TypeScript.
2. Corrigir convite WhatsApp.
3. Implementar envio real de relatórios ou esconder o recurso até ficar pronto.
4. Corrigir métricas de conversão.
5. Criar migration canônica de cron.
6. Corrigir `profiles.role` e políticas CRM.
7. Sanear logs com PII.
8. Adicionar headers de segurança.

**Critério de saída:** build, TypeScript, lint crítico e testes de segurança aprovados.

### Fase 2 — Qualidade e confiabilidade, semanas 2 a 4

1. Criar CI.
2. Implementar testes de integração com Supabase local.
3. Testar RLS com admin, corretor, cliente e anônimo.
4. Testar distribuição completa com concorrência.
5. Implementar idempotência e outbox para mensagens.
6. Criar dead-letter queue e retentativas exponenciais.
7. Adicionar observabilidade, alertas e runbooks.
8. Paginar consultas no servidor.

**Critério de saída:** jornadas críticas cobertas e SLOs monitorados.

### Fase 3 — Arquitetura para escala, meses 2 e 3

1. Separar módulos monolíticos.
2. Criar camada de casos de uso para operações críticas.
3. Centralizar autenticação/autorização das Edge Functions.
4. Padronizar eventos de domínio.
5. Consolidar Evolution/WAHA atrás de uma interface única.
6. Definir contratos versionados de webhook.
7. Padronizar datas, dinheiro e estado transacional.
8. Criar ambiente de staging com dados sintéticos.

## 9. Roadmap para tornar o produto referência mundial

### 9.1 Motor de matching de corretores

Evoluir de regras estáticas para um ranking explicável:

- aderência ao empreendimento e região;
- taxa de aceite;
- tempo de resposta;
- comparecimento;
- conversão por faixa de preço;
- satisfação do cliente;
- carga atual;
- equidade de distribuição;
- prevenção de concentração e favorecimento.

Cada atribuição deve registrar “por que este corretor foi escolhido”.

### 9.2 Orquestração por SLA

Criar um centro operacional em tempo real:

- tempo até primeiro contato;
- tempo até qualificação;
- tempo até visita;
- oportunidade sem responsável;
- lead esfriando;
- corretor sem resposta;
- visita em risco;
- handoff de IA aguardando humano.

### 9.3 Customer 360 e timeline imutável

Uma tela única por lead com:

- origem e campanha;
- consentimentos;
- conversas;
- mudanças de score;
- imóveis apresentados;
- visitas;
- corretores envolvidos;
- propostas;
- vendas;
- eventos de automação;
- razões de perda.

### 9.4 IA governada e mensurável

- avaliação offline de prompts;
- conjunto de conversas “golden”;
- métricas de alucinação e resolução;
- versionamento de prompt/modelo;
- aprovação humana para ações sensíveis;
- limites de custo por agente;
- detecção de prompt injection;
- redaction de PII;
- explicação da qualificação.

### 9.5 Marketplace de corretores de alta confiança

- onboarding com validação de CRECI;
- disponibilidade em tempo real;
- reputação multidimensional;
- treinamento e certificação por empreendimento;
- níveis de parceiro;
- regras transparentes de distribuição;
- contestação e auditoria;
- prevenção de fraude e manipulação.

### 9.6 Produto orientado a experimentos

Medir por coorte:

- lead → contato;
- contato → qualificação;
- qualificação → visita;
- visita → proposta;
- proposta → venda;
- CAC, tempo de ciclo e receita por origem;
- desempenho por empreendimento, região, corretor e agente de IA.

Experimentos devem ter hipótese, métrica primária, guardrails e significância.

### 9.7 Experiência premium para cliente e corretor

- PWA mobile-first;
- notificações push;
- agenda integrada;
- check-in de visita;
- rotas e mapas;
- documentos e propostas;
- feedback pós-visita;
- portal do cliente;
- acessibilidade WCAG 2.2 AA;
- modo offline para informações essenciais.

### 9.8 LGPD e confiança

- inventário de dados e base legal;
- registro de consentimento;
- minimização e retenção;
- exportação e exclusão;
- trilha de acesso à PII;
- criptografia de campos críticos;
- DPA com fornecedores;
- plano de incidente;
- privacy by design.

### 9.9 Plataforma multiempresa

Se o objetivo incluir expansão:

- tenant explícito em todas as entidades;
- isolamento por RLS;
- branding e regras por operação;
- planos e limites;
- billing;
- auditoria por tenant;
- integrações configuráveis;
- data warehouse com isolamento.

### 9.10 SLOs recomendados

- disponibilidade mensal: 99,9%;
- ingestão de lead: p95 abaixo de 2 s;
- primeira tentativa de distribuição: p95 abaixo de 30 s;
- processamento de webhook: p95 abaixo de 1 s;
- perda de mensagem: zero, com outbox;
- duplicidade de atribuição: zero;
- jobs atrasados: alerta em até 5 min;
- incidentes P0: resposta em até 15 min.

## 10. Ordem sugerida do backlog

| Ordem | Entrega | Prioridade |
|---:|---|---|
| 1 | Fechar Edge Functions públicas e assinar webhooks | P0 |
| 2 | Rotacionar e mover segredos | P0 |
| 3 | Corrigir RLS de Evolution e `profiles.role` | P0 |
| 4 | Reparar cron de leads, visitas e relatórios | P0 |
| 5 | Atualizar dependências vulneráveis | P0 |
| 6 | Corrigir TypeScript e convite WhatsApp | P1 |
| 7 | Corrigir métricas e relatórios agendados | P1 |
| 8 | Implantar CI e testes de RLS/distribuição | P1 |
| 9 | Observabilidade, idempotência e DLQ | P1 |
| 10 | Paginação, modularização e performance | P2 |
| 11 | Customer 360, SLA e matching explicável | Estratégico |
| 12 | Portal cliente, PWA e plataforma multiempresa | Estratégico |

## 11. Limitações desta auditoria

Esta revisão validou o código e o ambiente local. Não foram executados:

- teste de invasão contra produção;
- inspeção autenticada do banco remoto;
- consulta efetiva de `cron.job` no projeto remoto;
- validação de configurações do Supabase Auth, Vercel, DNS e provedores;
- teste com dados reais e usuários reais;
- revisão jurídica formal de LGPD.

O acesso ao banco remoto exigiu credencial de banco não disponível no ambiente. Portanto, políticas e jobs foram avaliados pelas migrations; o estado remoto deve ser confirmado antes de aplicar correções.

## 12. Conclusão

O MeMude Connect tem uma fundação de produto ambiciosa e diferenciada. O maior risco atual não é falta de funcionalidade, mas a distância entre a amplitude do sistema e os controles de segurança, teste e operação necessários para sustentá-lo.

Com a execução disciplinada das fases P0 e P1, a aplicação pode sair de um estado funcional porém arriscado para uma plataforma confiável. Depois disso, o melhor caminho para liderança de mercado é combinar três vantagens: distribuição explicável e justa, operação por SLA em tempo real e IA governada por dados de conversão reais.
