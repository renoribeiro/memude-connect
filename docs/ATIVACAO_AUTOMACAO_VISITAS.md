# Automação de visitas — implementação e ativação

## Situação desta entrega

ATUALIZAÇÃO 16/09/2026: automação ativada para novos agendamentos após autorização de substituir o webhook do n8n. evolution-configure-webhook confirmou destino evolution-webhook-handler na instância memude-visitas, com autenticação e eventos MESSAGES_UPSERT, MESSAGES_UPDATE e CONNECTION_UPDATE. Teste sintético autenticado retornou HTTP 200. Fila vazia antes da ativação. Planilha com leitura/escrita validada; Closer e grupo configurados. Os registros abaixo preservam o histórico da publicação e das validações anteriores. Uma resposta real de cliente/corretor a um botão ainda não foi validada nesta sessão.

Publicada em produção em 15/09/2026 (America/Sao_Paulo), ainda desativada para mensagens reais. O código enviado do Apps Script foi analisado; nenhum script Google foi alterado.

- Supabase: migration `20260916004310_visit_lifecycle.sql` aplicada pelo conector autenticado; nome local alinhado à versão registrada remotamente.
- Funções publicadas: visit-lifecycle v1, monitor-visits v15, send-visit-reminder v12, evolution-webhook-handler v80 e waha-webhook-handler v15.
- Tipos TypeScript regenerados pelo gerador oficial conectado ao banco remoto.
- Vercel: deployment `dpl_4ua1ZaxSsusomSjErJKGcFop58tD`, status READY, produção em https://core.memudecore.com.br.
- Verificação: domínio e bundle de Configurações retornam HTTP 200; bundle remoto idêntico ao compilado localmente; API administrativa sem autenticação retorna 401. Monitor executado pelo cron retornou HTTP 200 com enabled=false e processed=0.
- npm run check aprovado após regeneração dos tipos; 18 cenários PostgreSQL aprovados novamente após alinhar o nome da migration.
- Pendências para ativação: credencial Google, compartilhamento como Editor, telefone do Closer, instância/grupo e teste controlado de mensagens e escrita.

### Validação posterior da credencial

Em 16/09/2026, a instância foi atualizada para memude-visitas após connectionState retornar open. Grupo MeMude - Comercial e Vendas localizado e salvo (120363417112012222@g.us). Testes textuais ao Closer e ao grupo aceitos pela Evolution com HTTP 201, status PENDING (IDs 3EB072F75E020C45A8E99D e 3EB0EC78496DBD25EEF3BB); isso não comprova leitura. Webhook atual aponta para https://n8n.memudecore.com.br/webhook/agendar-visita, com MESSAGES_UPSERT ativo. Automação permanece desativada aguardando definição sobre preservar esse fluxo e encaminhar respostas ou substituí-lo pelo CRM. O webhook não foi alterado.

Credencial Google validada no servidor: leitura da aba VISITAS (22 cabeçalhos) e escrita do mesmo valor no cabeçalho id_visita aprovadas, sem alteração das linhas de visitas. Closer e instância avisosmemude configurados. Grupo solicitado: MeMude - Comercial e Vendas. A consulta de grupos retornou HTTP 500; connectionState confirmou state=close. Automação permanece desativada até reconectar o WhatsApp, validar o grupo e testar mensagens. O monitor oferece diagnóstico autenticado interno check=sheet (write=1 para verificar escrita) e check=groups.

As regras decididas com o usuário estão em `AUDITORIA_AUTOMACAO_VISITAS_2026-09-15.md`.

## Fluxo implementado

- Administrador configura um Closer por telefone, instância Evolution e grupo selecionado entre os grupos da instância.
- Cadastro futuro com automação ativa inicia acompanhamento por trigger, independentemente da tela de origem.
- Véspera: lembrete na primeira execução dentro de 7h–20h; no mesmo dia, lembrete quando restarem até 2h, sem enviar lembrete vencido após o horário da visita.
- Mensagens regulares respeitam 7h–20h em America/Sao_Paulo. Pergunta de ocorrência, cancelamentos e escaladas são urgentes; não aguardam janela comercial.
- T+1h: corretor recebe SIM/NÃO para ocorrência; T+2h sem resposta: alerta de apuração. O cron passa a executar a cada minuto; os prazos têm a latência normal da fila/provedor.
- Uma hora antes, confirmação ausente gera pendência e aviso; não cancela a visita.
- SIM: realizada, pesquisa 0–10 com zero válido e feedback do Closer pendente.
- NÃO: motivo e pendência de recuperação. Ler o aviso ou registrar motivo não resolve a pendência.
- Closer registra interesse, objeções, próximo passo e prazo de retorno na aplicação.
- Nova visita vinculada ou desistência explícita encerram recuperação. Nova visita recebe seu próprio ciclo.
- Corretor que recusa antes da visita pode ser substituído pelo Closer, com invalidação das confirmações anteriores.
- Eventos de negócio e perguntas enviadas geram avisos ao Closer/grupo e sincronização da planilha. Falhas têm novas tentativas e ficam visíveis no painel.

O painel e suas ações usam o papel administrativo existente. Não foi criado novo papel de acesso nem alterado acesso de contas existentes. A conta usada pelo Closer precisa ter acesso administrativo para operar este painel.

## Pontos de entrada

- Configurações → Automação de visitas → Lembretes e acompanhamento de visitas.
- Visitas → Acompanhamento do Closer.
- Faixa persistente de pendências nas telas administrativas.
- Função `visit-lifecycle`: administração, histórico e ações; valida admin no servidor.
- Função `monitor-visits`: worker autenticado pelo mecanismo interno existente.
- Webhooks Evolution/WAHA: respostas identificadas processadas antes da distribuição e IA.

As tabelas novas têm RLS ativo e não concedem leitura/escrita a anon ou authenticated. As operações passam pelo servidor autorizado; RPCs internas são executáveis somente por service_role. Os arquivos gerados do Supabase não foram editados manualmente.

## Google Sheets

Destino fixo: arquivo `1Oycr_RxrO0syRw0n4IdNWfmPVfJPVfXkqbI8eKjmapI`, aba VISITAS.

Criar/configurar uma conta de serviço Google com a Sheets API habilitada e compartilhar o arquivo como Editor com o `client_email` dessa conta. Armazenar o JSON de credencial como segredo **VISIT_GOOGLE_SERVICE_ACCOUNT** nas Edge Functions. Nunca colocar essa credencial no frontend, em system_settings, no Git ou em mensagens de WhatsApp.

A conta de serviço usa OAuth de servidor e não depende da sessão do assistente ou de um navegador aberto. A ativação valida a leitura dos cabeçalhos; a permissão de escrita precisa ser confirmada no teste controlado antes da operação.

A sincronização usa `id_visita` para localizar e atualizar uma linha. Se encontrar IDs duplicados, falha para revisão manual em vez de escolher arbitrariamente uma linha. Novas visitas são acrescentadas. Visitas antigas sem ID não são importadas, vinculadas por nome/telefone nem sobrescritas automaticamente.

Preserva colunas manuais como Responsável, Data Venda, Follow Up Lucas, Follow Up NO SHOW e ultima tentativa. Escreve os campos cadastrais, Feedback, Status, referências e confirmações. Acrescenta ao fim do cabeçalho, se ausentes: nota_corretor_0_10, motivo_nao_realizacao, proximo_passo, prazo_retorno, objecoes, interesse e visita_anterior_id.

A revisão atual lê IDs até a linha 100.000. Acima desse volume, ampliar para leitura paginada antes de operar. A fila serializa lotes de sincronização para reduzir disputas; não há garantia de exatamente uma entrega quando o provedor aceita uma requisição e a conexão cai antes da resposta.

## Apps Script recebido

O trecho fornecido contém relatório por e-mail da aba LEADS, busca/inclusão/exclusão de linhas e append na aba VISITAS. Não contém WhatsApp.

Ele pode coexistir com a sincronização nova. O código mostrado tem `doPost` e relatório aninhados dentro de `myFunction`; nessa forma não são entrypoints globais. O `doGet` usa a aba ativa e não demonstra autenticação. Não foi verificado se esse endpoint está publicado ou acessível publicamente. Nenhum desses endpoints é utilizado pela integração nova.

Não substituir ou executar o script recebido automaticamente: pode haver consumidores e gatilhos externos. A integração nova usa diretamente a Sheets API. Evitar que outro integrador registre novamente os mesmos novos agendamentos sem `id_visita`.

## Ordem de publicação

1. Reconciliar migrations locais/remotas antes de qualquer db push: a auditoria encontrou evoluções remotas de CRM não refletidas no SQL histórico local. Não executar um push indiscriminado do diretório.
2. Aplicar a migration `20260916004310_visit_lifecycle.sql` revisada (já aplicada em produção). Ela inicia desabilitada, não importa visitas antigas e mantém o comando autenticado do cron existente, alterando somente sua frequência.
3. Publicar conjuntamente `visit-lifecycle`, `monitor-visits`, `send-visit-reminder`, `evolution-webhook-handler`, `waha-webhook-handler` e quaisquer funções que importem `_shared/distribution-logic.ts`. As dependências compartilhadas novas precisam acompanhar o bundle.
4. Configurar o segredo Google e garantir acesso da conta de serviço à planilha.
5. Gerar novamente os tipos pelo CLI quando a migration estiver aplicada ao ambiente vinculado; nenhuma edição manual de types.ts.
6. Publicar o frontend. Não publicar frontend antes do backend: o painel exibirá indisponibilidade se a função/tabelas não existirem.
7. Salvar Closer, instância e grupo em Configurações; validar em ambiente/números de teste o suporte a botões, remetente/LID, recebimento e escrita na planilha.
8. Ativar para novos cadastros após esse teste. Não usar clientes reais no teste de ativação.

Pausar em Configurações impede novas capturas e envios. Perguntas já enviadas podem ser respondidas depois; enquanto pausado, o backend não altera estados por respostas. Pendências e histórico ficam guardados. Reativação retoma a fila; revisar acúmulo antes de uma pausa prolongada.

## Testes executáveis

```
npm run check
npm run test:visits:db
npm run test:e2e
npx --yes deno@2.5.6 check --no-lock supabase/functions/visit-lifecycle/index.ts supabase/functions/monitor-visits/index.ts supabase/functions/send-visit-reminder/index.ts supabase/functions/evolution-webhook-handler/index.ts supabase/functions/waha-webhook-handler/index.ts
```

O teste de banco usa PGlite, PostgreSQL isolado em memória, com fixtures sintéticas dos contratos relevantes. Não se conecta à produção. O teste de navegador do acompanhamento usa respostas simuladas do Supabase e não envia mensagens.

Cobertura de banco: automação desligada, permissões, deduplicação de perguntas, remetente incorreto, resposta repetida, nota zero, silêncio, motivo sem resolução, edição indevida, reagendamento atômico, erro de reagendamento, resposta obsoleta, substituição de corretor, exclusão lógica, fuso, feedback separado da nota, exclusão mútua do worker e falha com nova tentativa.

## Limites e pendências de produção

- Botões, mensagens reais e escrita real na planilha ainda não foram testados. A alternativa textual mantém referência explícita da pergunta; nota/motivo sem referência são aceitos apenas com contexto único.
- O status de envio significa aceitação pelo provedor/destino, não confirmação de leitura no telefone.
- Respostas binárias sem botão/referência não alteram o novo ciclo. Em caso de perguntas simultâneas, usar o botão correspondente; o sistema não adivinha.
- O transporte do novo worker usa a instância Evolution selecionada. O webhook WAHA reconhece o formato, mas o novo fluxo não oferece seleção de envio WAHA.
- Pesquisa e motivo expiram após 7 dias; não há cobrança infinita da nota. Pendências de recuperação não expiram.
- Revisão das partições de logs sem RLS e configuração de proteção de senhas vazadas, identificadas na auditoria, continuam pendentes no ambiente remoto. Não foram alteradas como efeito colateral desta implementação.
- A vulnerabilidade de dependências identificada na auditoria foi corrigida no lockfile local; npm audit passou a informar zero vulnerabilidades.
