# Guia de Monitoramento - MeMude Connect

## 1. Dashboard de Monitoramento

### 1.1 Métricas Principais

Acesse o dashboard administrativo em `/admin/analytics` para visualizar:

**Métricas de Distribuição:**
- Taxa de sucesso de distribuição (meta: >70%)
- Tempo médio de resposta dos corretores
- Total de tentativas vs aceites vs recusas
- Taxa de timeout

**Métricas de Corretores:**
- Corretores ativos vs inativos
- Performance individual (nota média, visitas realizadas)
- Taxa de aceite/recusa por corretor
- Tempo médio de resposta

**Métricas de Leads:**
- Leads por status
- Taxa de conversão
- Tempo médio até primeira visita
- Origem dos leads

### 1.2 Acesso aos Logs

**Logs de Edge Functions:**
- Evolution Webhook Handler: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/evolution-webhook-handler/logs
- Distribute Visit: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/distribute-visit/logs
- Distribute Lead: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/distribute-lead/logs

**Logs do Database:**
- Postgres Logs: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/logs/postgres-logs
- Auth Logs: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/logs/auth-logs

---

## 2. Queries de Monitoramento

### 2.1 Templates de Mensagens

**Verificar templates ativos:**
```sql
SELECT 
  id,
  name,
  category,
  type,
  is_system,
  is_active,
  created_at,
  updated_at
FROM message_templates
WHERE is_active = true
ORDER BY category, created_at DESC;
```

**Verificar uso de templates na distribuição:**
```sql
-- Verificar se templates de distribuição estão configurados
SELECT 
  name,
  category,
  type,
  content,
  variables
FROM message_templates
WHERE category IN ('visit_distribution', 'admin_notification')
  AND is_active = true;
```

**Verificar variáveis não resolvidas nos templates:**
```sql
-- Esta query ajuda a identificar variáveis que podem estar faltando
-- nos templates. Execute após criar/editar templates para validação.
SELECT 
  name,
  category,
  content,
  regexp_matches(content, '\{([^}]+)\}', 'g') as variables_found
FROM message_templates
WHERE is_active = true;
```

**Histórico de edições de templates:**
```sql
SELECT 
  mt.name,
  mt.category,
  mt.updated_at,
  p.first_name || ' ' || p.last_name as updated_by
FROM message_templates mt
LEFT JOIN profiles p ON p.id = mt.created_by
WHERE mt.updated_at > NOW() - INTERVAL '30 days'
ORDER BY mt.updated_at DESC;
```

### 2.2 Segurança

**Tentativas de acesso não autorizado:**
```sql
SELECT 
  user_id,
  action,
  table_name,
  ip_address,
  created_at
FROM audit_logs
WHERE action LIKE '%unauthorized%'
  OR action LIKE '%forbidden%'
ORDER BY created_at DESC
LIMIT 50;
```

**Mudanças de roles:**
```sql
SELECT 
  ur.user_id,
  ur.role,
  ur.created_at,
  ur.created_by,
  p.first_name,
  p.last_name
FROM user_roles ur
JOIN profiles p ON p.user_id = ur.user_id
WHERE ur.created_at > NOW() - INTERVAL '7 days'
ORDER BY ur.created_at DESC;
```

**Falhas de autenticação:**
```sql
-- Via Supabase Analytics
SELECT 
  timestamp,
  metadata.level,
  metadata.status,
  metadata.error
FROM auth_logs
WHERE metadata.status >= 400
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Verificar Edge Functions acessando system_settings:**
```sql
-- Esta query ajuda a identificar Edge Functions que podem
-- estar usando ANON_KEY quando deveriam usar SERVICE_ROLE_KEY
-- 
-- Se você vir erros de "Nenhuma configuração encontrada" nos logs,
-- provavelmente a Edge Function está usando ANON_KEY incorretamente

-- Verificar configurações do sistema
SELECT 
  key,
  LEFT(value, 50) as value_preview,
  updated_at,
  updated_by
FROM system_settings
ORDER BY updated_at DESC;

-- Se esta query retornar vazio quando executada via Edge Function,
-- a função está usando ANON_KEY e precisa ser atualizada para SERVICE_ROLE_KEY
```

### 2.2 Performance

**Distribuição de visitas - últimos 7 dias:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE response_type = 'accept') as accepts,
  COUNT(*) FILTER (WHERE response_type = 'reject') as rejects,
  COUNT(*) FILTER (WHERE status = 'expired') as timeouts,
  ROUND(AVG(
    CASE WHEN response_received_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (response_received_at - message_sent_at)) / 60
    END
  ), 2) as avg_response_time_minutes
FROM visit_distribution_attempts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Corretores com maior taxa de recusa:**
```sql
SELECT 
  c.id,
  p.first_name,
  p.last_name,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE vda.response_type = 'reject') as rejects,
  ROUND(
    COUNT(*) FILTER (WHERE vda.response_type = 'reject')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    1
  ) as reject_rate_percent
FROM corretores c
JOIN profiles p ON p.id = c.profile_id
LEFT JOIN visit_distribution_attempts vda ON vda.corretor_id = c.id
WHERE vda.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.id, p.first_name, p.last_name
HAVING COUNT(*) > 5
ORDER BY reject_rate_percent DESC
LIMIT 10;
```

**Visitas sem corretor atribuído:**
```sql
SELECT 
  v.id,
  v.data_visita,
  v.horario_visita,
  l.nome as lead_nome,
  l.telefone as lead_telefone,
  e.nome as empreendimento,
  v.created_at
FROM visitas v
JOIN leads l ON l.id = v.lead_id
LEFT JOIN empreendimentos e ON e.id = v.empreendimento_id
WHERE v.corretor_id IS NULL
  AND v.deleted_at IS NULL
  AND v.data_visita >= CURRENT_DATE
ORDER BY v.data_visita, v.horario_visita;
```

### 2.3 Webhooks

**Status dos webhooks - últimas 24h:**
```sql
SELECT 
  event_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed_successfully = true) as successful,
  COUNT(*) FILTER (WHERE processed_successfully = false) as failed,
  ROUND(AVG(processing_time_ms), 0) as avg_processing_time_ms
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total DESC;
```

**Webhooks com erros:**
```sql
SELECT 
  event_type,
  instance_name,
  error_message,
  created_at
FROM webhook_logs
WHERE processed_successfully = false
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 3. Alertas Automáticos

### 3.1 Notificações Proativas

A Edge Function `proactive-notifications` roda periodicamente e envia alertas para:

**Administradores:**
- 🚨 Visitas sem corretor após todas as tentativas
- 📊 Taxa de sucesso de distribuição < 70% (últimos 7 dias)
- 👤 Corretor com 3+ recusas consecutivas em 24h

**Corretores:**
- ⏰ Lembrete 5 minutos antes do timeout de resposta

### 3.2 Configurar Cron Jobs

**No Supabase Dashboard:**

1. Acesse: https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/database/extensions
2. Habilite a extensão `pg_cron`
3. Execute:

```sql
-- Calcular métricas diariamente às 1h AM
SELECT cron.schedule(
  'calculate-daily-metrics',
  '0 1 * * *', -- Cron expression: 1 AM todos os dias
  $$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/calculate-metrics',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Notificações proativas a cada hora
SELECT cron.schedule(
  'proactive-notifications',
  '0 * * * *', -- A cada hora
  $$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/proactive-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verificar timeouts de distribuição a cada 5 minutos
SELECT cron.schedule(
  'distribution-timeout-checker',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/distribution-timeout-checker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Limpeza de logs antigos (mensal)
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 2 1 * *', -- 2 AM no dia 1 de cada mês
  $$SELECT public.cleanup_old_sync_logs()$$
);
```

---

## 4. Dashboards Externos

### 4.1 Supabase Dashboard

**Visão Geral do Projeto:**
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb

**Seções Importantes:**
- **Database:** Tabelas, RLS, Functions
- **Auth:** Usuários, provedores, configurações
- **Edge Functions:** Status, logs, invocações
- **Logs:** Postgres, Auth, API, Realtime
- **Settings:** Configurações gerais, API keys

### 4.2 Métricas de Uso

**API Requests:**
```sql
-- Via Supabase Analytics
SELECT 
  DATE_TRUNC('day', timestamp) as date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status >= 200 AND status < 300) as successful,
  COUNT(*) FILTER (WHERE status >= 400) as errors
FROM edge_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;
```

**Database Connections:**
```sql
SELECT 
  datname,
  usename,
  application_name,
  client_addr,
  state,
  query_start
FROM pg_stat_activity
WHERE datname = 'postgres'
ORDER BY query_start DESC;
```

---

## 5. Troubleshooting

### 5.1 Problemas Comuns

**Webhook não está sendo processado:**
```sql
-- Verificar logs de webhook
SELECT * FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Verificar configuração Evolution API
SELECT value FROM system_settings WHERE key = 'evolution_api_url';
SELECT value FROM system_settings WHERE key = 'evolution_instance_name';
```

**Distribuição não está funcionando:**
```sql
-- Verificar fila de distribuição
SELECT * FROM visit_distribution_queue
WHERE status = 'in_progress'
  OR (status = 'pending' AND created_at > NOW() - INTERVAL '1 hour');

-- Verificar corretores ativos
SELECT COUNT(*) FROM corretores
WHERE status = 'ativo' AND deleted_at IS NULL;

-- Verificar tentativas recentes
SELECT * FROM visit_distribution_attempts
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Performance lenta:**
```sql
-- Verificar queries lentas
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Verificar locks
SELECT 
  locktype,
  relation::regclass,
  mode,
  granted
FROM pg_locks
WHERE NOT granted;
```

### 5.2 Comandos Úteis

**Reiniciar fila de distribuição:**
```sql
-- Liberar tentativas travadas
UPDATE visit_distribution_queue
SET status = 'failed',
    failure_reason = 'Manual reset - timeout'
WHERE status = 'in_progress'
  AND created_at < NOW() - INTERVAL '1 hour';
```

**Reprocessar webhook:**
```sql
-- Marcar para reprocessamento
UPDATE webhook_logs
SET processed_successfully = false
WHERE id = 'webhook-log-id-here';
```

---

## 6. Manutenção Regular

### 6.1 Checklist Diário

- [ ] Verificar dashboard de métricas
- [ ] Revisar logs de erro das Edge Functions
- [ ] Verificar visitas sem corretor atribuído
- [ ] Confirmar que webhooks estão sendo processados

### 6.2 Checklist Semanal

- [ ] Analisar taxa de sucesso de distribuição
- [ ] Revisar performance dos corretores
- [ ] Verificar tentativas de acesso não autorizado
- [ ] Limpar notificações antigas lidas

### 6.3 Checklist Mensal

- [ ] Executar linter de segurança do Supabase
- [ ] Revisar e atualizar políticas RLS se necessário
- [ ] Analisar tendências de métricas
- [ ] Backup do banco de dados
- [ ] Atualizar documentação se necessário

---

## 7. Contatos e Suporte

**Administrador do Sistema:**
- Email: reno@re9.online

**Suporte Técnico:**
- Lovable Discord: https://discord.gg/lovable
- Supabase Support: https://supabase.com/dashboard/support

**Recursos:**
- Documentação Supabase: https://supabase.com/docs
- Documentação Lovable: https://docs.lovable.dev
- Security.md: Ver arquivo SECURITY.md na raiz do projeto
