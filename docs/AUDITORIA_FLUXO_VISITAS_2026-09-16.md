# Auditoria completa do fluxo de visitas — 16/09/2026

## Parecer executivo

**O fluxo ainda não atende ao padrão 10/10.** A base funciona nos cenários já testados, mas esta revisão encontrou **20 pontos de ajuste: 13 de prioridade alta (P1) e 7 de prioridade média (P2)**. A contagem reúne erros comprovados, riscos de confiabilidade e lacunas de homologação; não representa 20 incidentes ocorridos em produção.

Não atribuo uma nota numérica arbitrária. O critério de excelência será o cumprimento dos testes e dos requisitos de liberação deste relatório. “Estado da arte” aqui significa decisões corretas, transações consistentes, recuperação de falhas, segurança verificável e experiência compreensível.

Os pontos mais urgentes são respostas antigas alterando decisões recentes, divergência entre estados, avanço incompleto do CRM, controle de conflitos desigual entre canais e falta de reconciliação da entrega das mensagens.

**Escopo desta rodada:** inspeção, testes locais isolados e consultas de produção. Não foram aplicadas correções, migrations ou publicações nesta auditoria, nem criadas visitas reais. A automação permanece no estado em que estava: ativada. O aviso administrativo da auditoria ao Closer/grupo é separado dos testes de negócio.

## 1. Método, evidências e limites

### Componentes revisados

- Entrada Evolution, extração de mensagens, remetentes, respostas citadas e roteamento.
- Parser, IA, sugestões, contatos, cadastros e criação transacional.
- Tabelas, RPCs, triggers, permissões e cron dos dois fluxos.
- Cadastro/edição manual, conflito, confirmação, ocorrência, recuperação, feedback e avaliação.
- Filas de saída, retentativas, Google Sheets e comunicação de pendências.
- CRM: gatilhos reais, funil padrão e automações configuradas.
- Painéis administrativos, formulários existentes e testes.

### Verificação executada nesta rodada

| Verificação | Resultado |
|---|---|
| `npm run check` | Aprovado: TypeScript, ESLint, busca de segredos, testes, build, rotas e auditoria de dependências |
| Testes unitários | 49 aprovados |
| Testes PostgreSQL isolado | 18 do ciclo + 16 do agendamento aprovados |
| Testes de rotas | 28 aprovados |
| Playwright: smoke + acompanhamento | 5 aprovados; cenários de acompanhamento usam backend simulado |
| Sondas adicionais desta auditoria | Reproduziram divergências de estado, resposta antiga cancelando confirmação e ausência de adoção após pausa |
| RPCs novas acessíveis indevidamente a anon/authenticated | Zero na consulta de privilégios |
| Produção: ciclos / solicitações | Zero / zero na leitura; ainda sem percurso operacional real registrado |
| Visitas futuras sem ciclo | Zero no momento da leitura; o defeito de pausa foi reproduzido localmente |
| Funil padrão | Funil 2026, inclusão automática habilitada |
| Regras de avanço por status de visita | Nenhuma configurada |
| Cron | Dois jobs ativos, a cada minuto; execuções SQL bem-sucedidas observadas |
| Respostas HTTP recentes compatíveis com workers | 47 respostas HTTP 200 na amostra de 30 minutos, com filas vazias |
| Partições de logs sem RLS e com SELECT anônimo | Duas, ambas vazias na consulta |

Cron com status “succeeded” comprova execução do SQL, não a entrega da mensagem. As respostas HTTP são evidência adicional, mas ainda não comprovam processamento sob carga.

**Versões observadas:** frontend Vercel `dpl_2xMZdC85hLi3CCXmTNconwRWsoo5`, READY; Evolution webhook v83; monitor-visits v20; visit-lifecycle v4; visit-intake-worker v2; WAHA webhook v17, todos ACTIVE.

**Limites:** não houve teste destrutivo, envio a clientes/corretores reais, teste de carga na produção, pentest amplo ou leitura integral dos dados da planilha. Não foi feita certificação de cada formato do aplicativo WhatsApp. O código local foi revisado e confrontado com configuração, funções SQL relevantes e versões publicadas; isso não equivale a comparar byte a byte todos os bundles remotos. Não há evidência suficiente para declarar toda a jornada homologada no aparelho.

Reprodução local adicional: [scripts/audit-visit-flow.mjs](../scripts/audit-visit-flow.mjs). Executar `node scripts/audit-visit-flow.mjs`. O script cria apenas um banco PGlite isolado; as saídas descrevem o comportamento atual e não significam testes de regressão aprovados. O cenário de realização após recusa do corretor **funcionou**, portanto não foi classificado como defeito.

## 2. O que está correto e deve ser preservado

- Criação de lead/visita em transação e deduplicação de mensagens de entrada.
- Separação da interpretação por IA das funções que gravam os dados.
- Confirmação humana para correspondências ambíguas e decisão do Closer para o conflito da entrada pelo grupo.
- Referências e revisão para evitar alterações de solicitações antigas.
- Silêncio não cancela a visita.
- Motivo de não realização não encerra sozinho a recuperação.
- Reagendamento cria nova visita vinculada; histórico é preservado no caminho específico.
- Nota zero aceita no novo ciclo; feedback do Closer separado da pesquisa do cliente.
- Nova área de dados restrita ao backend; autenticação administrativa baseada em user_roles.
- Alternativa textual para perguntas quando os botões não são aceitos pelo provedor.

## 3. Índice priorizado dos ajustes

P1: corrigir antes de ampliar o uso operacional. P2: concluir antes da homologação de excelência. Nenhuma classificação implica exploração ou incidente comprovado.

| ID | Prioridade | Ponto |
|---|---|---|
| A01 | P1 | [Resposta antiga pode cancelar uma confirmação mais recente](#a01) |
| A02 | P1 | [Cadastro da visita e acompanhamento podem divergir](#a02) |
| A03 | P1 | [CRM não avança automaticamente pelo resultado da visita](#a03) |
| A04 | P1 | [Falha de entrega posterior ao aceite não chega às novas filas](#a04) |
| A05 | P1 | [Timeout após envio pode duplicar mensagens](#a05) |
| A06 | P1 | [Fila compartilhada pode atrasar avisos urgentes](#a06) |
| A07 | P1 | [Regra de conflito é aplicada somente à entrada pelo grupo](#a07) |
| A08 | P1 | [Visitas criadas durante pausa ficam fora da automação após retomada](#a08) |
| A09 | P1 | [Silêncio do corretor não tem resolução administrativa completa](#a09) |
| A10 | P1 | [Telefone aceito no cadastro pode não ser usado nos lembretes](#a10) |
| A11 | P1 | [Mudanças no local e nos contatos não invalidam dados já preparados](#a11) |
| A12 | P2 | [Janela 7h–20h torna o lembrete de 2h imprevisível em horários de borda](#a12) |
| A13 | P2 | [Correções e cancelamentos de solicitações podem ser ignorados sem retorno](#a13) |
| A14 | P2 | [Tratamento das respostas e botões ainda tem lacunas de contrato](#a14) |
| A15 | P2 | [Falhas e solicitações travadas têm pouca visibilidade operacional](#a15) |
| A16 | P2 | [Avaliação e feedback coexistem em modelos distintos](#a16) |
| A17 | P2 | [IA e busca de candidatos precisam de avaliação e rastreabilidade](#a17) |
| A18 | P2 | [Planilha ainda precisa de prova de sincronização completa e reconciliação](#a18) |
| A19 | P1 | [Partições de logs continuam com leitura anônima e sem RLS](#a19) |
| A20 | P1 | [Cobertura atual não demonstra o fluxo real completo](#a20) |

## 4. Achados e plano individual

<a id="a01"></a>

### A01 — Resposta antiga pode cancelar uma confirmação mais recente (P1)

**Evidência:** Reproduzido em PostgreSQL isolado: criar perguntas eve e h2; responder SIM em h2; depois NÃO em eve. Resultado: outcome=cancelled, client_confirmed=false. Ambas pertencem à mesma revision. `visit_lifecycle_reply` verifica revisão e expiração, mas não a ordem das perguntas/respostas.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:203](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** Uma mensagem atrasada pode cancelar uma visita válida e disparar recuperação e avisos indevidos.

**Plano de ajuste:** Criar sequência lógica por visita e destinatário e registrar a pergunta vigente. Ao aceitar uma confirmação, invalidar perguntas anteriores equivalentes. Resposta antiga deve retornar resultado explícito “pergunta substituída”, sem alterar o ciclo. Separar mudança deliberada de decisão de resposta atrasada.

**Critério de aceite:** Enviar SIM de h2 seguido de NÃO de eve, em ordem inversa, repetido e concorrente: o evento obsoleto nunca altera a decisão vigente. A mudança intencional usa ação atual e fica auditada.

<a id="a02"></a>

### A02 — Cadastro da visita e acompanhamento podem divergir (P1)

**Evidência:** Reproduzido: mudar horário mantém lead_confirmou/corretor_confirmou=true em visitas, mas zera as confirmações em visit_cycles. Reabrir realizada para agendada mantém outcome=held. Desistir após recusa do corretor deixa visitas.status=agendada e outcome=withdrawn. O formulário permite editar status diretamente.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:142](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** Lista, calendário, automação e relatórios passam a representar situações diferentes; lembretes e indicadores tornam-se inconsistentes.

**Plano de ajuste:** Centralizar transições em comandos transacionais, definir tabela explícita de estados permitidos e sincronizar projeções na mesma transação. Fazer o formulário chamar esses comandos. Bloquear reabertura de ciclo terminal por UPDATE genérico; exigir novo ciclo vinculado ou correção administrativa auditada. Preparar consulta de reconciliação antes de reparar registros.

**Critério de aceite:** Para cada comando, afirmar invariantes entre status, outcome e confirmações. Cobrir edição manual, desistência, exclusão/restauração e reagendamento; nenhum caminho mantém confirmação antiga para horário novo.

<a id="a03"></a>

### A03 — CRM não avança automaticamente pelo resultado da visita (P1)

**Evidência:** Consulta remota: Funil 2026 é padrão e auto_add_visits=true, portanto a oportunidade é criada. Contudo, não há regras em crm_automations com trigger_type=visit_status_change. A função process_crm_visit_automations depende dessas regras. O novo fluxo também não atualiza o status de um lead existente ao cadastrar a visita pelo grupo.

**Local:** [supabase/migrations/20260916223850_whatsapp_visit_intake.sql:153](../supabase/migrations/20260916223850_whatsapp_visit_intake.sql)

**Impacto:** A oportunidade entra no CRM, mas realização/cancelamento não move o cartão automaticamente. Leads preexistentes podem permanecer com status comercial antigo. Não é correto dizer que toda a alimentação do CRM está concluída.

**Plano de ajuste:** Mapear os estágios reais do funil; definir agendada, confirmada, realizada, recuperação e desistência sem presumir que cancelar visita significa perder lead. Persistir regras versionadas e garantir que reagendamento mantenha vínculo entre oportunidades. Sincronizar status do lead por política explícita que considere outras visitas/oportunidades abertas.

**Critério de aceite:** Teste com os gatilhos e regras reais do CRM: novo lead, lead existente, visita realizada, não realizada, reagendada e desistência. Verificar stage_id, visita_id e que outra oportunidade ativa não seja encerrada indevidamente.

<a id="a04"></a>

### A04 — Falha de entrega posterior ao aceite não chega às novas filas (P1)

**Evidência:** O worker marca sent após resposta HTTP bem-sucedida da Evolution. O ramo messages_update do webhook atualiza communication_log e tentativas de distribuição; não atualiza visit_outbox nem visit_intake_outbox por provider_id. A deduplicação em memória usa somente messageId, compartilhado entre tipos de evento, e pode suprimir atualizações próximas.

**Local:** [supabase/functions/evolution-webhook-handler/index.ts:74](../supabase/functions/evolution-webhook-handler/index.ts)

**Impacto:** O painel pode continuar mostrando aceite mesmo quando o provedor comunica erro posterior. O grupo ou Closer pode ficar sem aviso sem que apareça falha recuperável.

**Plano de ajuste:** Separar accepted, delivered, read, failed e unknown; consumir recibos por instância+provider_id, com progressão monotônica e eventos deduplicados por tipo/versão. Atualizar ambas as filas; para erro recuperável, abrir nova tentativa controlada e pendência operacional. Preservar a distinção entre aceite e entrega.

**Critério de aceite:** Reproduzir upsert e múltiplos updates para o mesmo ID, fora de ordem e repetidos. Um erro posterior precisa aparecer no painel; delivered/read não pode retroceder por recibo antigo.

<a id="a05"></a>

### A05 — Timeout após envio pode duplicar mensagens (P1)

**Evidência:** Nos dois workers, erro/timeout de fetch leva a nova tentativa. Se a Evolution aceitou a mensagem antes de a resposta se perder, o banco não guarda provider_id e reenviará. O comentário que evita fallback de botões em timeout não elimina a duplicação na tentativa seguinte. Trata-se de risco demonstrável pela sequência, ainda não reproduzido com o provedor real.

**Local:** [supabase/functions/_shared/visit-lifecycle.ts:162](../supabase/functions/_shared/visit-lifecycle.ts)

**Impacto:** Cliente e corretor podem receber perguntas repetidas; grupo e Closer recebem avisos duplicados. Não existe garantia de envio exatamente uma vez.

**Plano de ajuste:** Persistir tentativa antes da chamada, classificar resultado ambíguo como unknown, usar chave idempotente se suportada pela versão instalada e reconciliar recibos/consulta ao provedor antes de reenviar. Se não houver reconciliação confiável, expor decisão de reenvio e a possibilidade de duplicidade.

**Critério de aceite:** Simular “provedor aceitou, conexão caiu” e queda antes/depois do commit local. A retomada deve reconciliar o envio ou indicar incerteza, sem reenvio automático cego.

<a id="a06"></a>

### A06 — Fila compartilhada pode atrasar avisos urgentes (P1)

**Evidência:** visit_lifecycle_claim reserva um único lote global de até 10 itens por 10 minutos. runVisitLifecycle processa tudo sequencialmente, inclusive Google Sheets. Cada sincronização faz várias chamadas de até 15 s; avisos urgentes novos não entram enquanto houver item com reserva ativa. Cada pergunta enviada gera outros três itens de acompanhamento.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:300](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** Uma lentidão na planilha ou uma execução interrompida pode atrasar confirmações e a cobrança de T+2h. A arquitetura atual não demonstra capacidade para o SLA desejado.

**Plano de ajuste:** Separar filas/consumidores de WhatsApp urgente, WhatsApp regular e Sheets. Usar exclusão por visita/linha na planilha, sem bloquear mensagens de outras visitas. Dimensionar concorrência e reserva ao tempo real, com heartbeat e recuperação. Medir idade da fila, tempo de resposta e atrasos de prazo.

**Critério de aceite:** Induzir Sheets lento e indisponível com 100 visitas no teste de carga. Aviso urgente deve respeitar meta definida (proposta: aceite pelo provedor em até 60 s no percentil 95, com provedor saudável), independentemente da planilha.

<a id="a07"></a>

### A07 — Regra de conflito é aplicada somente à entrada pelo grupo (P1)

**Evidência:** A comparação 60+30 está em visit_intake_finish. O formulário grava visitas diretamente; reschedule e replace_broker não usam essa validação. O trigger visit_lock_broker apenas bloqueia a linha do corretor durante a transação, sem rejeitar sobreposição.

**Local:** [supabase/migrations/20260916223850_whatsapp_visit_intake.sql:200](../supabase/migrations/20260916223850_whatsapp_visit_intake.sql)

**Impacto:** Um horário protegido no WhatsApp pode ser ocupado pelo cadastro manual, por reagendamento ou substituição. A liberação especial do Closer perde consistência entre canais.

**Plano de ajuste:** Extrair serviço/RPC único de disponibilidade usado por todos os canais, incluindo distribuição. Validar intervalo semiaberto, visitas ativas e 60+30 sob o mesmo bloqueio transacional. Manter exceção explícita do Closer com motivo, identidade e conjunto de conflitos aprovado; evitar uma constraint de exclusão que impeça essa exceção legítima.

**Critério de aceite:** Duas criações concorrentes, manual versus grupo, troca de corretor, reagendamento, visitas às 16h/17h/17h30 e conflito que aparece após a primeira aprovação. Sem exceção expressa, não permitir sobreposição.

<a id="a08"></a>

### A08 — Visitas criadas durante pausa ficam fora da automação após retomada (P1)

**Evidência:** Reproduzido: enabled=false; criar visita futura; enabled=true; executar tick. hasCycle=false. visit_capture não cria ciclo com automação desligada e tick consulta apenas ciclos existentes. Em produção não havia visitas futuras nessa situação no momento da consulta.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:136](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** Após manutenção/pausa, visitas legítimas podem ficar sem lembretes e pós-visita silenciosamente.

**Plano de ajuste:** Separar captura de eventos de autorização para enviar. Registrar visitas mesmo pausado e adotar ciclos pendentes ao retomar, com prévia da quantidade e política para lembretes já vencidos. Nunca disparar automaticamente histórico antigo em massa; limitar recuperação a visitas elegíveis e registrar o que foi omitido.

**Critério de aceite:** Criar/editar/cancelar durante pausa e retomar antes e depois do horário. Toda visita elegível deve ter ciclo, sem lembrete expirado e sem duplicar eventos anteriores.

<a id="a09"></a>

### A09 — Silêncio do corretor não tem resolução administrativa completa (P1)

**Evidência:** O painel mostra attendance_overdue, mas não oferece ação de apuração SIM/NÃO pelo Closer. visit_lifecycle_action tem feedback, withdraw, reschedule e replace_broker, sem registrar ocorrência. Silêncio mantém recovery_open=false; reschedule/withdraw exigem recovery_open=true. A pergunta expira após sete dias.

**Local:** [src/components/visitas/VisitFollowup.tsx:78](../src/components/visitas/VisitFollowup.tsx)

**Impacto:** Se o corretor não responder ou estiver sem acesso ao número, o Closer precisa recorrer a edição indireta e não consegue concluir todos os desfechos pelo painel de acompanhamento.

**Plano de ajuste:** Adicionar ação administrativa “Registrar resultado apurado”, com realizada/não realizada, origem da apuração e motivo, protegida por versão e auditoria. Ela deve gerar os mesmos eventos, avaliação ou recuperação da resposta do corretor. Tratar correção posterior por evento compensatório; silêncio nunca vira no-show automaticamente.

**Critério de aceite:** Corretor não responde por mais de duas horas e por sete dias; Closer consegue registrar qualquer desfecho autorizado, preservando histórico, alertas e atualização do CRM/planilha.

<a id="a10"></a>

### A10 — Telefone aceito no cadastro pode não ser usado nos lembretes (P1)

**Evidência:** inspectVisitIntake aceita corretores por whatsapp ou telefone (alternatePhone). Porém visitSnapshot, private.visit_prompt e o envio regular consultam somente whatsapp. Se o corretor tem telefone válido e whatsapp vazio, pode ser escolhido e cadastrado, mas a pergunta não é criada ou o envio é marcado obsolete.

**Local:** [supabase/functions/_shared/visit-intake.ts:83](../supabase/functions/_shared/visit-intake.ts)

**Impacto:** O agendamento parece completo, mas o corretor não recebe confirmação ou pergunta de realização. A falta de destino pode passar sem erro explícito.

**Plano de ajuste:** Definir telefone de contato operacional canônico e reutilizar a mesma resolução em cadastro e envio. Validar destino antes de concluir; ausência/inconsistência abre pendência. Não trocar telefone silenciosamente. Normalizar com biblioteca de numeração e tratar números brasileiros antigos como sugestão a confirmar.

**Critério de aceite:** Corretor com apenas telefone, apenas whatsapp, ambos divergentes, nenhum e formato inválido. Nenhuma visita automaticamente concluída pode ficar sem destino confirmado para as mensagens previstas.

<a id="a11"></a>

### A11 — Mudanças no local e nos contatos não invalidam dados já preparados (P1)

**Evidência:** visit_capture compara data, hora, corretor_id, lead_id e empreendimento_id, mas não meeting_address/meeting_neighborhood. Não há captura equivalente de troca de telefone em leads/corretores. visit_prompts guarda o número original. O formulário manual não possui os novos campos de encontro.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:155](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** Um endereço corrigido pode não gerar aviso nem sincronização; perguntas pendentes podem continuar destinadas ao número antigo. O operador não tem caminho completo para corrigir o local na interface.

**Plano de ajuste:** Adicionar edição do encontro e considerar alterações relevantes em uma nova revisão. Registrar snapshot dos dados em cada evento e versão de contato no prompt. Ao corrigir contato, expirar envios não feitos e revisar perguntas já enviadas, sem reaproveitar a identidade anterior automaticamente.

**Critério de aceite:** Alterar endereço e telefone antes do envio, depois do envio e durante uma tentativa. Notificar a alteração, atualizar Sheets e impedir confirmação vinculada ao contato antigo quando revogada.

<a id="a12"></a>

### A12 — Janela 7h–20h torna o lembrete de 2h imprevisível em horários de borda (P2)

**Evidência:** tick só gera h2 dentro da janela. Uma visita às 8h recebe h2 às 7h; às 6h não recebe esse lembrete. Se um lembrete da véspera ficar na fila, seu texto continua “amanhã”, mesmo que só seja enviado no próprio dia antes da visita. A validade da pergunta é o horário da visita.

**Local:** [supabase/migrations/20260916004310_visit_lifecycle.sql:179](../supabase/migrations/20260916004310_visit_lifecycle.sql)

**Impacto:** O lembrete pode chegar tarde, ser omitido ou informar a referência de dia errada.

**Plano de ajuste:** Calcular due_at por evento e aplicar política explícita para horários fora da janela: antecipação para último horário permitido ou omissão registrada. Agendamentos com pouca antecedência devem receber confirmação imediata apropriada. Gerar texto pela data real de envio e descartar “véspera” vencida.

**Critério de aceite:** Cobrir visitas às 6h, 7h, 8h, 9h, 20h e 22h; cadastro na mesma hora; virada de dia; fila atrasada; retomada após indisponibilidade. O texto e o horário devem corresponder à política aprovada.

<a id="a13"></a>

### A13 — Correções e cancelamentos de solicitações podem ser ignorados sem retorno (P2)

**Evidência:** visit_intake_receive só aceita resolução em needs_input/needs_closer/failed; comandos enquanto queued/processing retornam NULL. O webhook ignora esse resultado e responde sucesso técnico. Comandos com versão antiga e tentativas sem permissão também não recebem orientação. A criação não envia recibo imediato; worker pega uma solicitação por minuto, embora aceite até 100/h.

**Local:** [supabase/migrations/20260916223850_whatsapp_visit_intake.sql:80](../supabase/migrations/20260916223850_whatsapp_visit_intake.sql)

**Impacto:** A pessoa pode tentar cancelar antes do processamento e a visita ainda ser criada; pode reenviar por achar que o bot não recebeu. Um pico de 100 solicitações leva aproximadamente 100 rodadas, sem contar falhas.

**Plano de ajuste:** Persistir recibo imediato com protocolo e estado. Aceitar cancelamento seguro na fila e coordenar cancelamento em processamento por versão; se já criada, orientar ação de cancelamento da visita. Retornar erros de negócio claros sem revelar dados a pessoas não autorizadas. Dimensionar o worker e expor atraso estimado.

**Critério de aceite:** Cancelar/corrigir imediatamente após enviar, durante processamento, depois de criar e com referência antiga. Sempre haver resposta útil e nenhuma criação após cancelamento confirmado.

<a id="a14"></a>

### A14 — Tratamento das respostas e botões ainda tem lacunas de contrato (P2)

**Evidência:** O extrator do webhook cobre conversation, extendedTextMessage, buttonsResponseMessage, listResponseMessage e templateButtonReplyMessage, mas não outros envelopes, como interactiveResponseMessage. Confirmação binária citando mensagem não é resolvida por stanzaId no lifecycle. Motivo aceita texto livre >=3 caracteres quando há um único prompt, podendo capturar uma mensagem comum. Formatos não cobertos são risco de compatibilidade, não falha real demonstrada nesta revisão.

**Local:** [supabase/functions/evolution-webhook-handler/index.ts:166](../supabase/functions/evolution-webhook-handler/index.ts)

**Impacto:** Uma resposta legítima pode não ser entendida; uma mensagem sem relação pode virar motivo de não realização. A experiência depende do formato emitido pela versão instalada.

**Plano de ajuste:** Criar normalizador versionado de eventos com fixtures reais anonimizadas da Evolution instalada. Resolver respostas citadas pela pergunta e destinatário, com segurança equivalente aos botões. Para motivo, priorizar citação/contexto explícito e pedir confirmação diante de texto ambíguo. Responder instruções curtas a formatos reconhecidos mas insuficientes.

**Critério de aceite:** Testar no aparelho botões e alternativa textual, Android/iOS quando usados pela equipe, LID/remoteJidAlt, citação, texto comum durante pendência, múltiplas perguntas e webhook duplicado.

<a id="a15"></a>

### A15 — Falhas e solicitações travadas têm pouca visibilidade operacional (P2)

**Evidência:** O banner soma failures de visit_outbox e solicitações em needs_input/needs_closer/failed, mas não falhas de visit_intake_outbox nem queued/processing atrasados. Uma solicitação criada com aviso falho aparece apenas na seção de falhas da página. O acompanhamento de visitas conta falhas globalmente, mas a lista padrão pode não incluir a visita afetada. Não há heartbeat persistente de worker apresentado ao operador.

**Local:** [supabase/functions/_shared/visit-dashboard.ts:8](../supabase/functions/_shared/visit-dashboard.ts)

**Impacto:** O Closer pode não perceber que o bot parou, que a confirmação de cadastro não foi entregue ou qual visita gerou o aviso global.

**Plano de ajuste:** Criar visão unificada de pendências com tipo, visita/protocolo, idade, erro, destino e ação. Incluir filas travadas, alertas de entrega e saúde do worker no banner. Separar erro técnico de decisão comercial e filtrar diretamente a visita afetada; adicionar busca por protocolo.

**Critério de aceite:** Falha somente no aviso de uma solicitação criada, worker parado, lease vencido, falha de Sheets e visita sem pendência comercial: todos devem aparecer com ação direta.

<a id="a16"></a>

### A16 — Avaliação e feedback coexistem em modelos distintos (P2)

**Evidência:** O novo fluxo grava rating 0–10 em visit_cycles. O formulário/lista/detalhes antigos usam avaliacao_lead 0–5; não exibem a nova nota nesses locais. Feedback pode ser editado diretamente em feedback_corretor sem preencher feedback/feedback_at do ciclo, mantendo a pendência do Closer.

**Local:** [src/components/forms/VisitaForm.tsx:26](../src/components/forms/VisitaForm.tsx)

**Impacto:** A mesma visita apresenta duas avaliações sem explicação clara e um feedback preenchido pode continuar pendente. Relatórios antigos não refletem necessariamente a pesquisa nova.

**Plano de ajuste:** Definir nomes e significado de cada avaliação; adotar 0–10 como pesquisa do cliente sobre o corretor, sem converter silenciosamente dados históricos. Mostrar essa nota nos detalhes e relatórios relevantes. Usar o comando único de feedback para novas edições e distinguir claramente feedback histórico livre de feedback estruturado.

**Critério de aceite:** Notas 0, 5 e 10; visita com nota histórica de cinco estrelas; feedback pelo modal e pelo acompanhamento. A nota zero precisa aparecer e a pendência encerrar apenas com os dados obrigatórios.

<a id="a17"></a>

### A17 — IA e busca de candidatos precisam de avaliação e rastreabilidade (P2)

**Evidência:** A seleção limita candidatos a três antes de chamar a IA. O ranker recebe nome e candidatos; contexto completo do pedido não é usado. Se o modelo devolve lista vazia, os candidatos originais são acrescentados novamente. Não há histórico estruturado de modelo, versão, uso, latência e decisão. A validação do cliente verifica comprimento do nome e quantidade de dígitos, sem validar a plausibilidade completa do contato.

**Local:** [supabase/functions/_shared/visit-intake.ts:65](../supabase/functions/_shared/visit-intake.ts)

**Impacto:** Empreendimentos/corretores parecidos podem gerar opções pouco úteis. É difícil medir acerto, custo e regressão do modelo. Nome como “??” e números estruturalmente fracos podem passar pelas validações mínimas.

**Plano de ajuste:** Montar corpus anonimizado de casos reais com resposta esperada; busca em etapas por telefone, nome, bairro e link validado; medir recall antes de reduzir candidatos. Honrar rejeição do ranker e manter confirmação humana para ambiguidade. Registrar evidências, versão e métricas sem segredos; estabelecer orçamento e fallback. Validar nomes/telefones com regras proporcionais, sem inventar dados.

**Critério de aceite:** Homônimos, nomes abreviados, acentos, mais de três candidatos, número antigo, troca dos dois telefones, instrução maliciosa no perfil, IA indisponível e candidata inexistente. Nenhuma saída da IA pode referenciar cadastro fora do conjunto autorizado.

<a id="a18"></a>

### A18 — Planilha ainda precisa de prova de sincronização completa e reconciliação (P2)

**Evidência:** syncVisitSheet lê IDs e depois atualiza ou acrescenta a linha. A trava global evita concorrência normal do worker, mas não transaciona a API Google, edições humanas e escritores externos/Apps Script. A validação anterior de escrita apenas regravou o cabeçalho id_visita; não comprovou o ciclo completo com eventos reais. Não encontrei prova nesta revisão de que o antigo endpoint Apps Script foi desativado.

**Local:** [supabase/functions/_shared/visit-sheets.ts:88](../supabase/functions/_shared/visit-sheets.ts)

**Impacto:** Há risco de duplicidade, sobrescrita de campos administrados pelo sistema ou divergência após edição/timeout externo. Não foi constatada duplicação real.

**Plano de ajuste:** Definir um único escritor de visitas e responsabilidades das colunas. Auditar/desativar o endpoint antigo se redundante. Guardar hash/revisão sincronizada e manter reconciliação por id_visita. Proteger identificador e cabeçalhos; garantir nova tentativa idempotente após resposta perdida. Preservar colunas livres do usuário.

**Critério de aceite:** Em planilha de homologação: criar, confirmar, avaliar, reagendar e desistir; perder resposta do append; inserir linha manualmente; duplicar/mover identificador; mudar cabeçalho. Uma visita deve corresponder a uma linha e o erro precisa ser recuperável.

<a id="a19"></a>

### A19 — Partições de logs continuam com leitura anônima e sem RLS (P1)

**Evidência:** Advisor e consulta de privilégios confirmaram public.audit_logs_y2027m01 e public.integration_logs_y2027m01 com relrowsecurity=false e SELECT para anon. Ambas tinham zero linhas no momento da auditoria. O problema antecede esta entrega. As RPCs novas de visitas não apresentaram acesso inesperado por anon/authenticated.

**Local:** Consulta de produção: pg_class + has_table_privilege; Supabase Security Advisor

**Impacto:** Novos registros nessas partições podem ficar acessíveis sem autenticação. Não há evidência de vazamento de conteúdo nessas duas partições vazias.

**Plano de ajuste:** Revogar privilégios diretos desnecessários, proteger partições e validar acesso via tabela pai. Corrigir a rotina que cria futuras partições e seus privilégios padrão. Acrescentar teste recorrente de catálogo. Revisar separadamente a proteção contra senhas vazadas desativada; demais avisos do advisor exigem interpretação, não remoção indiscriminada de acessos legítimos.

**Critério de aceite:** Consultas diretas como anon/authenticated devem ser negadas quando não autorizadas; escrita de serviço e consulta administrativa legítimas devem continuar funcionando. Criar partição sintética e testar herança de proteção.

<a id="a20"></a>

### A20 — Cobertura atual não demonstra o fluxo real completo (P1)

**Evidência:** npm run check e cinco testes Playwright passaram novamente. PGlite usa tabelas-base simplificadas; Playwright simula respostas do backend no fluxo de acompanhamento. Em produção havia zero visit_cycles e zero visit_intake, portanto nenhum histórico operacional para comprovar botões, respostas, CRM e Sheets no mesmo percurso.

**Local:** [scripts/test-visit-lifecycle.mjs:10](../scripts/test-visit-lifecycle.mjs)

**Impacto:** A aprovação dos testes existentes não sustenta certificação 10/10. As falhas reproduzidas nesta auditoria mostram lacunas reais da suíte.

**Plano de ajuste:** Transformar os casos desta auditoria em testes de regressão que inicialmente falhem; adicionar ambiente de homologação com schema e gatilhos reais, provedor simulado para falhas e um ensaio no WhatsApp com contatos internos e planilha de teste. Criar critérios de liberação, canário e rollback por recurso.

**Critério de aceite:** Somente liberar como homologado após percursos completos: sucesso, dúvida, conflito, silêncio, não realização, reagendamento, desistência, erro de envio/Sheets, pausa, concorrência e replay. Guardar evidências vinculadas ao build e às versões das funções.

## 5. Plano integrado de execução

### Fase 0 — Fixar a linha de base e proteger dados

**Itens:** A19 e preparação de A20. **Responsáveis:** backend/banco e QA.

1. Registrar versões, configuração e métricas antes das mudanças.
2. Capturar schema e fixtures anônimas em homologação.
3. Corrigir privilégios das partições e seu mecanismo de criação; verificar acesso legítimo.
4. Manter rollback de configuração e migrations compatíveis; não apagar histórico.
5. Criar testes que falhem com os defeitos reproduzidos. Preservar os testes atuais.

**Saída:** ambiente de ensaio reproduzível e acesso aos logs restrito. A falha de segurança pode ser tratada de forma independente do restante.

### Fase 1 — Tornar as decisões de negócio consistentes

**Itens:** A01, A02, A07, A08, A09, A10 e A11. **Responsáveis:** backend/banco e frontend.

1. Definir estados, comandos e invariantes canônicos da visita.
2. Unificar agendamento, alteração, substituição e reagendamento na validação de agenda.
3. Implementar sequência de perguntas e proteção contra resposta obsoleta.
4. Acrescentar apuração administrativa e resolução explícita da desistência.
5. Resolver contatos e local com revisão, histórico e invalidação apropriada.
6. Separar pausa de envio da captura dos eventos.
7. Migrar formulários para os comandos; revisar inconsistências existentes por consulta e correção auditada.

**Dependências:** A02 é a base de A01, A07, A09 e A11. Evitar remendos isolados em cada tela.

**Saída:** toda ação produz um estado coerente, independente de ser iniciada no grupo ou no sistema.

### Fase 2 — Garantir comunicação recuperável e prazo previsível

**Itens:** A04, A05, A06, A12, A13, A14 e A15. **Responsáveis:** backend/integrações e frontend.

1. Persistir tentativas e resultados de envio; consumir recibos sem deduplicar eventos diferentes.
2. Introduzir tratamento de resultado desconhecido e reconciliação antes do reenvio.
3. Separar filas por destino/prioridade; dimensionar processamento e recuperação de reservas.
4. Adicionar recibo imediato, respostas de negócio e cancelamento coordenado.
5. Formalizar a agenda dos lembretes dentro da janela autorizada.
6. Validar normalizador com payloads reais anonimizados.
7. Expor fila atrasada, saúde do worker e falha por protocolo/visita com ação direta.

**Dependências:** recibos e tentativas de A04/A05 vêm antes de aumentar concorrência em A06.

**Saída:** uma falha de Google ou WhatsApp não desaparece nem bloqueia indevidamente os outros fluxos.

### Fase 3 — Completar CRM, planilha, avaliação e qualidade da IA

**Itens:** A03, A16, A17 e A18. **Responsáveis:** backend, frontend, configuração comercial e QA.

1. Mapear estágios reais do funil e conectar cada resultado sem encerrar oportunidades indevidas.
2. Consolidar exibição de nota 0–10 e edição do feedback.
3. Estabelecer escritor único da planilha, reconciliação por ID e proteção de colunas.
4. Construir corpus de avaliação da IA, melhorar recuperação de candidatos e registrar decisões/métricas.
5. Reprocessar apenas divergências comprovadas, com limite e auditoria.

**Dependências:** usar o modelo de estados estabilizado na Fase 1 e as filas da Fase 2.

**Saída:** mesmo resultado verificável no acompanhamento, CRM, planilha e avisos.

### Fase 4 — Homologar e liberar gradualmente

**Item:** A20 e aceite dos demais. **Responsáveis:** QA, responsável técnico e operação/Closer.

1. Rodar testes automáticos e de concorrência contra schema completo.
2. Ensaiar todas as jornadas com números internos e planilha de homologação.
3. Conferir no aparelho o recebimento, botão, resposta citada, nota e motivo.
4. Fazer canário com volume limitado, observando métricas e filas.
5. Ampliar somente sem erros P1/P2 abertos nos fluxos essenciais.
6. Se houver falha, pausar o recurso afetado preservando captura, histórico e pendências.

**Dimensionamento:** mudanças pequenas: A12/A16/A19; médias: A01/A08/A09/A10/A11/A13/A14/A15/A17; grandes: A02/A03/A04/A05/A06/A07/A18/A20. São classes de esforço, não promessa de prazo; estimativa em horas exige fechar a política de agenda, estágios do CRM e capacidade real do provedor. A sequência evita refazer telas e integrações sobre um modelo de estados ainda instável.

## 6. Políticas a formalizar durante o ajuste

As decisões já dadas pelo usuário ficam preservadas: qualquer membro agenda; lead novo é permitido com dados válidos; cadastro inequívoco é imediato; conflitos exigem Closer; duração 60+30; respostas a comandos a qualquer hora; lembretes entre 7h e 20h; silêncio não cancela.

Restam escolhas de produto, não bloqueios para esta auditoria:

- Para visita muito cedo, antecipar lembrete para a janela anterior ou registrar omissão. Proposta: antecipar quando possível e usar texto correto, sem classificar lembrete comum como urgente.
- Mapear nomes/IDs dos estágios do Funil 2026 aos eventos da visita.
- Definir quem pode fazer apuração manual do resultado e a justificativa obrigatória. Proposta: administrador/Closer conforme a autorização já adotada.
- Definir tratamento da avaliação histórica de 0–5 sem misturá-la à nova nota 0–10.
- Definir retenção de textos, prompts e registros de IA conforme a necessidade operacional; evitar duplicação desnecessária de dados pessoais.

## 7. Critérios objetivos para o padrão de excelência

| Dimensão | Critério de liberação |
|---|---|
| Identidade e cadastros | Nunca criar com candidato ambíguo sem escolha explícita; não enviar a contato antigo revogado |
| Estado | Visita, ciclo, confirmações e CRM coerentes em toda transição permitida |
| Concorrência | Webhook repetido e criação simultânea não geram visita/lead duplicado nos caminhos cobertos |
| Agenda | 60+30 aplicado em todos os canais; exceções somente explícitas e auditadas |
| Mensagens | Distinguir aceite, entrega, leitura, falha e incerteza; nenhum erro desaparecer silenciosamente |
| Prazo | Medir latência real; proposta de resposta inicial p95 até 10 s e urgente p95 até 60 s, com provedores saudáveis |
| Pós-visita | Pergunta emitida conforme prazo acordado; atraso de ocorrência gera apuração sem presumir no-show |
| Recuperação | Alerta termina somente por desfecho válido; correção administrativa disponível e auditada |
| Planilha | Uma linha por id_visita; reprocessamento seguro; colunas livres preservadas |
| Segurança | Nenhum acesso anônimo a dados operacionais/logs; RPCs restritas e identidade validada |
| Operação | Closer enxerga pendência, motivo, idade, próximo passo e falha de integração |
| Homologação | Jornadas reais e falhas induzidas documentadas, sem depender somente de mocks |

As metas de latência são **propostas de aceite**, não desempenho já medido. Com indisponibilidade do provedor, o objetivo é informar e recuperar, não prometer entrega impossível.

### Matriz mínima de regressão

1. Cadastro inequívoco com lead novo e preexistente.
2. Nome incompleto, dois homônimos, empreendimento parecido e telefone divergente.
3. Duplo webhook, reenvio do pedido e duas criações simultâneas.
4. Conflito exato, conflito de intervalo e mudança de conflito durante aprovação.
5. Correção/cancelamento com pedido na fila, processando, concluído e versão antiga.
6. Corretor indisponível, substituição e cliente silencioso.
7. Confirmações fora de ordem, repetidas, expiradas e de destinatário incorreto.
8. Visita realizada, não realizada, motivo ausente e ausência de resposta.
9. Nota 0/10, feedback completo/incompleto, apuração manual e reagendamento vinculado.
10. Pausa/retomada, troca de contato, mudança de local, exclusão e restauração.
11. Provedor aceita e perde resposta, devolve falha posterior ou responde lentamente.
12. Google indisponível, append ambíguo, edição manual e identificação duplicada.
13. CRM com múltiplas oportunidades e nenhuma regra válida.
14. Rotação de segredo, papel incorreto, payload malicioso e novo mês de partições.

## 8. Referências técnicas verificadas

- [Supabase: pg_net e análise de respostas](https://supabase.com/docs/guides/database/extensions/pg_net) — retorno da chamada representa uma requisição assíncrona; observar resposta é etapa separada.
- [Supabase: agendamento de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — cron com pg_net e credencial em Vault.
- [Supabase: RLS desativada em schema público](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) — referência de correção para A19.
- [Supabase: proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) — endurecimento complementar apontado pelo advisor.

## Conclusão

A entrega atual tem mecanismos importantes de segurança e automação, mas ainda precisa das correções e da homologação acima. O próximo passo eficiente é executar as fases 0–1 primeiro, estabilizar entrega e recuperação na fase 2 e então validar integrações e jornada real. A aprovação dos testes existentes deve continuar sendo exigida, acrescida dos casos que esta revisão demonstrou estarem faltando.
