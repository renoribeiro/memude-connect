# CRM: conclusão de vendas e VGV

## Plano revisado — 22/09/2026

O CRM administrativo usa crm_leads como oportunidades, inclusive com empreendimento próprio. Vendas exige empreendimento, valor, comissão, imposto e data. A etapa is_final não representa necessariamente venda (Bolsão está marcado). O limite de 500 registros pode truncar contagens e valores.

1. Adicionar completed_stage_id ao pipeline com referência à etapa do próprio funil. Configuração administrativa transacional de nome, etapas e coluna concluída; impedir exclusão de etapas ocupadas e IDs de outro funil. Migrar automaticamente apenas o nome inequívoco Venda Realizada, sem usar is_final.
2. Adicionar vínculo venda_id, completed_at e archived_at à oportunidade. VENDIDO abre VendaModal preenchido; o cliente da oportunidade fica fixado. A confirmação valida entradas no servidor, bloqueia a oportunidade e cria a venda e move o cartão na mesma transação. Repetições retornam a venda existente. A autorização usa has_role e mantém RLS (security invoker).
3. Ao mudar a coluna concluída, transferir seus cartões preservando datas. Movimentação manual para essa coluna conta como conclusão do cartão, mas não inventa uma venda sem dados financeiros. VENDIDO permanece disponível nesses cartões. Vendas vinculadas ficam na etapa concluída; editar/cancelar a venda sincroniza o CRM. Cancelamento reabre na primeira etapa não concluída e preserva a venda cancelada em Vendas.
4. Arquivar cartões com conclusão anterior ao primeiro dia do mês em America/Sao_Paulo. Cron a cada minuto permite recuperação após indisponibilidade e independe de navegador aberto. Não excluir leads ou vendas. Consultar arquivados no CRM; cartões arquivados são somente leitura no quadro. O corte usa a entrada/conclusão no CRM, preservada após reordenação, e não a data retroativa informada na venda.
5. Cabeçalho por coluna: VGV em BRL, usando valor real da venda vinculada ou valor estimado da oportunidade. Sem valor contribui zero. Paginar todas as oportunidades com ordenação determinística e atualizar periodicamente. Totais do quadro usam a mesma regra.
6. Validar em PostgreSQL local (PGlite): autorização, atomicidade, repetição, IDs de outro funil, valores inválidos, renomeação/troca de etapa, exclusão ocupada, cancelamento, corte mensal e execução repetida. Testar cálculos e UI com respostas controladas; executar typecheck, lint, testes e build.
7. Aplicar somente esta migração, gerar tipos oficiais, verificar schema/cron/advisors. Commit seletivo sem alterações preexistentes do módulo de visitas; push, acompanhar deploy Vercel e verificar produção. Não criar vendas fictícias em produção, pois há integrações financeiras acionadas por triggers.

## Decisões

- Venda concluída comercialmente pode ter comissão com pagamento pendente; status financeiro não é convertido automaticamente para pago.
- A limpeza é arquivamento consultável. Leads e vendas continuam disponíveis e o vínculo é preservado.
- VGV das oportunidades abertas é estimado; após VENDIDO, usa o valor real. Os cabeçalhos explicitam essa regra.
- Não inferir que duas oportunidades do mesmo cliente sejam a mesma venda. Idempotência é por oportunidade, não por cliente.

## Critérios de aceite

- Falha na criação de venda não move cartão e falha na movimentação não deixa venda criada.
- Repetição da mesma conclusão não duplica venda.
- Coluna renomeada continua recebendo vendas e apenas admin altera configuração/conclui.
- Um cartão de setembro deixa o quadro ativo em outubro e permanece consultável; reordenar não renova a conclusão.
- VGV reflete todas as oportunidades, incluindo mais de 500 registros, valores nulos e centavos.
- Trabalho local preexistente permanece fora do commit desta entrega.

## Revisão e evidências

- Base de integração: origin/main aa2409f. A produção também continha telas de visitas do commit local 423d5b8; seus componentes frontend foram preservados em commit separado para não removê-los durante o deploy. As alterações não commitadas de templates permaneceram no workspace original.
- Migrações aplicadas no projeto oxybasvtphosdmlmrfnb: 20260922224552_crm_sales_completion e 20260922225959_crm_sales_role_check. Os nomes locais correspondem às versões registradas pelo Supabase.
- A função legada public.has_role é SECURITY INVOKER e referencia um schema privado sem USAGE para authenticated. As novas RPCs consultam a própria linha de user_roles, protegida por RLS, sem expandir permissões e sem utilizar profiles.role. Configuração validada em transação como authenticated/admin no banco real, seguida de ROLLBACK.
- 19 cenários PostgreSQL local aprovados, incluindo rollback após falha no movimento, idempotência, autorização, mudança de coluna, cancelamento, exclusão e corte mensal no horário de São Paulo.
- 53 testes unitários e 28 verificações de rotas aprovados. Typecheck, lint, varredura de segredos, auditorias de interface/distribuição, build e auditoria de dependências aprovados.
- Testes Playwright com API controlada: venda preenche e fixa cliente, salva e move cartão, falha conserva formulário, configuração persiste ID, consulta arquivados e totalização de 501 oportunidades. Smoke tests de login/roteamento aprovados. Nenhuma venda de teste criada em produção.
- Revisão visual do CRM aprovada. Corrigido reset dos seletores durante carregamento assíncrono de empreendimento/corretor; cancelamento do modal bloqueado enquanto salva.
- RLS preservada nas tabelas envolvidas, novas RPCs SECURITY INVOKER sem execução anônima. Cron ativo e execuções succeeded verificadas. Advisors mantêm avisos preexistentes (visibilidade de schema GraphQL, funções legadas e proteção de senhas), sem novos achados associados a esta implementação.

Limites de validação: as gravações comerciais foram testadas em banco local e via interface com API controlada; produção foi verificada por schema, permissões, transação de configuração revertida e execução do cron. Não foi efetuada uma venda real para teste, pois ela aciona integrações financeiras.
