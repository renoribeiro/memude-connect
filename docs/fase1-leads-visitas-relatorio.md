# core.memude — Fase 1 (Leads e Visitas): relatório final

Execução: 17–18/11/2026 · Projeto Supabase `sistema-memude` (`oxybasvtphosdmlmrfnb`) · Fuso America/Fortaleza.

## 1. Resumo

- O core passou a ser o lugar único de leads e visitas: **grade de Leads** com edição na célula, **perfil do lead**, **modal Agendar visita** com rating de corretor, **painel da visita** com todo o ciclo (aceite → D-2/D-1/D0 → resultado → retorno/próximo passo → no-show/escalada → reagendar/cancelar), **mensagens prontas** (Copiar / Abrir no WhatsApp), **Agenda** (dia/semana/mês, arrastar = reagendar) e **tela Hoje** como primeira tela da equipe.
- Toda regra de negócio está no banco (RPCs transacionais com validação e checagem de papel); front e API usam as mesmas funções.
- O **robô de WhatsApp está em stand-by** desde 17/11 19:17 (nenhum worker rodou depois). Código, crons e histórico preservados; ligar/desligar em Ajustes › Automação antiga.
- A planilha virou **espelho**: fila gravada por trigger na mesma transação, envio a cada minuto em lote, retry com espera crescente, conferência noturna (03:30) e tela de sincronização. 2.607 registros enviados na carga inicial com 0 erros; conferência: 0 divergências, 0 ids duplicados.
- **Importação histórica**: 2.022 leads + 341 visitas da planilha, sem sobrescrever nada do core (207 conflitos registrados para decisão).
- Testes de aceite automatizados no banco: 16 de 17 itens aprovados (detalhes na seção 3).

## 2. Etapas

| Etapa | Status | Observação |
|---|---|---|
| 0 Reconhecimento | Concluída | Stack Vite/React/shadcn + Supabase; várias edge functions do robô só existem em produção (não estão no Git). |
| 1 Stand-by + dados | Concluída | Migrations `20261117185901` a `…191740`. |
| 2 Tela Leads | Concluída | `/leads` (a visão anterior ficou em `/leads/classico`). |
| 3 API extensão | Parcial | API `leads-api` pronta e publicada; o código da extensão não estava no repositório (ver pendências). |
| 4 Agendar + rating | Concluída | Rating 0–100 com motivo e disponibilidade. |
| 5 Ciclo e prazos | Concluída | Tarefas com dono e prazo; cron `fase1-prazos`. |
| 6 Mensagens | Concluída | 19 templates em `message_templates` (texto idêntico ao documento). |
| 7 Calendário + Hoje | Concluída | `/agenda` e `/hoje`. |
| 8 Espelho planilha | Concluída (proteção pendente) | `sheets-espelho` + crons. Proteção das abas adiada (seção 4). |
| 9 Importação + rating | Concluída | Ver seção 7. |
| 10 Testes de aceite | Concluída | Seção 3. |

**Commits:** não foram feitos. O Git desta máquina não tem identidade configurada e não tenho permissão para defini-la. Todos os arquivos estão no disco, fora do seu stage (ver Pendências › 1).

## 3. Testes de aceite

Executados no banco simulando Ramon e Lucas, dentro de transação desfeita ao final (nenhum dado de teste ficou gravado nem foi para a planilha), mais validação visual no navegador (desktop e celular).

- ✅ Mesmo telefone em 4 formatos gera um lead só e mostra aviso de duplicidade
- ✅* Lead da extensão aparece na tela Leads e na aba LEADS em até 2 minutos — a API usa a mesma RPC testada e o espelho roda a cada minuto; o teste ponta a ponta pela extensão depende da adaptação dela
- ✅ Editar célula salva sem abrir a ficha, gera histórico e entra na fila da planilha
- ✅ Agendar sugere 3 corretores com motivo; todos os campos podem ser alterados antes de salvar
- ✅ Local, endereço e bairro aparecem nas mensagens e na aba VISITAS (o bairro entra junto do [ENDEREÇO], pois não há variável própria)
- ✅ Corretor recusou mostra os próximos 3; sem resposta em 15 min gera alerta (tarefa vence em 15 min e fica vermelha)
- ✅ Cada etapa libera as mensagens certas, preenchidas, e "Abrir no WhatsApp" abre a conversa do número certo
- ✅ Visita para amanhã não gera D-2; visita para hoje só gera D0
- ✅ Tarefa vencida aparece em vermelho na Hoje do dono e em "Atrasados da equipe" para admin
- ✅ No-show libera "Escalar para Ramon" após 2 tentativas ou 72h
- ✅ Reagendar cria nova visita ligada à original, que fica "Reagendada" (e o card do funil não duplica)
- ✅ Visita criada/alterada aparece na aba VISITAS com id_visita, sem linha duplicada (conferência: 0 duplicados)
- ❌ Edição manual da aba VISITAS bloqueada — **adiado de propósito**: a extensão atual ainda grava na planilha; proteger agora quebraria a captura de leads da equipe. Botão pronto em Ajustes › Planilha › Proteger abas.
- ✅ Planilha fora do ar não perde registros: item volta para a fila com espera crescente (1, 2, 4… até 60 min) e "Reenviar" força o envio
- ✅ "Reconstruir aba" regrava a aba a partir do banco (faz uma cópia de segurança da aba antes)
- ✅ Com a automação em stand-by, nenhuma mensagem automática é enviada e nenhuma visita é criada sozinha (0 itens novos na fila do robô)
- ✅ Nenhuma etapa do funil muda por causa de uma visita

Achados corrigidos durante os testes: escalada ia para o próprio closer quando ele agendava; `authenticated` sem permissão de leitura em `visit_cycles`/`visit_events`; conferência limitada a 1.000 linhas; 28 linhas antigas do robô com `id_visita` inexistente não eram importadas; `LEAST(NULL, 1)` dava conversão de 100%; estouro de layout em larguras médias.

## 4. Decisões tomadas sozinho

1. **Papéis:** o sistema permite um papel por usuário (índice único). Lucas continua **admin** (superconjunto de closer, para não perder acessos) e é o closer via `fase1_config.closer_user_id`. Ramon continua admin. `sdr` e `closer` existem no enum para novas contas.
2. **Responsável** é uma lista configurável (`fase1_config.responsaveis`), hoje só Ramon — Emilly não tem conta.
3. **Duplicados históricos:** nunca mesclados; o mais novo de cada grupo recebe `telefone_chave_conflito` para permitir o índice único. Fluxos legados (IA, webhooks) que tentarem duplicar são sinalizados em vez de quebrar.
4. **Status da visita** em `visitas.status` (texto) e resultado em `visit_cycles.outcome` com o vocabulário existente: Realizada=`held`, No-show=`not_held`, Cancelada=`cancelled`, Reagendada=`rescheduled`.
5. **Convites:** tabela nova `visita_convites` (a `visit_match_attempts` é acoplada ao robô).
6. **Nota do cliente** reaproveita `visitas.avaliacao_lead` (já era 1–5); impressão = `comentarios_lead`; retorno do corretor = `feedback_corretor`.
7. **Rating** em colunas novas (`corretores.rating_score/rating_detalhe`), pois `nota_media` é a nota manual em estrelas. Conversão = vendas do mesmo lead de uma visita realizada ÷ visitas realizadas. Critérios sem dados têm o peso redistribuído entre os demais (generalização da regra do documento). "Closer MeMude" não entra nas sugestões. Métricas de aceite são recalculadas por cron (a proteção que impede não-admin de alterar métricas do corretor foi mantida).
8. **Guardas no robô** (definições originais salvas em `backup_20261117.function_defs`): com o robô em stand-by — ou em operações da Fase 1 — os triggers do robô e os que moviam o funil não agem. Mesmo se religado, o robô ignora visitas da Fase 1 e as importadas.
9. **Reagendamento** reaproveita o card do funil (aponta para a visita nova, mesma etapa) em vez de criar outro.
10. **Espelho:** casa linhas por id e, sem id, pela chave do telefone (+ data, em visitas), o que evita duplicar as 2.107 linhas antigas. Nunca escreve nas colunas J e L nem em colunas sem correspondência. Datas interpretadas só porque a planilha está em pt-BR; valores iniciados por `= + - @` são neutralizados.
11. **Importação:** valores que o core não representa (status fora da lista, empreendimento/corretor/responsável não encontrados, colunas extras) ficam em `planilha_extra` e o espelho reescreve exatamente esse texto. Status históricos foram mapeados para o resultado real (ex.: "Lead furou" → No-show, "Cancelado" → Cancelada, "Comprou"/"VENDEMOS" → Realizada), mantendo o texto original na planilha. Importação feita sem disparar o robô nem criar cards no funil.
12. **Reconstruir aba** não apaga linhas órfãs (só atualiza/insere e reporta), e cria cópia da aba antes.
13. **Proteção das abas** adiada até a extensão ser adaptada (seção 3).
14. **[LOCAL]** = nome do local + endereço + bairro; **[LINK DO EMPREENDIMENTO]** = `https://memude.com.br/?p=<wp_post_id>`.

## 5. Banco

- Backup: schema `backup_20261117` (leads, visitas, visit_cycles, corretores, user_roles, visit_automation_config, function_defs, visitas_importadas_pre_ajuste).
- Migrations (24): `supabase/migrations/20261117185901_…` a `20261117200702_…` — SQL idêntico ao aplicado.
- Tabelas novas (todas com RLS): `lead_eventos`, `visita_convites`, `tarefas`, `fase1_config`, `import_conflitos`, `sheet_sync_queue`, `sheet_sync_execucoes`; view `leads_duplicados`.
- Colunas novas: `leads` (telefone_chave, telefone_exibicao, telefone_chave_conflito, status_atendimento, fonte, responsavel_id, data_entrada, planilha_extra); `visitas` (local_nome, criado_por, motivo_cancelamento, proximo_passo, data_venda, tentativas_remarcar, ultima_tentativa_remarcar, no_show_em, escalada_em, fase1, planilha_extra); `visit_events.ator_id`; `corretores` (rating_score, rating_detalhe, rating_calculado_em, sugerir_em_visitas).
- Crons novos: `fase1-planilha-espelho` (1 min), `fase1-planilha-conferencia` (03:30), `fase1-prazos` (1 min), `fase1-corretor-metricas` (10 min).
- Edge functions novas: `leads-api`, `sheets-espelho` (código em `supabase/functions`).
- **Reverter:** `supabase/rollback/fase1_reverter.sql` (para os crons novos, restaura as funções originais, remove os triggers novos e religa o robô; tabelas/colunas novas são aditivas e podem ficar).

## 6. Automação em stand-by

- Desligado: `visit_automation_config.enabled = false` e `intake_enabled = false` (0 visitas futuras do robô e 0 mensagens pendentes no momento do desligamento). Último worker do robô: 17/11/2026 19:17.
- Religar: Ajustes comerciais › Automação antiga (admin), ou `update visit_automation_config set enabled = true, intake_enabled = true where id;`.
- `memude-visit-sheets` parou junto (usa a mesma chave), sem lacuna: não havia nada pendente e o espelho novo assumiu e regravou tudo.

## 7. Números

- Duplicados: 8 grupos (16 leads) antes da importação; hoje 9 grupos (18 leads) — lista em Ajustes › Duplicados.
- Importação LEADS: 2.107 linhas → 2.022 criados, 83 já existiam com diferenças, 2 idênticos, 20 duplicadas na própria planilha, 0 erros.
- Importação VISITAS: 352 linhas → 341 criadas (317 + 24 órfãs do robô), 3 vinculadas a existentes, 6 sem telefone (linhas 40, 41, 86, 147, 214, 257), 3 recusadas por conflito de agenda (linhas 280, 282, 295), 2 duplicadas.
- Conflitos em `import_conflitos`: 207 (Entrada 78, Status 50, Nome 41, Fonte 31, Empreendimento 4, erros 3).
- Totais hoje: 2.280 leads ativos, 343 visitas.
- 114 visitas importadas sem corretor identificado. Nomes da planilha sem correspondência (top): Emanoel 12, André Gurgel 12, Emygdio 9, Roberto Parente 4, Reno Ribeiro 4, André 4, João Vítor 3, Dominique 3 (+ ~35 nomes com 1–2 visitas e valores como "Analisando", "À DEFINIR").
- Rating inicial (geral, sem aderência; aceite e nota ainda sem dados, peso redistribuído): Ricardo Machado 7,1 (3 vendas, 14 realizadas) · Lucas Moura de Castro 1,8 (1/56) · Talma 1,4 · Reno Alencar 1,4 · Emanuel 1,4 · Maria da Conceição 0 · Juliana 0 · Soraya 0 (2 vendas em leads diferentes dos visitados) · Serginho 0. Na sugestão de uma visita, a aderência ao empreendimento passa a pesar (ex.: Mirante Messejana → Ricardo 46,9 com "1 venda no Mirante Messejana").

## 8. Pendências com você

1. **Commitar** (não tive permissão para definir a identidade do Git): `git add src/lib/comercial src/hooks/comercial src/components/comercial src/pages/comercial supabase/functions/_shared/fase1-*.ts supabase/functions/leads-api supabase/functions/sheets-espelho supabase/migrations/20261117* supabase/rollback docs/fase1-leads-visitas-relatorio.md src/App.tsx src/pages/Index.tsx src/hooks/useAuth.tsx src/components/auth/ProtectedRoute.tsx src/components/layout/DashboardLayout.tsx src/integrations/supabase/types.ts` e commitar. Atenção: `App.tsx` e `useAuth.tsx` já tinham alterações suas em stage (endurecimento de rotas e de papéis) que entram juntas.
2. **Criar a conta da Emilly** (papel SDR) e depois, em Ajustes › Importação, vincular os 1.286 leads "Emilly/Emily" a ela; incluí-la em Ajustes › Prazos e rating › Responsáveis.
3. **Extensão do WhatsApp Web:** copiar a pasta para `whatsapp-extension/` neste projeto. O que muda nela: login com usuário do core (Supabase Auth) e troca do destino da planilha para `GET/POST https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/leads-api` (`?recurso=opcoes` para listas; `?telefone=` para consultar; `POST {nome, telefone, empreendimento_id, fonte, status, responsavel_id, observacao}`; 409 = "Lead já cadastrado" com link da ficha).
4. **Proteger as abas** (Ajustes › Planilha › Proteger abas) quando a extensão estiver adaptada e a equipe usando o core.
5. **Revisar** os 207 conflitos, os 9 grupos de duplicados, os 114 corretores não identificados e os status fora da lista (ex.: "VENDIDO!", "REATIVADO").
6. **Lucas** continua admin; se quiser restringir a closer, troque o papel em Gestão de Usuários.
7. Mapear manualmente, se quiser, as colunas de LEADS sem correspondência (Último Contato, Feedback, Mala Direta, 1º–4º Contato) — hoje ficam intactas na planilha e preservadas no core.
8. As edge functions do robô (`visit-sheets-worker`, `monitor-visits`, `visit-intake-worker` etc.) só existem em produção; vale trazê-las para o Git.

## 9. Como usar

- **Hoje** (`/hoje`, primeira tela de Ramon e Lucas): tarefas do dia por bloco, vencidas em vermelho no topo, ação direto no item.
- **Leads** (`/leads`): clique na célula para editar; nome abre a ficha; ícone de calendário agenda visita; "+ Lead" checa o telefone enquanto você digita.
- **Agenda** (`/agenda`): dia/semana/mês, filtros, arraste para reagendar.
- **Painel da visita**: abre de qualquer tela (link compartilhável `?visita=`): Andamento, Mensagens, Histórico.
- **Ajustes comerciais** (`/comercial/ajustes`, admin): pesos e prazos, equipe, planilha, duplicados, importação, robô.

Roteiro rápido de teste para a equipe:
1. Ramon: Leads › "+ Lead" com um número já existente → deve aparecer "Lead já cadastrado".
2. Ramon: agende uma visita, envie MSG 1/2/2A pelo painel, marque "SIM, aceitou" e envie 2B/3/4.
3. Ramon: veja D-2/D-1 aparecerem na Hoje no dia certo e registre a confirmação.
4. Lucas: no dia, confirme o D0, registre Realizada e preencha o retorno; ou No-show → 2 tentativas → Escalar.
5. Confira a linha na aba VISITAS em até 1 minuto.

---

# Fase 2 (18/11/2026): carga do banco, relatórios automáticos, identidade visual e menu

## O que mudou

**Banco e sincronização (evitar lotar o banco de novo)**
- Planilha atualizada **uma vez por dia às 17h30** (repescagem às 17h45 se sobrar fila). Antes era a cada minuto.
- Conferência noturna automática pausada (a equipe ainda edita a planilha pela extensão). O botão manual continua em Ajustes › Planilha.
- 4 crons do robô em stand-by pausados (não apagados). A chave "Automação antiga" religa os quatro.
- `fase1-prazos` passou de 1 min para 15 min; `fase1-corretor-metricas`, de 15 min para 1 h.
- Faxina diária `fase1-limpeza` (06h10 UTC): apaga itens da fila já enviados há mais de 15 dias e execuções com mais de 90 dias.
- Respostas HTTP temporárias do pg_net (238 MB de inchaço) truncadas. **Banco: 342 MB → 104 MB.**
- A fila da planilha tem uma entrada aberta por registro, então editar o mesmo lead 50 vezes gera 1 item.

**Relatórios automáticos (substituem os fluxos do n8n)**
- Edge function `relatorios-automaticos` com o mesmo conteúdo do n8n, nas cores da marca:
  - Boletim diário: seg–sex às 17h00, e-mail e texto de WhatsApp idêntico.
  - Relatório semanal: sexta às 17h30, e-mail com gráficos.
- Mesmos 4 destinatários. Mesma fonte de dados (planilha), trocável para "Sistema" quando a extensão gravar no core.
- Trava contra duplicidade: no máximo um envio real por relatório, dia e canal, mesmo que o cron e o botão rodem juntos.
- Tela em **Relatórios › Envios automáticos**: liga/desliga, dias, horário, destinatários, canais, meta de visitas, remetente, prévia, teste e histórico.
- WhatsApp pronto: instância `memude-visitas` conectada, grupo já preenchido; basta ligar o canal no Boletim diário.
- A aba "Agendados" antiga (que nunca enviava e-mail) saiu do caminho; agendamentos antigos só aparecem se existirem.

**Interface**
- Cores: roxo #422f91 (principal) e rosa #e92662 (destaque) no tema inteiro; verde ficou só para "sucesso".
- Menu lateral agrupado:
  - Itens soltos: Hoje, Dashboard, Agenda.
  - SDR ▸ Leads, Visitas, CRM. Closer ▸ CRM, Corretores, Vendas, Visitas.
  - Itens soltos: Empreendimentos, Gestão de Usuários.
  - Relatórios ▸ Visão geral, Analytics, Envios automáticos.
  - Configurações ▸ Agentes de IA, Monitoramento, Sincronização WP, Ajustes comerciais, Comunicações, Configurações gerais.
  - O grupo da tela atual abre sozinho, o estado fica salvo e o celular usa o mesmo menu.
- Barra de rolagem horizontal sempre visível: tabelas e Kanban do CRM ganharam uma barra que fica presa no rodapé da tela.
- Leads: botão "Novo lead" e "visão anterior" movida para o menu de colunas. Ajustes › Planilha explica o horário diário.

## Pendências com você
1. **Verificar o domínio no Resend (bloqueia o e-mail).** A chave existe, mas nenhum domínio está verificado (memude.com.br e memude.com recusados).
   - No Resend: Domains → Add domain → `memude.com.br`, depois copie os registros SPF/DKIM para o DNS e aguarde "Verified".
   - Depois disso: Relatórios › Envios automáticos › "Enviar teste para mim".
2. **n8n**: mantenha os dois fluxos ligados até o teste do item 1 dar certo e então desative-os. Enquanto o domínio não for verificado, o envio do Connect falha e fica registrado no histórico, sem duplicar.
3. **n8n**: verifique se ficou salvo um fluxo em branco aberto por engano (id `1e0VevXdkLchxdiF`); se sim, pode apagar.
4. **WhatsApp do boletim**: quando quiser, ligue o canal no card do Boletim diário (a instância já está conectada).
5. **Commits**: tudo segue sem commit (Git sem identidade nesta máquina).
6. **Extensão**: não foi alterada; continua gravando só na planilha.

## Crons antigos reduzidos (autorizado em 18/11/2026)
Nenhum teve atividade nos últimos 30 dias. Migration `20261118144115_reduz_crons_ociosos`; reversão no item 9 do rollback.

| Cron | Antes | Agora |
|---|---|---|
| crm-archive-completed-monthly | a cada 1 min | 1x/dia, 00h05 |
| memude-message-queue | a cada 1 min | a cada 5 min |
| memude-distribution-timeouts | a cada 2 min | a cada 10 min |
| memude-ai-followups | a cada 5 min | a cada 30 min |
| memude-scheduled-reports | de hora em hora | pausado |

Se os Agentes de IA ou a distribuição automática de leads voltarem a ser usados, devolver `memude-message-queue` para 1 min e `memude-distribution-timeouts` para 2 min.

## Sugestões (não aplicadas)
- Ativar "Leaked password protection" no Supabase Auth.
- Antes de criar conta para SDR/closer não-admin, revisar o acesso de Visitas, CRM e Vendas (hoje só admin abre essas telas; o menu já esconde o que o papel não pode abrir).
