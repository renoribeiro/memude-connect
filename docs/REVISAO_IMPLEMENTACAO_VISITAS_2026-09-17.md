# Revisão da implementação de visitas — 17/09/2026

## Escopo entregue

Implementação das correções da auditoria de 16/09, preservando os registros e o histórico. As migrações foram exercitadas em banco isolado e em transação revertida no schema de produção antes da aplicação. A homologação operacional completa com pessoas reais permanece distinta dos testes automatizados.

| Item | Alteração e evidência |
|---|---|
| A01 | Resposta aceita expira perguntas anteriores da mesma parte/revisão. Teste de confirmação fora de ordem. |
| A02 | Confirmações da visita refletem o ciclo; alteração invalida ambas; visita encerrada não reabre por edição; desistência ajusta status. |
| A03 | Eventos movimentam o cartão vinculado entre Visita Agendada, Visita Realizada, Reagendando e Bolsão, sem regredir documentação/venda. Lead existente recebe visita_agendada. Transação no schema real validou agendamento e realização no CRM. |
| A04 | Recibos Evolution alimentam aceite/entrega/leitura/falha, inclusive recibo recebido antes da gravação do identificador. Estado não regride após leitura. |
| A05 | Timeout e resposta sem identificador ficam como entrega incerta; não são reenviados automaticamente. Reenvio manual alerta o operador. |
| A06 | WhatsApp e planilha têm filas de execução independentes; sincronização da planilha permanece serializada. |
| A07 | Trigger aplica duração + intervalo também ao cadastro/edição manual. Exceção pelo Closer fica limitada aos conflitos explicitamente inspecionados. |
| A08 | Agendamento futuro captura ciclo mesmo com automação pausada; pausa impede envio, sem perder a captura. |
| A09 | Administrador registra ocorrência apurada e motivo no acompanhamento; estados e avisos seguem o mesmo fluxo. |
| A10 | Telefone alternativo do corretor é utilizado quando WhatsApp está vazio, incluindo snapshot, perguntas e sincronização. |
| A11 | Mudança de telefone, local, perfil, horário ou responsável invalida revisão e perguntas anteriores. Formulário expõe local/bairro/perfil. |
| A12 | Lembrete de visita cedo é antecipado à janela anterior. Texto usa data explícita, sem afirmar “amanhã”. Silêncio continua sem cancelar. |
| A13 | Autor pode corrigir/cancelar pedido aguardando ou processando. Recebimento tem aviso persistido para grupo e Closer; fila envia avisos antes de processar novos pedidos com IA. |
| A14 | Normalização de mensagens interativas, envelopes conhecidos e respostas citadas. Texto livre não vira motivo por coincidência com pergunta pendente. |
| A15 | Painel mostra falhas, entregas incertas, pedidos atrasados e execução sem atualização; falhas permitem abrir o acompanhamento correspondente. |
| A16 | Nota atual 0–10 aparece separada da avaliação histórica 1–5. Feedback no formulário genérico é somente leitura e direciona ao acompanhamento. |
| A17 | IA recebe até 10 candidatos pré-selecionados, usa contexto e retorna até 3 opções; rejeição não vira confirmação automática. Telemetria registra modelo, versão, duração, tokens e evidência limitada. |
| A18 | Escrita por id_visita, revisão e data de sincronização; colunas livres preservadas; teste simula append aceito cuja resposta se perdeu e confirma atualização sem duplicação. |
| A19 | RLS/revogação de acesso direto nas 20 partições atuais de logs e adaptação da criação das próximas. |
| A20 | Ampliação da regressão automatizada e verificações do schema real. Aceite humano e medição de latência real continuam pendentes, conforme limites abaixo. |

## Verificação

- 54 testes unitários; 49 cenários SQL (18 ciclo, 16 intake, 15 qualidade); 28 verificações de rotas.
- 5 testes Playwright: login, controle de acesso, 404, liberação explícita de conflito e recuperação por reagendamento vinculado.
- TypeScript, ESLint, varredura de segredos, auditoria de dependências e build aprovados.
- Deno check aprovado para os seis pontos de entrada do fluxo atualizado.
- Migrações exercitadas com rollback no schema real; teste anterior no mesmo ciclo de revisão validou CRM agendado/realizado sem persistir dados sintéticos.
- Teste Playwright repetido isoladamente após interferência de dois builds locais concorrentes; cinco casos aprovados. Evitar builds simultâneos sobre dist durante testes de navegador.

## Limites de homologação e operação

1. Os testes de navegador usam respostas controladas. Não equivalem a uma visita completa conduzida por cliente/corretor reais.
2. Metas p95 de 10 segundos para recebimento e 60 segundos para urgências não estão medidas nem garantidas. Os workers rodam por cron e o volume/provedor afetam o tempo. Coletar amostra real antes de estabelecer SLA.
3. A integração Google possui teste de recuperação por falha simulada e diagnóstico real de acesso. A ausência de outros escritores (Apps Script/n8n) não foi comprovada; não houve alteração de scripts externos. Exclusividade da escrita por id_visita precisa ser conferida na operação.
4. O CRM depende de estágios com os nomes acima e cartão vinculado à visita. Funis personalizados sem tais estágios exigem configuração/mapeamento. O cartão de uma visita anterior é preservado no reagendamento.
5. Confirmação de transporte aceita não equivale a entrega ou leitura pelo destinatário. O painel distingue esses estados quando o provedor fornece recibos.

### Roteiro de aceite operacional

Com contatos de teste identificados e autorizados: enviar um pedido inequívoco no grupo; conferir protocolo, lead, visita, cartão CRM e linha VISITAS; responder confirmações em ordem invertida; provocar conflito e liberar pelo Closer; registrar realizada/nota 0/feedback; executar não realizada/motivo/reagendamento. Conferir todos os avisos no grupo e no Closer e anotar latências. Não usar o exemplo da cliente Emilly como agendamento real de teste.
