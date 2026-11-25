# MeMude Conversas — plataforma de atendimento com IA (plano v2)

> Atualizado em 25/11/2026 com as decisões do Ramon. Tudo ligado ao MeMude Connect; gestão pelo Connect;
> desenvolvimento feito internamente.

## 1. Objetivo

O funil é estável até a visita (≈250 leads e ≈30 visitas/mês), mas as vendas oscilam de 0 a 7 por mês: a perda
está **depois da visita** (cliente esquecido, acompanhamento desigual, corretor que não registra nada).

O atendimento passa a acontecer **dentro de uma plataforma nossa**, com o cliente falando pelo WhatsApp
como já fala hoje. A **IA lê as conversas** e **sugere**: o que registrar no CRM, o que responder, qual
empreendimento combina, quando retomar. Ninguém da equipe precisa "preencher CRM" do zero: confirma com 1 toque.

**Metas (medidas antes e depois do piloto):**
- tempo de 1ª resposta do corretor depois de aceitar: < 15 min (8h–20h);
- clientes pós-visita com contato nos últimos 3 dias: > 90%;
- conversão visita → venda: de ≈5% para 10%.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| WhatsApp | **Evolution** (sem API oficial), **vários números** e **instâncias de backup** |
| Envios | **Só conversa** (troca de mensagens). Sem envio em massa. **Bot de follow-up do 2.4 em stand-by** |
| Mídia | Fotos, vídeos, áudios, documentos e emojis trocados **pelo app** |
| IA | **Só sugere** (CRM, etapa, respostas, empreendimentos, lembretes). A pessoa confirma |
| Horário e prazo | Atendimento **8h–20h**; alerta se o corretor passar de **15 min** sem responder |
| Custo | Sem custo de WhatsApp. Desenvolvimento interno. (A IA tem custo de uso pequeno — ver 4.3) |

## 3. Quem faz o quê

| Quem | Onde | O que faz |
|---|---|---|
| Cliente | WhatsApp, número MeMude | Conversa normal; vê quem está falando ("*Lucas · Corretor MeMude*") |
| SDR | Connect → **Conversas** | Qualifica, agenda, cuida de no-show, "não gostou", "quer ver outros" |
| Corretor | **App MeMude Corretor** (celular ou PC) | Recebe "Cliente novo", aceita, conversa, vê ficha, match de empreendimentos, mini-kanban |
| Closer | Connect → Conversas + Painel | Vê tudo, recebe alertas, entra na conversa para fechar |
| IA | Automática, por trás | Lê, resume e **sugere**; avisa o closer sobre clientes esquecidos e corretores lentos |

### Dono da conversa em cada etapa (troca automática pelo status da visita)

| Etapa | Dono |
|---|---|
| Entrada (site/Ads/agendamento direto), qualificação e agendamento | SDR |
| Corretor aceita a visita | **Corretor** (SDR continua vendo, sem responder) |
| 2.1 No-show | SDR |
| 2.2 Visitou e não gostou | SDR (IA sugere outros empreendimentos) |
| 2.3 Visitou e vai comprar | Corretor + Closer |
| 2.4 Desistiu e não visitou | SDR (retomada manual; bot em stand-by) |
| 2.5 Visitou e quer ver outros | SDR |

Qualquer pessoa da equipe pode **puxar** uma conversa com um clique (fica registrado quem e quando).

### Quem vê o quê (ponto 4)

| Perfil | Vê | Responde |
|---|---|---|
| Corretor | **Só os clientes que ele aceitou** | Só os dele |
| SDR | Todas as conversas | As que estão com o SDR (e puxa as outras se precisar) |
| Closer e admin | Todas | Todas |

## 4. Viabilidade e cuidados

### 4.1 Evolution com vários números

- Cada número é uma **instância** no Evolution (WhatsApp Business num celular + Evolution conectado como "aparelho vinculado").
- **Cada cliente fica preso ao número em que começou a conversar**: tudo que a equipe responde sai pelo mesmo número (o cliente nunca vê o número mudar).
- Números de **backup** já aquecidos e conectados. Se um número cair, o Connect avisa na hora; as conversas novas vão para o backup.
  Os clientes antigos daquele número recebem a mensagem de "novo número" **um a um, pela equipe** (nunca em massa).
- **Todo o histórico fica no nosso banco**: se um número cair, nada se perde do lado da MeMude.
- Risco de banimento **baixo** no uso "só conversa", mas não é zero com Evolution. Cuidados que entram no sistema:
  - nenhum envio em massa, nenhum disparo para quem não falou antes;
  - fila de envio com ritmo humano (pequeno intervalo entre mensagens) e limite por minuto;
  - números novos aquecidos aos poucos antes de receber clientes;
  - celular de cada número ligado e com o WhatsApp atualizado;
  - monitor de conexão (já existe `evolution-health-check`) com alerta no Connect.

### 4.2 Adoção pelos corretores

O app só funciona se o corretor **não levar o cliente para o WhatsApp pessoal**:
- regra comercial: lead MeMude é atendido pelo app;
- o app tem de ser tão bom quanto o WhatsApp (áudio, foto, vídeo, PDF, respostas rápidas) e melhor no que o WhatsApp não faz (ficha pronta, tabela a um toque, lembretes);
- quem responde rápido recebe mais leads (o ranking de corretores já existe).

### 4.3 IA

- Analisa cada **rodada de conversa** (2 min sem mensagem nova), não cada mensagem.
- Usa as chaves de IA já cadastradas no Connect (OpenAI, Gemini ou Anthropic), com o modelo mais barato para o dia a dia.
- Custo de uso estimado: **R$ 150–400/mês** no volume atual (transcrição de áudio + análises). Não há como zerar: é cobrança por uso da IA, não assinatura.
- Nunca envia mensagem: só sugere.

### 4.4 Notificações "estilo Uber"

- App instalável (PWA): notificação no Android e no iPhone (iOS 16.4+, depois de "Adicionar à Tela de Início").
- Se o corretor não abrir em X minutos: aviso no WhatsApp pessoal dele e, depois, redistribuição (regra que já existe no Connect).
- Se o iPhone limitar demais, o mesmo app vira app nativo depois, sem reescrever.

### 4.5 Segurança e LGPD

- Regras de quem vê o quê **no banco** (RLS), não só na tela.
- Fotos e documentos do cliente em armazenamento privado com link temporário.
- Aviso de privacidade na 1ª resposta; registro de quem fez o quê; retenção definida (ex.: 2 anos após o último contato).
- Corrigir: token da Evolution está gravado numa tabela comum (`evolution_instances.api_token`) → mover para o cofre de segredos.

## 5. O que já existe e será reaproveitado

| Já existe | Uso |
|---|---|
| Evolution: webhook, envio, fila, health check (`evolution-*`, `message_queue`) | Entrada e saída das mensagens, monitor dos números |
| Distribuição com aceite, prazo e redistribuição | "Cliente novo → Aceitar" |
| Ranking/sugestão de corretores | Quem recebe cada cliente |
| IA: `bant-scorer`, `intent-detector`, `objection-handler`, `context-builder` | Base das sugestões e da extração para o CRM |
| Busca semântica de imóveis (`property_embeddings`, `ai-property-search`) | **Match de empreendimentos** |
| Templates (`message_templates`) | Respostas prontas |
| Visitas, tarefas, agenda, kanban, histórico | O "cérebro" — o app só alimenta |

## 6. Produto

### App do corretor
- **Conversas**: lista com não lidas e cronômetro de "sem resposta" (verde/amarelo/vermelho).
- **Cliente novo** (tela cheia): resumo do cliente, empreendimento, renda, horário da visita, **Aceitar** grande com contagem regressiva.
- **Conversa** igual ao WhatsApp: texto, áudio, foto, vídeo, PDF, emojis, respostas rápidas com "/".
  Faixa da IA acima do teclado com sugestão (toque para usar ou editar). Notas internas que o cliente não vê.
- **Ficha do cliente**: resumo da IA, renda/entrada/FGTS, objeções, próximas ações, visitas, histórico.
- **Empreendimentos** (menu lateral): busca, filtros, **"mais match com este cliente"**, enviar book/tabela/fotos em 1 toque.
- **Meu funil** (mini-kanban): a IA sugere a mudança de etapa, o corretor confirma.
- **Hoje**: follow-ups vencidos, visitas do dia, clientes esfriando.
- **Meu desempenho**: tempo de resposta, clientes ativos, visitas, vendas, dicas da IA.

### Connect
- **Conversas**: caixa de entrada da equipe, filtros (etapa, dono, sem resposta, número), atribuir/puxar, notas internas.
- **Números**: status de cada instância, backup, alertas de desconexão.
- **Alertas ao closer**: cliente pós-visita sem contato há X dias; corretor > 15 min sem responder (8h–20h); sinais de compra.
- **Painel de corretores**: tempo de resposta, follow-ups em dia, visitas → vendas, avaliação semanal da IA.
- Ficha do lead e card do CRM com aba **Conversa** e resumo da IA.

### Boas práticas aplicadas
- UX: parecer o WhatsApp; uma ação principal por tela; toque ≥ 44 px; modo escuro; contraste AA; funciona com internet ruim
  (fila de envio, reenvio e ✓✓); tempo real sem recarregar; textos curtos em português.
- Segurança: RLS por papel e por dono; funções com verificação de papel (padrão do `SECURITY.md`); segredos só no servidor; links temporários para mídia; webhook com verificação.
- Eficiência: Realtime para mensagens; IA em fila e por rodada; mídia comprimida; app do corretor carregado à parte (leve no celular).
- Código enxuto: mesmo repositório e banco; reaproveitar Evolution, distribuição e módulos de IA; poucas tabelas novas; testes nas regras críticas (dono da conversa, permissões, fila de envio).

## 7. Arquitetura

- Tabelas novas: `conversas` (1 por cliente e número), `mensagens`, `conversa_donos`, `conversa_notas`, `ia_sugestoes`, `alertas`, `push_inscricoes`, `numeros` (instâncias e backup).
- Entrada: Evolution → webhook → `mensagens` → Realtime → telas; fila de análise → IA → `ia_sugestoes`/alertas.
- Saída: tela → função de envio (assinatura do atendente, ritmo humano) → mesmo número da conversa → status ✓/✓✓/lido pelo webhook.
- Agendadores (`pg_cron`): SLA a cada minuto (8h–20h), saúde dos números, resumo diário, avaliação semanal.

## 8. Plano de ação

| Fase | Duração | Entrega | Pronto quando |
|---|---|---|---|
| **0. Base** | 1 semana | Números e instâncias (principal + backup) no Evolution, token no cofre, tabelas e permissões, aviso LGPD, medição atual, corretores piloto | Mensagem entra e sai pelo Connect em 2 números |
| **1. Conversas no Connect** | 2–3 semanas | Caixa de entrada da equipe, tempo real, mídia completa, templates, puxar/atribuir, notas internas, assinatura, tela de números | SDR atende 100% pelo Connect por 1 semana |
| **2. App do corretor** | 3 semanas | App instalável, "Cliente novo" com aceite (reuso da distribuição), conversa completa, ficha, notificações | 3 corretores piloto atendem só pelo app |
| **3. IA que sugere** | 3 semanas | Transcrição de áudio, resumo, sugestões para o CRM e etapa (1 toque), sugestão de resposta, match de empreendimentos, lembretes | 80% dos campos-chave confirmados sem digitar |
| **4. Gestão e alertas** | 2 semanas | Alertas ao closer (15 min / cliente esquecido), painel de corretores, avaliação semanal, mini-kanban e "Meu desempenho" | Closer usa o painel na reunião semanal |
| **5. Pós-visita** | 1–2 semanas | Troca automática de dono nos fluxos 2.1–2.5, filas de pós-visita para o SDR | Nenhum cliente pós-visita sem contato > 3 dias |

**Total: ≈12–14 semanas.** O piloto com corretores começa na fase 2.

**Em stand-by:** bot de follow-up do 2.4; app nativo; envios automáticos de qualquer tipo.

## 9. Ideias para depois
- Temperatura do cliente (quente/morno/frio) pela conversa.
- "Próxima melhor ação" em cada conversa.
- Resumo de passagem de bastão SDR → corretor → closer.
- Biblioteca de mídias por empreendimento (book, tabela do mês, vídeos).
- Alerta discreto quando alguém tenta levar o cliente para o número pessoal.
- Pesquisa pós-visita de 1 toque.
