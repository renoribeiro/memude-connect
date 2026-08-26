# Auditoria de escalabilidade e armazenamento do banco

**Projeto:** MeMude Connect (`sistema-memude`)
**Supabase:** `oxybasvtphosdmlmrfnb`
**Data da medição:** 26/08/2026
**Objetivo:** reduzir o espaço ocupado e impedir crescimento operacional descontrolado sem alterar o funcionamento do CRM.

## 1. Resultado executivo

O banco medido ocupa **905 MB (948.489.363 bytes)**. O crescimento não é causado pelos dados de leads, corretores, imóveis, visitas ou vendas. **831 MB (91,8%)** estão concentrados em duas tabelas internas de agendamento e HTTP:

| Origem | Tamanho | Linhas úteis | Diagnóstico |
|---|---:|---:|---|
| `cron.job_run_details` | 508 MB | 599.956 | histórico ilimitado de 4.039 execuções por dia |
| `net._http_response` | 309 MB | ~1.000 (TTL de 6 horas) | fragmentação extrema causada por inserções e exclusões contínuas |
| schema `public` inteiro | 70 MB | dados da aplicação | volume pequeno; 46 MB ainda são logs, vetores ou fragmentação |
| schemas de sistema restantes | ~18 MB | metadados | normal para uma instalação Supabase |

O problema é, portanto, **retenção ausente no `pg_cron` e manutenção insuficiente em tabelas de alta rotatividade**. Não há justificativa técnica para sharding, troca de banco ou remoção de histórico comercial neste estágio.

Após a correção, o banco passou a ocupar **62 MB**, redução de **93,1%**, preservando sete dias de diagnóstico de cron, 30 dias de logs técnicos e todo o histórico funcional do CRM.

## 2. Evidências da auditoria

### 2.1 Crescimento do agendador

- 599.637 execuções concluídas com sucesso e 330 não concluídas com sucesso.
- 4.039 registros gerados nas últimas 24 horas.
- 28.273 registros gerados nos últimos sete dias.
- O histórico mais antigo remonta a 14/09/2025.
- O `pg_cron` não elimina automaticamente `cron.job_run_details`.
- Mantido por um ano, o padrão atual adiciona aproximadamente 1,47 milhão de registros por ano.

### 2.2 Rotatividade do `pg_net`

- `pg_net.ttl` está no padrão oficial de seis horas.
- A tabela contém aproximadamente mil respostas recentes, com tamanho médio próximo de 1,2 KB.
- Apesar disso, o arquivo físico da tabela ocupa 303 MB e os índices 5,7 MB.
- As estatísticas registraram centenas de milhares de inserções e mais de 416 mil lotes de exclusão.
- A tabela é `UNLOGGED` e operacional; compactá-la não remove dados de negócio.

### 2.3 Fragmentação em tabelas públicas

| Tabela | Tamanho | Linhas | Observação |
|---|---:|---:|---|
| `wp_sync_performance` | 21 MB | 453 | 80.994 exclusões históricas; forte fragmentação |
| `property_embeddings` | 14 MB | 464 | esperado para vetores de 1.536 dimensões e índice vetorial |
| `webhook_logs` | 8,7 MB | 1.084 | fragmentação após saneamento de payloads e retenção |
| `communication_log` | 7,0 MB | 16.900 | histórico funcional de mensagens; deve ser preservado |
| partição `integration_logs_y2026m07` | 6,1 MB | 920 | fragmentada após saneamento e retenção |
| partição `integration_logs_y2026m06` | 5,5 MB | 0 | espaço vazio ainda reservado no arquivo físico |

### 2.4 Estrutura e ciclo de vida

- Existe retenção diária de 30 dias para `application_logs`, `integration_logs` e `webhook_logs`.
- Existe retenção de 30 dias para logs de sincronização WordPress e de sete dias para o cache de categorias.
- Não existia retenção para `cron.job_run_details`.
- Limites expirados, cache de IA e métricas de saúde possuíam funções de limpeza, mas não havia um agendamento ativo único e verificável para todos eles.
- As partições mensais de `integration_logs` e `audit_logs` foram criadas somente até dezembro de 2026. Sem automação, registros de 2027 cairiam na partição default.
- Foram encontrados índices B-tree não únicos que duplicam integralmente índices `UNIQUE`. Eles não alteram resultados, mas duplicam custo de escrita e espaço conforme as tabelas crescem.
- O advisor marca muitos índices como “não utilizados”; eles **não** serão removidos em massa porque o sistema ainda não tem uma janela representativa de uso oficial.

## 3. Invariantes funcionais

As mudanças obedecem aos seguintes limites:

1. Nenhum lead, corretor, empreendimento, visita, venda, oportunidade de CRM ou mensagem é excluído.
2. `communication_log`, conversas e mensagens dos agentes permanecem integrais.
3. O intervalo e o comportamento dos jobs não são alterados.
4. Respostas HTTP recentes continuam disponíveis durante o TTL oficial do `pg_net`.
5. Sete dias de execuções de cron são preservados para diagnóstico, incluindo falhas.
6. Logs técnicos continuam disponíveis por 30 dias.
7. Auditoria de negócio não recebe política de exclusão automática nesta mudança.
8. Índices funcionais, parciais, de chaves estrangeiras e vetoriais são preservados.

## 4. Plano de ajuste revisado

### Fase A — prevenção permanente

1. Criar `cleanup_database_operational_history()` com privilégios mínimos e `search_path` fixo.
2. Eliminar diariamente somente:
   - execuções de cron encerradas há mais de sete dias;
   - execuções órfãs iniciadas há mais de sete dias;
   - rate limits expirados há mais de cinco minutos;
   - respostas de cache já expiradas;
   - métricas técnicas de saúde com mais de sete dias.
3. Agendar a função diariamente e manter o job idempotente por nome.
4. Ajustar autovacuum por tabela nas relações de alta rotatividade, sem alterar parâmetros globais.
5. Criar automaticamente partições mensais quatro meses à frente para `integration_logs` e `audit_logs`.
6. Remover apenas índices comprovadamente redundantes por equivalência estrutural com índices `UNIQUE`.

### Fase B — recuperação única do espaço

1. Executar a nova limpeza, preservando sete dias de cron.
2. Verificar ausência de operações longas conflitantes.
3. Para as tabelas gerenciadas por extensões, que pertencem a `supabase_admin`, executar uma reescrita atômica com limiar de segurança:
   - copiar somente os sete dias úteis de `cron.job_run_details` para tabela temporária, truncar e reinserir;
   - copiar as respostas ainda dentro do TTL de `net._http_response`, truncar e reinserir;
   - repetir automaticamente apenas quando excederem, respectivamente, 128 MB e 64 MB.
4. Executar `VACUUM FULL` apenas nas tabelas públicas comprovadamente fragmentadas (`wp_sync_performance`, `webhook_logs` e partições antigas de `integration_logs`).
5. Executar `ANALYZE` e medir novamente tamanhos e linhas.

A reescrita atômica e o `VACUUM FULL` bloqueiam somente cada tabela técnica alvo durante a operação. A janela pré-go-live é o momento de menor risco. As tabelas centrais de negócio não são bloqueadas por essa manutenção.

### Fase C — validação

1. Comparar bytes antes/depois por schema e relação.
2. Confirmar que todos os jobs continuam ativos e registrando novas execuções.
3. Confirmar que chamadas `pg_net` continuam recebendo respostas.
4. Confirmar as partições futuras e a partição default vazia.
5. Reexecutar advisors do Supabase.
6. Rodar typecheck, lint, testes unitários, testes de rotas e build de produção.
7. Verificar a aplicação publicada e os logs do deploy.

### Fase D — orçamento operacional

| Métrica | Normal | Atenção | Crítico |
|---|---:|---:|---:|
| banco lógico | < 200 MB | 200–350 MB | > 350 MB |
| `cron.job_run_details` | < 45 MB | 45–80 MB | > 80 MB |
| `net._http_response` | < 15 MB | 15–40 MB | > 40 MB |
| logs técnicos públicos | < 100 MB | 100–250 MB | > 250 MB |
| partição default de logs | 0 linhas | 1–100 linhas | > 100 linhas |

O arquivo `scripts/audit-database-scalability.sql` contém a medição read-only para repetição mensal ou durante incidentes.

## 5. Revisão crítica do plano

O plano foi revisado contra os riscos de perda de dados, indisponibilidade, regressão funcional e otimização prematura.

- **Retenção de cron:** sete dias cobrem o painel operacional e investigação de falhas, que usam últimas execuções e janela de 24 horas. Não há consumidor da aplicação que dependa do histórico anual.
- **TTL do `pg_net`:** permanece em seis horas, exatamente o padrão da extensão. O ajuste atua em fragmentação e autovacuum, não no contrato de resposta.
- **Logs comerciais:** não recebem expiração nesta rodada. O ganho de espaço vem dos artefatos técnicos.
- **Índices:** a recomendação genérica de eliminar todos os “unused” foi rejeitada. Somente duplicatas exatas de índices únicos são removidas.
- **Particionamento:** não será expandido para tabelas pequenas. A automação apenas completa a estratégia que já existe para logs.
- **Vetores:** não será reduzida precisão, dimensão ou índice, pois isso mudaria a busca semântica. Os 14 MB atuais são proporcionais ao recurso.
- **Arquivamento externo:** não é necessário nesta escala e aumentaria complexidade operacional sem benefício imediato.
- **Sharding/read replicas:** não resolvem retenção ou bloat e foram rejeitados para este problema.
- **Redução do disco provisionado:** a redução lógica aparece após a compactação; a redução do volume físico provisionado pela nuvem, quando aplicável, depende de upgrade/migração da instância no painel Supabase.

## 6. Rollback e recuperação

- A função e o job de limpeza podem ser removidos sem afetar dados restantes.
- Reloptions de autovacuum podem ser restauradas com `ALTER TABLE ... RESET (...)`.
- Partições novas são tabelas vazias antecipadas e não alteram as consultas ao pai.
- Índices redundantes podem ser recriados, embora os índices únicos equivalentes continuem atendendo às mesmas buscas.
- A reescrita atômica preserva as linhas dentro da retenção e não reinicia as sequências das extensões.
- `VACUUM FULL` não muda valores; apenas reescreve o armazenamento físico.

## 7. Referências oficiais

- Supabase — Understanding Database and Disk Size: https://supabase.com/docs/guides/platform/database-size
- Supabase — Cron: https://supabase.com/docs/guides/cron
- Supabase — `pg_net`: https://supabase.com/docs/guides/database/extensions/pg_net
- Supabase — Database Advisor `0020_table_bloat`: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0020_table_bloat
- PostgreSQL — Routine Vacuuming: https://www.postgresql.org/docs/current/routine-vacuuming.html

## 8. Registro da execução

Implementação remota concluída em 26/08/2026:

- Tamanho antes: **905 MB (948.489.363 bytes)**.
- Tamanho depois: **62 MB (65.236.115 bytes)**.
- Redução: **883.253.248 bytes / 93,1%**.
- `cron.job_run_details`: **508 MB → 14 MB**; **599.956 → 28.273** linhas preservadas inicialmente.
- `net._http_response`: **309 MB → 1,4 MB**; 1.018 respostas dentro do TTL preservadas.
- schema `public`: **70 MB → 30 MB**, sem remover dados funcionais.
- Migração aplicada: `20260826210826_optimize_database_storage_and_operational_retention.sql`.
- Jobs adicionados e ativos: limpeza diária, compactação mensal por limiar e criação mensal de partições.
- Segurança das funções: `anon` e `authenticated` sem `EXECUTE`; somente `service_role` e o owner operacional.
- Prova de `pg_net`: HTTP 200, sem timeout e com payload de eco íntegro após a compactação.
- Prova de `pg_cron`: jobs de distribuição e fila executaram novamente com status `succeeded` após a compactação.
- Advisor de performance: **nenhum bloat**; 405 recomendações restantes (141 índices ainda sem janela de uso e 264 policies permissivas), fora da redução segura de armazenamento.
- Advisor de segurança: 69 avisos preexistentes, sem regressão causada pela mudança.
- `npm run check`: aprovado (typecheck, lint, secrets, auditorias estáticas, 43 testes unitários, 28 testes de rota, build e dependências).
- `npm run test:e2e`: aprovado, 3/3 cenários públicos.
- Commit, push e deploy: executados ao final desta certificação; identificadores constam no resumo de entrega.
