# Plano técnico — oportunidades independentes e exclusão integral de leads

Data: 26/08/2026
Projeto Supabase: `oxybasvtphosdmlmrfnb`

## Diagnóstico confirmado

1. A exclusão definitiva era executada diretamente em `leads`, mas três FKs (`distribution_queue`, `distribution_attempts` e `vendas`) usavam `NO ACTION`. Qualquer histórico nessas tabelas bloqueava toda a transação.
2. Outros registros pessoais (`agent_conversations`, `ai_lead_qualification` e `application_logs`) usavam `SET NULL`; portanto, mesmo quando a exclusão funcionasse, parte dos dados ligados ao cliente permaneceria órfã.
3. `crm_leads` possuía `UNIQUE (lead_id, pipeline_id)`. A modelagem representava “presença do lead no funil”, não uma negociação, impossibilitando duas oportunidades simultâneas no mesmo funil.
4. O empreendimento era lido de `leads.empreendimento_id`, portanto era global ao cliente e não ao card.
5. `process_crm_visit_automations()` movia todos os cards do mesmo lead quando uma visita mudava de status. Com múltiplas negociações, isso produziria movimentações indevidas.
6. Foi encontrado um card histórico ligado a uma etapa pertencente a outro pipeline. Não existia validação relacional para impedir essa inconsistência.
7. A tela do CRM filtrava da seleção os leads que já estavam no funil e apresentava nomenclatura de lead onde o objeto de negócio correto é oportunidade.

## Arquitetura aprovada após revisão

- Manter o nome físico `crm_leads` para compatibilidade, mas declarar cada linha como uma oportunidade independente.
- Remover somente a restrição de unicidade lead/funil; o UUID do card continua sendo a identidade da oportunidade.
- Adicionar `empreendimento_id` e `visita_id` à oportunidade.
- Manter o empreendimento legado no lead para os módulos existentes, usando-o apenas como valor inicial/backfill.
- Vincular oportunidades automáticas à visita de origem e tornar o vínculo único por pipeline/visita.
- Validar no banco que a etapa pertence ao mesmo pipeline da oportunidade.
- Criar RPCs transacionais, com autorização administrativa no servidor, para:
  - cadastrar um novo lead e sua primeira oportunidade;
  - gerar quantas oportunidades forem necessárias para um lead ativo;
  - excluir definitivamente o lead e todo o grafo relacionado.
- Usar `ON DELETE CASCADE` nas relações diretamente ligadas ao lead. As relações descendentes já possuem cascatas adequadas.
- Não alterar a lógica de distribuição, visitas, vendas, relatórios ou autenticação fora dos pontos necessários.

## Sequência de implementação

1. Reconfigurar as FKs de dados ligados ao lead para cascata e publicar a RPC administrativa de exclusão.
2. Evoluir `crm_leads`, fazer backfill de empreendimento/visita e reparar etapas inconsistentes.
3. Criar índices para leitura por pipeline/lead, empreendimento e idempotência por visita.
4. Substituir os gatilhos de visita para criar/mover apenas a oportunidade correta.
5. Atualizar tipos gerados do Supabase.
6. Atualizar o hook do CRM para trabalhar com oportunidade e chamar as RPCs transacionais.
7. Criar os modais “Adicionar Lead” e “Gerar Oportunidade”.
8. Exibir e editar o empreendimento da oportunidade no card e nos detalhes.
9. Atualizar textos, feedbacks, estados de carregamento e acessibilidade.

## Critérios de aceite e regressão

- Um administrador exclui um lead com visitas, venda, filas, tentativas, logs, conversas e cards; nenhum registro relacionado permanece.
- Usuários não administradores não executam a RPC de exclusão.
- O mesmo lead recebe duas ou mais oportunidades no mesmo pipeline, inclusive para empreendimentos diferentes.
- Cada oportunidade mantém UUID, etapa, posição, empreendimento, valor e notas próprios.
- Uma mudança de visita movimenta somente o card associado àquela visita.
- Uma etapa de outro pipeline é rejeitada pelo banco.
- Criar novo lead no CRM é atômico: falha no card também reverte o lead.
- A interface reflete imediatamente as criações, edições, movimentações e exclusões.
- TypeScript, lint, unitários, build, testes de rotas e E2E permanecem aprovados.
- Migrations local e remota ficam sincronizadas; advisors são revisados antes do deploy.

## Estratégia de publicação

1. Aplicar a migration antes do frontend por ser retrocompatível com a versão atual.
2. Executar testes SQL transacionais, sem deixar registros artificiais.
3. Regenerar tipos e executar a verificação local completa.
4. Commitar e enviar a branch e `main` somente com o estado validado.
5. Publicar o mesmo artefato testado em produção e verificar a aplicação online e os erros de runtime.
