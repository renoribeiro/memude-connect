# Auditoria técnica e proposta — ciclo de visitas

Data: 15/09/2026. Workspace: commit `72f64b7`. Supabase: `oxybasvtphosdmlmrfnb`.
Estado original: diagnóstico e desenho para discussão. Após o brainstorm, implementação local iniciada e validada; ver `ATIVACAO_AUTOMACAO_VISITAS.md` para a entrega, os testes e os requisitos de publicação. As evidências de auditoria abaixo retratam a versão anterior às alterações.

## 1. Conclusão

A aplicação tem uma base aproveitável de visitas, distribuição, WhatsApp, fila de mensagens, CRM e notificações. O ciclo completo solicitado não está implementado. Acrescentar mensagens ao monitor atual manteria falhas de associação das respostas, controle de prazos, persistência e recuperação de cancelamentos.

A recomendação é um fluxo persistido por visita, com confirmações independentes de cliente e corretor, registro de eventos, mensagens por destinatário e pendências operacionais do Closer. Silêncio não comprova ausência; cancelamento da visita não comprova desistência do lead.

O ambiente consultado contém somente uma visita não excluída, agendada para 20/03/2026. O usuário confirmou que `core.memudecore.com.br` é o ambiente correto e que os agendamentos ainda começarão nele. Planejar ativação para novas visitas, sem disparo retroativo para a visita antiga. Os dados disponíveis não permitem calcular o no-show atual nem atribuir sua causa ao processo manual.

### Decisões confirmadas pelo usuário

- O ambiente operacional será `core.memudecore.com.br`; o agendamento ainda será iniciado.
- Se o corretor não puder comparecer, o Closer decide entre substituição e reagendamento.
- Silêncio do cliente não cancela: manter visita agendada e abrir pendência para o Closer.
- Closer único; telefone configurável pelo administrador atual em Configurações.
- Grupo da empresa selecionável em Configurações, junto ao telefone do Closer.
- Aprovados: lembrete na véspera e 2h antes; pergunta de ocorrência T+1h e escalada sem resposta T+2h, contadas do horário agendado.
- Janela regular: 7h às 20h; avisos urgentes podem ser enviados a qualquer hora. Adotar o fuso America/Sao_Paulo, consistente com a planilha.
- Closer registra no sistema: interesse, objeções, próximo passo e prazo de retorno.
- Integração com CRM interno e aba VISITAS do arquivo Google Sheets informado; CRM externo fora deste fluxo.
- Usuário forneceu o Apps Script: relatório de leads por e-mail e operações em planilha; não contém WhatsApp. Nova integração de visitas usará Sheets API, preservando as rotinas existentes.

### Planilha inspecionada após definição do usuário

Arquivo: `CRM MeMude 2025`, ID `1Oycr_RxrO0syRw0n4IdNWfmPVfJPVfXkqbI8eKjmapI`. Aba `VISITAS`, sheetId `490283298`, fuso `America/Sao_Paulo`. Leitura de metadados, cabeçalho A1:AD1 e amostra J1:V3; nenhuma escrita.

Cabeçalhos A:V: Nome; Telefone; Data Visita; Fonte; Horário; Imóvel; Local; Bairro; Corretor; Feedback; Status; Responsável; Data Venda; Follow Up Lucas; Follow Up NO SHOW; ultima tentativa; id_visita; telefone_corretor_e164; lembrete_vespera_enviado; lembrete_h2_enviado; confirmacao_lead; confirmacao_corretor.

Há histórico preenchido e colunas técnicas compatíveis com automação. O usuário confirmou Apps Script; verificar código e gatilhos antes de ligar a nova sistemática, para evitar envios concorrentes. O script não foi localizado no repositório. Proposta: sincronizar por id_visita, preservar histórico e anotações manuais; definir campos adicionais para ocorrência, motivo e nota sem sobrescrever colunas existentes. A conexão do assistente permite inspeção, mas a automação do servidor ainda precisa de credencial Google própria apropriada.

O usuário esclareceu que superadmin significa o administrador atual. Usar o papel admin de user_roles, sem criar novo papel. O painel de acompanhamento fica disponível às contas administrativas; o destinatário único de WhatsApp é configurado separadamente.

## 2. Alcance e limites da auditoria

- Revisão transversal da arquitetura, rotas, autenticação, documentação de segurança, pipeline de qualidade e integrações.
- Revisão detalhada dos caminhos de cadastro, lembretes, respostas, pós-visita, notificações, distribuição, fila, CRM e planilha.
- Consultas somente de leitura ao banco remoto: estrutura de visitas, constraints, triggers, funções de CRM, jobs, dados agregados e assessoria de segurança.
- Consulta da versão implantada de `monitor-visits`, que contém os mesmos comportamentos relevantes identificados localmente.
- Execução dos checks locais e testes públicos de navegação em navegador.
- Nenhuma alteração de aplicação, migração, configuração remota ou envio de WhatsApp. Este documento é a única alteração intencional versionável.

Não é uma certificação de toda a aplicação nem um pentest. Não houve exercício autenticado de todas as telas, teste de carga, envio real de botões, confirmação de entrega no telefone ou comparação integral de todas as funções implantadas com o repositório. As verificações locais não comprovam qual frontend está publicado. Relatórios anteriores de julho foram usados como contexto, não como evidência atual de aprovação.

## 3. Arquitetura revisada e reaproveitamento

| Área | Implementação observada | Implicação |
|---|---|---|
| Frontend | SPA React/TypeScript/Vite, TanStack Query, React Router, shadcn, formulários Zod | Integrar telas e indicadores existentes |
| Autenticação | `useAuth.tsx`, `ProtectedRoute.tsx`, `user_roles`; papéis admin/corretor/cliente | SDR e Closer precisam de definição funcional e de acesso; não gravar papéis em profiles |
| Visitas | `VisitaModal.tsx`, `VisitaForm.tsx`, telas administrativas e do corretor | Cadastro/edição direta no Supabase; distribuição disparada após salvar |
| Outras entradas | `ai-schedule-visit`, `webhook-leads-visitas` | Inicialização do ciclo deve alcançar todas as entradas autorizadas |
| Distribuição | `distribute-visit`, timeout checker, `_shared/distribution-logic.ts` | Separar aceite da atribuição de confirmação de presença |
| Lembretes | `monitor-visits`, `send-visit-reminder` | Unificar regras automáticas e manuais para evitar duplicidade |
| WhatsApp | Evolution V2, WAHA, senders e webhooks | Definir instância de saída e conservar contexto da resposta |
| Fila | `evolution-process-queue`, `dequeue_pending_messages` | Já há aquisição com trava e novas tentativas; falta ciclo de negócio por destinatário |
| CRM interno | `useCrmPipeline`, `crm_*`, triggers em visitas | Reaproveitar associação por visita e revisar automações existentes |
| CRM externo | `send-lead-to-crm` | Exige visita realizada e interesse; não equivale a sincronizar todo evento |
| Planilha | `google-sheets-sync` | Integração centrada em corretores; não implementa o acompanhamento solicitado |
| Notificações | `NotificationSystem.tsx`, tabela notifications e Realtime | Leitura é diferente de resolução; criar pendência durável |
| IA | Orquestrador, handoff, follow-up, agendamento | Respostas transacionais devem ter prioridade e não conflitar com IA |
| Demais módulos | Vendas/financeiro, relatórios, catálogo WordPress e monitoramento | Preservar integrações; adicionar indicadores de visitas com denominadores definidos |
| Deploy | SPA Vercel, build, CI e testes | Validar frontend e backend separadamente |

O package.json atual já possui `typecheck` e `check`, ao contrário da descrição antiga do AGENTS.md. A autorização atual consulta exclusivamente `user_roles` e falha de forma segura.

## 4. Achados do ciclo de visitas

### VIS-01 — Resposta pode atingir a pendência errada — alta

Em `_shared/distribution-logic.ts`, `processIncomingMessage` prioriza distribuição antes de confirmações. Os handlers selecionam tentativa/visita por telefone, status e ordenação, sem exigir vínculo à mensagem respondida. Um corretor com mais de uma demanda pode aceitar uma atribuição quando queria confirmar presença. O analisador também usa substrings muito curtas, como `s`, `n` e `1`.

Proposta: botão com referência opaca à visita, etapa e revisão do agendamento; validar remetente, validade e estado. Texto livre só resolve automaticamente quando o contexto é inequívoco. Nota numérica não deve cair no analisador de aceite.

### VIS-02 — Horários e elegibilidade inconsistentes — alta

`monitor-visits` busca amanhã para o lembrete chamado 24h: não calcula exatamente 24 horas. Para o lembrete de 2h, considera uma janela entre 1h e 2h. Combina data sem fuso, `setHours`, `getHours` e datas UTC sem fuso de negócio explícito. Não filtra `deleted_at`; joins obrigatórios excluem visitas sem corretor ou empreendimento. Visitas reagendadas ficam fora dos lembretes, mas podem entrar no pós-visita.

Proposta: instante agendado com fuso definido, prazo persistido, política para agendamento de última hora e verificação de cancelamento/exclusão antes de cada envio. Ausência de corretor deve gerar pendência, não sumir da operação.

### VIS-03 — Envio pode ser registrado como sucesso sem sucesso real — alta

`monitor-visits.sendWhatsapp` não inspeciona o `error` retornado por `functions.invoke` e insere log com `status: sent`. A deduplicação consulta somente visita/tipo, sem separar destinatário e revisão. As consultas/insertions de log também não têm tratamento completo de erro. O filtro usa extração JSON `metadata->...`, que precisa ser validada/corrigida para comparação textual.

Proposta: fila por evento/destinatário, chave única, tentativas e estados distintos de enfileirado, aceito pelo provedor, entregue, lido e falha, conforme eventos disponíveis. Falha parcial deve repetir somente o destino pendente. Não prometer entrega exatamente uma vez sem suporte do provedor.

### VIS-04 — Pós-visita presume realização — alta

`processPostVisitFeedback` aguarda pelo menos 3h e pede feedback a cliente e corretor antes de confirmar realização. Considera hoje/ontem e exclui somente canceladas. Não atende à pergunta binária em até 2h nem à escalada por falta de resposta. Não foi localizado nas funções revisadas um coletor estruturado de nota/motivo ligado ao contexto pós-visita.

Proposta: confirmar ocorrência primeiro. SIM abre feedback humano e pesquisa de nota; NÃO abre motivo e recuperação; ausência de resposta abre pendência de apuração, sem classificar automaticamente como no-show.

### VIS-05 — Cancelamento e desistência estão misturados — alta

`handleLeadConfirmation` cancela a visita e marca o lead como `cancelado` ao receber NÃO. A negativa do corretor informa ao cliente que precisa reagendar sem esperar decisão de cobertura, mas mantém a visita elegível no estado atual.

Proposta: distinguir cancelamento, ausência do cliente, ausência do corretor, resultado desconhecido e desistência explícita. Troca de corretor/reagendamento seguem a decisão operacional a combinar.

### VIS-06 — Nota 0–10 incompatível com dados e formulário — alta

Banco remoto: `CHECK (avaliacao_lead >= 1 AND avaliacao_lead <= 5)`. Formulário: máximo 5; ao marcar realizada exige avaliação maior que zero e comentários. Modal transforma zero em null com `|| null`. WhatsApp já solicita nota 0–10.

Proposta: nota específica 0–10 com significado claro e zero válido; preservar escala histórica sem convertê-la silenciosamente. Realização deve poder ser registrada antes da avaliação do cliente.

### VIS-07 — Não existe pendência persistente do Closer — alta

A notificação atual é marcada como lida ao clicar e permite marcar todas como lidas. O painel limita a consulta às últimas 50. Isso não satisfaz a exigência de permanecer até reagendamento ou desistência.

Proposta: entidade de pendência com responsável, motivo, prazo e desfecho, separada do histórico de notificações; faixa destacada e lista operacional de todas as pendências abertas. Ler, fechar toast e limpeza de notificações não podem resolver a pendência.

### VIS-08 — Closer e grupo não são destinos completos do fluxo — alta

Foi encontrada configuração `admin_whatsapp`, mas nenhuma chave correspondente a Closer/grupo na busca em `system_settings`. Os handlers notificam admin somente em alguns eventos. O sender V2 normaliza destino como telefone e remove caracteres não numéricos; WAHA universal transforma destino em `@c.us`. Isso não constitui suporte consistente ao identificador de grupo `@g.us`.

Proposta: destinatário individual/grupo explícito; instância configurada e grupo selecionado por identificador. Cada evento de negócio deve produzir aviso independente ao Closer e ao grupo, com nova tentativa e falha visível. Não usar o grupo para respostas privadas do cliente.

### VIS-09 — Reagendamento não reinicia o ciclo de forma segura — alta

Edição no modal não reinicia flags de confirmação nem invalida logs/perguntas anteriores. Reutilizar a mesma visita pode conservar confirmações e deduplicação antigas.

Proposta alinhada ao pedido: Closer cria nova visita vinculada à anterior; histórico anterior permanece, mensagens antigas são invalidadas e a pendência só é resolvida após gravação bem-sucedida da nova visita vinculada. Uma visita não relacionada do mesmo lead não deve fechar a pendência.

### VIS-10 — Integrações precisam de contrato de dados — média/alta

No banco remoto, `auto_add_lead_to_crm` já cria oportunidade com `visita_id` e `process_crm_visit_automations` usa esse vínculo. O CRM externo possui condição de realizada + interesse e chave de idempotência. A planilha atual exporta corretores, não eventos de visitas; a escrita mostrada usa API key sem fluxo OAuth de escrita no código revisado. Não foi validada escrita real.

Proposta: definir CRM(s), planilha, abas, colunas, credencial de escrita e modo de atualização por identificador. Falha na planilha/CRM externo não desfaz realização nem impede os avisos internos.

## 5. Segurança, operação e qualidade

### Achados atuais

1. **Alta: duas partições públicas sem RLS**, `audit_logs_y2027m01` e `integration_logs_y2027m01`. Consultas confirmam permissão SELECT para anon e authenticated. Ambas estavam vazias. Isso confirma configuração insegura, não vazamento histórico. Revisar também a rotina que cria partições para evitar recorrência.
2. **Gate de dependências reprovado:** `nanoid`, severidade alta, `GHSA-2v37-7h3g-55p8`, reportado por `npm run audit:security`. A cadeia de dependência e a aplicabilidade precisam ser analisadas na remediação; não foi corrigido nesta etapa.
3. **Proteção de senhas vazadas desabilitada**, confirmada pelo advisor.
4. Advisor também lista descoberta GraphQL (69 objetos autenticados e 2 anônimos) e quatro funções SECURITY DEFINER executáveis por authenticated. As quatro definições foram lidas e exigem usuário + papel admin; o aviso isolado não demonstra bypass. RLS/grants precisam ser avaliados por objeto.
5. `monitor-visits` faz uma comparação redundante do segredo recebido consigo mesmo; há autorização interna real antes dela em `_shared/security.ts`. Não é correto classificar essa linha isolada como bypass de autenticação.
6. Há divergência entre o SQL histórico local de CRM e as definições atuais remotas, inclusive associação por `visita_id`. Antes de desenvolver migrations, reconciliar histórico e schema para preservar a evolução já implantada.

### Evidência operacional

- `memude-monitor-visits`: ativo, `*/15 * * * *`; 96 execuções SQL succeeded nas últimas 24h.
- `memude-message-queue`: ativo, a cada minuto; 1.440 execuções SQL succeeded no mesmo período.
- Respostas HTTP retidas em `net._http_response` nas últimas 6h: 1.007 com HTTP 200 e uma sem status. A consulta é agregada e não prova entrega de mensagens nem resultado específico de cada job.
- Nenhum log nos últimos 30 dias com os tipos exatos `reminder_24h`, `reminder_2h`, `post_visit_feedback` foi encontrado. Isso não exclui mensagens manuais ou com outros metadados.
- Uma visita não excluída, antiga; não há amostra operacional recente para mensurar resultados.

### Checks executados

| Check | Resultado |
|---|---|
| TypeScript | Passou |
| ESLint | Passou |
| Scanner de segredos versionados | Passou |
| Vitest unitário | 38 testes passaram |
| Build de produção | Passou |
| Testes do artefato/rotas | 28 testes passaram |
| Playwright público | 3 testes passaram: login, proteção de rota, 404 |
| Auditoria de dependências | Falhou: nanoid high |
| Fluxos autenticados / WhatsApp real | Não executados |

Portanto, `npm run check` como um todo falhou. Os testes aprovados não cobrem o fluxo de negócio proposto nem garantem o funcionamento ponta a ponta dos lembretes existentes.

## 6. Fluxo proposto para decisão

Todos os eventos de negócio abaixo devem informar o WhatsApp do Closer e o grupo. O painel mantém histórico, destino e situação de cada envio.

| Etapa | Ação | Exceção/pendência |
|---|---|---|
| SDR agenda | Registrar visita, responsável, imóvel, horário e fuso; avisar partes | Sem corretor/contato: avisar Closer |
| Véspera | Solicitar confirmação individual de cliente e corretor | Prazo sem confirmação: ação do Closer |
| Antes da visita | Relembrar horário, endereço e contato; confirmação conforme regra aprovada | Recusa: avisar imediatamente e abrir recuperação |
| Após horário agendado | Perguntar ao corretor “Houve a visita?” com SIM/NÃO | Botão vencido/visita ambígua não altera outra visita |
| SIM | Marcar realizada; criar coleta humana de feedback; solicitar nota ao cliente | Falta de nota não desfaz realização |
| NÃO | Registrar não realização; perguntar motivo; notificar Closer/grupo | Motivo posterior complementa histórico e gera novo aviso |
| Sem resposta no prazo | Avisar atraso ao Closer/grupo e abrir apuração | Não inventar realização nem ausência |
| Recuperação | Pendência destacada até nova visita vinculada ou desistência explícita | Ler aviso não encerra pendência |
| Nova visita | Preservar anterior e iniciar novo ciclo | Invalidar mensagens anteriores |
| Sincronização | Atualizar CRM e planilha com identificadores estáveis | Tentativas independentes, falha visível |

Horários aprovados: véspera + 2h antes; pergunta de ocorrência em T+1h; escalada em T+2h, onde T é o horário agendado. Janela regular 7h–20h; urgências sem restrição de horário. O detalhe de execução deve preservar prazos: um lembrete regular adiado não pode ser enviado depois da visita.

## 7. Desenho técnico preliminar

- Registro por visita de responsável operacional, revisão, fuso e ligação com visita anterior.
- Confirmação do cliente, confirmação do corretor, ocorrência, pesquisa e recuperação como estados separados.
- Histórico de eventos com ator, instante, origem e transição; impedir alterações concorrentes incompatíveis.
- Fila persistida de ações por prazo e fila de saída por evento/destinatário, com chave única, trava e recuperação após interrupção.
- Webhooks deduplicados pelo identificador do provedor; validar remetente e contexto antes de mudar estado. Resposta atrasada de uma visita não vale para a seguinte.
- Mudança de data/corretor/cancelamento invalida ações obsoletas. Checar estado novamente imediatamente antes do envio.
- Banco como fonte de verdade; CRM externo/planilha recebem projeções e podem recuperar atraso sem duplicar registros.
- Pendência do Closer com resolução validada no servidor; não depender de esconder/mostrar componente.
- Regras determinísticas para SIM/NÃO, prazos e nota. IA pode auxiliar resumo, sem decidir ocorrência ou desistência.
- Migração da automação antiga para a nova com chave de ativação e prevenção de execução simultânea. Não disparar mensagens retroativas indiscriminadamente.

## 8. Perguntas para o brainstorm

1. **Respondida:** ambiente correto; agendamentos ainda serão iniciados.
2. **Respondida:** Closer único, configurado pelo administrador. Vincular conta existente para o painel e telefone para WhatsApp; substituição futura via configuração.
3. **Respondida:** grupo selecionável em Configurações. Seleção deverá guardar identificador de grupo e instância, não somente nome.
4. **Respondida:** T+1h para pergunta, T+2h para alerta; T é o horário agendado. Janela 7h–20h; urgências a qualquer hora.
5. **Cadência respondida:** véspera e 2h antes. Tratar agendamentos com pouca antecedência sem disparar lembretes vencidos em sequência.
6. **Respondida:** Closer decide cobertura/reagendamento; silêncio mantém visita e abre pendência.
7. **Respondida:** CRM interno e aba VISITAS do arquivo identificado acima. Informar ao grupo e Closer cada passo por eventos resumidos vinculados à visita. Pendente: inspecionar integração existente do Apps Script.
8. **Respondida:** Closer registra interesse, objeções, próximo passo e prazo de retorno no sistema. Suporte a motivo em áudio é uma extensão ainda não definida.
9. No caso de “sem resposta”, quando o corretor depois confirma realização, isso resolve apenas a pendência de apuração? Para NÃO, manter a exigência de reagendar ou registrar desistência.
10. Nota do cliente: prazo, número máximo de cobranças e encaminhamento de nota baixa? Definir também discordância entre cliente e corretor sobre realização.

## 9. Critérios de aceite e sequência futura

Após as definições: reconciliar ambiente/schema e corrigir bloqueadores; modelar estados/permissões; implementar orquestração; integrar WhatsApp e painel; integrar CRM/planilha; validar em ambiente de teste e ativar gradualmente.

Cobrir: múltiplas visitas do mesmo corretor, resposta numérica de nota, webhook duplicado, resposta antiga, edição concorrente, cancelamento antes de envio, reagendamento, falta de corretor, exclusão lógica, prazo atravessando meia-noite, visita de última hora, indisponibilidade do provedor, entrega parcial, reinício do worker e planilha fora do ar. Validar botões no provedor real e uma alternativa textual inequívoca quando não disponíveis.

Indicadores: confirmação por parte, visitas realizadas, cancelamentos antecipados, no-show comprovado por motivo, resultado desconhecido, prazo de resposta do corretor, tempo de resolução do Closer, recuperação por reagendamento, notas e conversão em venda. Excluir visitas futuras dos denominadores de comparecimento; manter ocorrência desconhecida separada de ausência.

O brainstorm foi respondido antes do desenvolvimento. A implementação local e os passos de ativação estão descritos em `ATIVACAO_AUTOMACAO_VISITAS.md`.
