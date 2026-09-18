# Auditoria e correção: códigos de visitas e respostas no WhatsApp

## Evidências e causas

1. **Código aleatório e versão ambígua.** O protocolo do pedido era um fragmento de UUID. O sufixo `V1` indicava revisão do pedido, não a posição da visita. As mensagens posteriores usavam outro fragmento, do UUID da visita.
2. **Corretor correto tratado como divergência.** O cadastro de Reno Alencar possui celular com nono dígito; a mensagem usou a representação antiga sem esse dígito. O algoritmo reconhecia a semelhança somente para sugerir opções e exigia igualdade literal para confirmar o telefone.
3. **Resposta citada descartada.** No registro da Evolution, a resposta `1` contém `message.conversation` e `contextInfo.stanzaId` na raiz de `data`. O normalizador recebia apenas `data.message`; assim perdia a referência ao aviso do bot. Nenhuma correção foi registrada para essa resposta. O identificador citado corresponde ao aviso persistido no outbox, e o autor corresponde ao pedido.

## Plano executado

### Códigos

- Contador transacional por data, compartilhado entre cadastro manual e WhatsApp; incremento por `INSERT ... ON CONFLICT DO UPDATE`, sem calcular `MAX + 1`.
- Código público `AG-DDMMYYYY-Vn`, utilizando a data da visita. A revisão de uma solicitação é identificada separadamente por `R1`, `R2` etc.
- O pedido reserva o número, e a visita criada herda a mesma reserva. Cancelamentos e duplicidades podem deixar lacunas; números não são reciclados.
- Pedidos sem data válida usam provisoriamente a data de recebimento em Brasília. Ao esclarecer a data antes do cadastro, recebem o código da data correta, mantendo o anterior como referência.
- Depois que a visita existe, o código é estável. Um reagendamento que cria outra visita recebe novo código. Edições de horário/data da mesma visita preservam seu identificador.
- UUIDs técnicos, relacionamentos e chave de sincronização da planilha permanecem os mesmos. A planilha ganha `codigo_visita`; mensagens e acompanhamento usam o código legível.
- Migração atribui códigos aos registros existentes sem processar pedidos pendentes. Protocolos anteriores são aceitos como aliases; mensagens já enviadas continuam vinculadas por seu identificador do provedor.
- Contadores e reservas ficam no esquema privado, com RLS e acesso negado a usuários do navegador. O banco controla o código e impede sua alteração pelo cliente.

### Identificação do corretor

- Aceitar a diferença exclusivamente do nono dígito após o DDD, somente em celulares brasileiros compatíveis, com nome completo normalizado e um único corretor correspondente.
- Usar o telefone oficial do cadastro no fluxo seguinte.
- Manter confirmação em homônimos não resolvidos, donos conflitantes, DDD diferente, alteração de outro dígito ou correspondência apenas aproximada. IA não decide identidade em conflito.

### Respostas citadas

- Normalizar o envelope completo, preservando referências externas e internas, inclusive mensagens temporárias e respostas de botões/listas.
- Vincular a resposta ao aviso persistido, grupo, instância e revisão. `1`, `2` e `3` resolvem a opção quando somente um campo possui alternativas.
- Preservar verificações de autor/Closer, revisão desatualizada e repetição de eventos. Conteúdo citado não é interpretado como um novo comando.

## Verificação

- Testes de regressão reproduzem o formato real da Evolution e o celular informado, com dados sintéticos para envio e sem contato com clientes.
- Testes de banco cobrem sequência diária, dois canais, herança do código, repetição de evento, correção de data, aliases, usuário não autorizado, versão antiga, imutabilidade e restrições do contador.
- Ensaio da migração em transação revertida no banco real: nove visitas e dois pedidos preservados; nenhum novo envio produzido; pedido da captura passa a `AG-18092026-V1` e permanece aguardando informações.
- A validação final inclui TypeScript, lint, testes de domínio/banco/rotas, build, segurança, Deno, testes de navegador e consultas de produção após publicação.

## Como testar online

Enviar novamente o padrão de agendamento com nome completo e telefone antigo ou atual do corretor; dados inequívocos devem prosseguir sem perguntar o corretor. Para uma dúvida real, citar o aviso de opções e responder o número. Também é possível responder novamente ao aviso antigo do pedido pendente: sua referência permanece válida, desde que a revisão ainda seja atual.

O pedido existente não foi reprocessado automaticamente, para não iniciar consultas reais ao corretor nem avisar o cliente durante a auditoria.

## Resultados da revisão e publicação

- Aprovados: 61 testes de lógica, 89 cenários de banco, 28 verificações de rotas e 6 testes de navegador; TypeScript, lint, build, varredura de segredos e auditoria de dependências também passaram.
- Migração aplicada: `20260917225657_visit_codes_and_intake_replies`. Tipos TypeScript regenerados a partir do banco.
- Oito funções atualizadas, incluindo webhook Evolution, processamento dos pedidos, acompanhamento, Match e sincronização de planilha.
- Prévia autenticada em produção, usando a mensagem original: HTTP 200, nenhuma pergunta pendente, Reno Alencar identificado e telefone canônico do cadastro selecionado. A prévia não cria visitas nem envia mensagens.
- Diagnósticos de produção: acompanhamento HTTP 200 sem falhas de envio; Match HTTP 200; aba VISITAS acessível.
- O consultor de segurança não apontou exposição das novas reservas. O aviso informativo de [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) é intencional para essas tabelas privadas, acessíveis pelas funções internas. Avisos gerais preexistentes sobre GraphQL, RPCs do CRM e proteção de senhas permanecem fora desta correção.
- Limite da validação: respostas reais de clientes/corretores não foram disparadas como teste; a repetição no grupo pelo usuário valida a entrega externa completa.
