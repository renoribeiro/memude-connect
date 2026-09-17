# Match e acompanhamento unificados

## Regras implementadas

1. Todo novo agendamento futuro, pela tela ou pelo grupo, persiste o aviso inicial ao cliente e inicia a consulta de corretor. Esses envios não aguardam a janela de 7h–20h. O banco solicita a execução do worker após o commit; o cron recupera trabalho pendente.
2. O corretor informado é consultado primeiro se estiver ativo, com contato válido e disponível. Sem indicação, o Match escolhe o primeiro. Identidade ambígua informada pelo WhatsApp continua exigindo esclarecimento.
3. Classificação lexicográfica, sem mistura de pontos entre prioridades:
   - Especialidade: correspondências com tipo de imóvel e construtora (0, 1 ou 2). Tipo `todos` corresponde ao tipo solicitado.
   - Região: bairro cadastrado corresponde primeiro; depois, bairro de atuação na mesma cidade/UF. O cadastro atual não possui polígonos de regiões; não inferimos proximidade geográfica por texto.
   - Maior média das notas: nova avaliação 0–10; avaliação histórica da visita 1–5 multiplicada por 2. Uma visita com ambas usa somente a nota nova. Sem avaliações individuais, usa a média histórica do corretor convertida para 0–10; sem nota, zero.
   - Menor quantidade de visitas realizadas, não excluídas, em todo o histórico. Empate completo termina por ID para ordenação estável.
   - Se nenhum corretor corresponde à especialidade/região, os dois primeiros critérios empatam em zero e prevalece a nota.
4. Consulta com SIM/NÃO e referência única. Prazo de 15 minutos a partir do aceite do envio pelo provedor, limitado ao início da visita. Não equivale a 15 minutos após leitura. A mesma rodada não consulta o mesmo corretor duas vezes.
5. Recusa, prazo vencido ou falha de envio encerra a tentativa. O próximo corretor é consultado até o limite, padrão 5, configurável de 1 a 20 em Configurações → Automação de visitas.
6. Aceite é transacional, revalida situação e agenda do corretor e recusa respostas de tentativas encerradas. Cliente, corretor, Closer e grupo recebem a confirmação. O aceite da atribuição é separado das confirmações dos lembretes.
7. Esgotamento mantém solicitação pendente para o Closer. A tela permite indicar um corretor para uma nova consulta auditada. A indicação não inventa um aceite em nome do corretor. Pode-se também reagendar ou registrar desistência explícita.
8. Lembretes na véspera e 2h antes, respeitando 7h–20h. Corretor que responde NÃO inicia nova rodada de substituição e fica excluído daquela rodada. Cliente que responde NÃO cancela e abre recuperação. Silêncio mantém o agendamento.
9. Pós-visita mantém a pergunta de realização. Quando realizada, o sistema pede nota ao cliente e feedback ao corretor. Respostas parciais são salvas, inclusive na planilha; o resumo para Closer/grupo é gerado uma única vez após nota e feedback do corretor. Feedback é texto livre solicitado com interesse, objeções e próximo passo; dados estruturados adicionais do Closer são preservados no ciclo.
10. O monitor de Distribuição e o monitor nas Configurações usam as mesmas tentativas persistentes, com situação, prazo e critérios da escolha. As rotinas legadas de distribuição de visitas foram redirecionadas ao worker unificado; distribuição de leads permanece independente.

## Implementação e segurança

- `visit_match_attempts`: histórico por visita/rodada, um único candidato pendente por visita, avaliação dos critérios persistida sem telefone no ranking.
- `visit_cycles.match_status`: `searching`, `accepted`, `exhausted`, `closed`. O campo legado `visitas.status` é preservado por compatibilidade; Match e acompanhamento mostram se já existe aceite.
- Agenda de 60+30 continua aplicada. Exceções anteriormente aprovadas pelo Closer no intake são restritas aos conflitos conhecidos e ao corretor indicado; conflitos novos invalidam o aceite.
- Tabelas e RPCs internas não são acessíveis a usuários anônimos/autenticados. A interface usa função com validação do administrador.
- A fila não reenvia automaticamente mensagens cuja entrega é incerta. Tentativas encerradas não podem assumir a visita por resposta atrasada.
- Referência: [pg_net — solicitações assíncronas após commit](https://supabase.com/docs/guides/database/extensions/pg_net).

## Evidências e limites

- 25 novos cenários SQL para Match; 74 cenários SQL no conjunto completo, 54 testes unitários e 28 verificações de rotas.
- 6 testes de navegador, incluindo indicação do Closer após esgotamento. São testes com API controlada.
- Cenário transacional no schema real verificou criação, consulta, aceite, ocorrência, feedback, nota e resumo único, seguido de rollback. Não houve persistência de visita sintética nem envio aos contatos consultados nesse teste.
- Build, TypeScript, ESLint e checagem Deno dos pontos de entrada revisados.
- Botões dependem do suporte da instância/provedor. Se o endpoint os recusar explicitamente como não suportados, a mensagem usa as opções textuais com referência; timeout não dispara fallback duplicado.
- “Imediato” significa envio iniciado sem esperar a janela comercial. Não é uma garantia de latência do WhatsApp. Cron, fila, conectividade e provedor podem acrescentar atraso.
- A homologação completa nos aparelhos dos participantes e a medição de latência continuam necessárias para um SLA operacional. Nenhuma visita real foi criada apenas para testar esta entrega.
