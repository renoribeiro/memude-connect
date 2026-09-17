# Agendamento de visitas pelo WhatsApp

## Estado em 16/09/2026

Publicado e ativado no grupo **MeMude - Comercial e Vendas**, pela instância `memude-visitas`. Frontend em https://core.memudecore.com.br/visitas; deployment Vercel `dpl_2xMZdC85hLi3CCXmTNconwRWsoo5` (READY).

## Operação

- Qualquer participante pode iniciar uma mensagem com `AGENDAR VISITA` e usar o modelo combinado: Cliente, Telefone, Data, Horário, Empreendimento, Local (stand), Bairro, Corretor, Telefone, Perfil do cliente, Origem do lead e Link do empreendimento.
- O primeiro telefone pertence ao cliente; o segundo, ao corretor. Enviar a partir do número pessoal, diferente do número conectado à automação.
- Nome e telefone válidos permitem criar lead, desde que não haja conflito. Dados completos e correspondências inequívocas criam a visita sem confirmação final.
- Correspondências aproximadas viram sugestões para confirmação. A IA extrai campos e ordena candidatos existentes; não pode inventar IDs nem gravar diretamente no banco.
- Responder citando a pergunta do sistema, com os campos corrigidos. Quando houver uma única categoria de opções, pode responder apenas o número. Alternativa explícita: `RESOLVER AG-<protocolo> V<versão>` seguido dos campos.
- Somente o autor, o Closer ou administrador pode resolver uma solicitação. Qualquer membro pode abrir uma nova.
- Duração de 60 minutos e intervalo de 30 minutos. Visitas encerradas/substituídas não bloqueiam horários. Conflitos ativos mostram data, hora e cliente; somente Closer/administrador libera. Liberar mantém os compromissos existentes.
- Closer pode responder no privado citando o aviso ou usando `LIBERAR AG-<protocolo> V<versão>`. O sistema valida a identidade, a versão e os conflitos antes de cadastrar.
- `CANCELAR AG-<protocolo> V<versão>` cancela uma solicitação pendente; não cancela uma visita já criada.
- Painel **Agendamentos pelo WhatsApp** permite corrigir, liberar conflito e acompanhar falhas. Pendências sem esclarecimento por duas horas são encaminhadas ao Closer.
- Respostas às solicitações podem sair a qualquer hora. Os lembretes continuam na janela já configurada de 7h–20h.

## Processamento e integrações

Webhook autenticado → solicitação persistida → worker → validação de cadastros → criação atômica de lead/visita → ciclo existente de lembretes e sincronização da planilha VISITAS.

O worker roda a cada minuto e processa uma solicitação por execução. Há fila, portanto o retorno pode levar mais de um minuto sob carga. Mensagens repetidas do provedor são deduplicadas; a criação também verifica visita equivalente. Há limite de 100 novas solicitações por hora.

Avisos ao grupo e ao Closer usam fila com novas tentativas. Aceitação pela Evolution não significa leitura ou entrega no aparelho. Falhas finais aparecem no painel para reenvio. Respostas de versões antigas não alteram a solicitação atual.

Configurações → Automação de visitas possui interruptor independente para entrada pelo grupo. Desativá-lo pausa captura/processamento dessa entrada. Não exclui solicitações nem desliga os lembretes de visitas existentes.

## Validação realizada

- 49 testes unitários; 18 cenários do ciclo de visitas e 16 cenários do agendamento no PostgreSQL isolado; 5 testes de navegador com backend simulado.
- Typecheck, lint, segurança, build e rotas passaram na validação da implementação; Deno verificou worker e webhook.
- Extração real por IA respondeu corretamente. Prévia com o modelo do usuário identificou Fantastique 4 e sugeriu Reno Alencar, pedindo confirmação porque o telefone difere do cadastro. Nenhuma visita foi criada a partir do exemplo.
- Criação transacional validada com os gatilhos reais em produção e revertida com ROLLBACK, sem persistir lead/visita sintéticos.
- Worker ativo respondeu HTTP 200; cron confirmado ativo; página publicada respondeu HTTP 200.

Ainda falta observar o primeiro agendamento real enviado por um participante pelo aplicativo WhatsApp para confirmar ponta a ponta no aparelho. Os testes técnicos não substituem essa observação. Não há aprendizado automático de apelidos nem painel específico de custos/decisões do modelo nesta entrega.

## Arquivos principais

- `supabase/functions/_shared/visit-intake*.ts`: entrada, interpretação e processamento.
- `supabase/functions/visit-intake-worker/index.ts`: worker interno autenticado.
- `supabase/migrations/20260916223850_whatsapp_visit_intake.sql`: dados, permissões e criação transacional.
- `supabase/migrations/20260916224736_visit_intake_active_conflicts.sql`: exclusão de ciclos encerrados da agenda e detalhes dos conflitos.
- `src/components/visitas/VisitIntake.tsx`: acompanhamento administrativo.
- `scripts/test-visit-intake.mjs`: regressões reais de banco em ambiente isolado.
