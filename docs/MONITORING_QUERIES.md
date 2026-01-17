# Queries de Monitoramento - WhatsApp Distribution System

## 📋 Índice
- [Fase 7: Monitoramento Pós-Deploy](#fase-7-monitoramento-pós-deploy)
- [Queries de Performance](#queries-de-performance)
- [Alertas e Thresholds](#alertas-e-thresholds)
- [Troubleshooting Rápido](#troubleshooting-rápido)
- [Dashboards](#dashboards)

---

## Fase 7: Monitoramento Pós-Deploy

### Objetivo

Garantir que o sistema está operando conforme esperado após deploy da correção completa.

### KPIs Principais

| Métrica | Meta | Ação se Abaixo |
|---------|------|----------------|
| Taxa de sucesso de envio | > 95% | Investigar Evolution API |
| Taxa de resposta dos corretores | > 70% | Revisar mensagem/processo |
| Tempo médio de resposta | < 5 min | Analisar engajamento |
| Timeouts redistribuindo | 100% | Verificar timeout-checker |
| Falhas notificando admin | 100% | Validar notificações |

---

## Queries de Performance

### 1. Taxa de Sucesso de Envios (24h)

**Objetivo:** Medir quantos envios foram bem-sucedidos.

```sql
SELECT 
  COUNT(*) as total_envios,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as enviados_sucesso,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as enviados_falha,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_sucesso_percentual,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_falha_percentual
FROM communication_log
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND type = 'whatsapp'
  AND direction = 'enviado';
```

**Interpretação:**
- **> 95%:** ✅ Excelente
- **90-95%:** ⚠️ Monitorar
- **< 90%:** 🔴 Investigar urgentemente

---

### 2. Distribuições Pendentes

**Objetivo:** Quantas distribuições estão aguardando resposta.

```sql
SELECT 
  COUNT(*) as total_pendentes,
  COUNT(CASE WHEN timeout_at < NOW() THEN 1 END) as expiradas_nao_processadas,
  ROUND(AVG(EXTRACT(EPOCH FROM (timeout_at - NOW()))/60), 2) as tempo_medio_restante_minutos,
  MIN(timeout_at) as proxima_expiracao
FROM visit_distribution_attempts
WHERE status = 'pending';
```

**Interpretação:**
- `expiradas_nao_processadas > 0:` 🔴 Timeout checker não está rodando!
- `tempo_medio_restante_minutos < 5:` ⚠️ Muitas distribuições próximas ao timeout

---

### 3. Taxa de Resposta por Tipo (7 dias)

**Objetivo:** Entender padrão de respostas dos corretores.

```sql
SELECT 
  response_type,
  COUNT(*) as total_respostas,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentual,
  ROUND(AVG(EXTRACT(EPOCH FROM (response_received_at - message_sent_at))/60), 2) as tempo_medio_resposta_minutos
FROM visit_distribution_attempts
WHERE response_type IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY response_type
ORDER BY total_respostas DESC;
```

**Interpretação:**
- `response_type = 'accepted':` Corretores aceitando visitas
- `response_type = 'rejected':` Corretores recusando
- `response_type = 'unclear':` ⚠️ Respostas ambíguas (analisar padrões)

**Meta:**
- `accepted > 50%` ✅
- `rejected < 30%` ✅
- `unclear < 5%` ✅

---

### 4. Tempo Médio de Resposta por Corretor

**Objetivo:** Identificar corretores mais engajados.

```sql
SELECT 
  c.creci,
  p.first_name || ' ' || p.last_name as corretor_nome,
  COUNT(*) as total_respostas,
  SUM(CASE WHEN vda.response_type = 'accepted' THEN 1 ELSE 0 END) as aceitas,
  SUM(CASE WHEN vda.response_type = 'rejected' THEN 1 ELSE 0 END) as recusadas,
  ROUND(100.0 * SUM(CASE WHEN vda.response_type = 'accepted' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_aceitacao,
  ROUND(AVG(EXTRACT(EPOCH FROM (vda.response_received_at - vda.message_sent_at))/60), 2) as tempo_medio_resposta_minutos
FROM visit_distribution_attempts vda
JOIN corretores c ON c.id = vda.corretor_id
JOIN profiles p ON p.id = c.profile_id
WHERE vda.response_type IS NOT NULL
  AND vda.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.creci, p.first_name, p.last_name
ORDER BY tempo_medio_resposta_minutos ASC
LIMIT 20;
```

**Interpretação:**
- Corretores com `tempo_medio_resposta_minutos < 5`: ✅ Muito engajados
- Corretores com `taxa_aceitacao > 70%`: ✅ Bons performers
- Corretores com `taxa_aceitacao < 30%`: ⚠️ Analisar motivos

---

### 5. Distribuições que Falharam (últimas 24h)

**Objetivo:** Identificar visitas que esgotaram todas as tentativas.

```sql
SELECT 
  vdq.id as queue_id,
  vdq.visita_id,
  l.nome as lead_nome,
  l.telefone as lead_telefone,
  e.nome as empreendimento,
  vdq.failure_reason,
  vdq.completed_at as falhou_em,
  (SELECT COUNT(*) FROM visit_distribution_attempts WHERE visita_id = vdq.visita_id) as total_tentativas
FROM visit_distribution_queue vdq
JOIN visitas v ON v.id = vdq.visita_id
JOIN leads l ON l.id = v.lead_id
LEFT JOIN empreendimentos e ON e.id = v.empreendimento_id
WHERE vdq.status = 'failed'
  AND vdq.completed_at > NOW() - INTERVAL '24 hours'
ORDER BY vdq.completed_at DESC;
```

**Interpretação:**
- Qualquer resultado aqui: 🔴 Requer atenção manual do admin
- Admin deve ter sido notificado via WhatsApp

---

### 6. Message IDs Não Registrados

**Objetivo:** Identificar envios que não registraram `message_id`.

```sql
SELECT 
  cl.id,
  cl.phone_number,
  cl.created_at,
  cl.content,
  cl.metadata
FROM communication_log cl
WHERE cl.type = 'whatsapp'
  AND cl.direction = 'enviado'
  AND cl.status = 'sent'
  AND cl.message_id IS NULL
  AND cl.created_at > NOW() - INTERVAL '24 hours'
ORDER BY cl.created_at DESC;
```

**Interpretação:**
- Qualquer resultado: ⚠️ Bug na extração de `message_id`
- Verificar se `metadata.response.key.id` existe

**Debug:**
```sql
-- Ver metadata completo
SELECT metadata->'response'->'key'->>'id' as extracted_id, *
FROM communication_log
WHERE id = 'UUID_DO_LOG';
```

---

### 7. Webhooks Não Processados

**Objetivo:** Identificar webhooks recebidos mas não processados.

```sql
SELECT 
  event_type,
  instance_name,
  processed_successfully,
  error_message,
  processing_time_ms,
  created_at,
  payload->>'data' as webhook_data
FROM webhook_logs
WHERE processed_successfully = false
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Interpretação:**
- Qualquer resultado: 🔴 Investigar erro em `evolution-webhook-handler`
- Analisar `error_message` para identificar causa

---

## Alertas e Thresholds

### Configuração de Alertas

Utilize estas queries em ferramentas de monitoramento (ex: Grafana, Datadog) ou crie notificações via Supabase Database Webhooks.

### Alerta 1: Taxa de Sucesso Baixa

```sql
-- Se taxa < 95%, disparar alerta
SELECT 
  CASE 
    WHEN ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) < 95 
    THEN 'ALERTA: Taxa de sucesso baixa!'
    ELSE 'OK'
  END as status_alerta,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_atual
FROM communication_log
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND type = 'whatsapp'
  AND direction = 'enviado';
```

### Alerta 2: Timeouts Não Processados

```sql
-- Se existirem tentativas expiradas há mais de 5 minutos
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'ALERTA: Timeouts não processados!'
    ELSE 'OK'
  END as status_alerta,
  COUNT(*) as tentativas_expiradas,
  MIN(timeout_at) as expirou_ha
FROM visit_distribution_attempts
WHERE status = 'pending'
  AND timeout_at < NOW() - INTERVAL '5 minutes';
```

### Alerta 3: Webhooks com Erros

```sql
-- Se > 5 webhooks falharam na última hora
SELECT 
  CASE 
    WHEN COUNT(*) > 5 THEN 'ALERTA: Muitos webhooks falhando!'
    ELSE 'OK'
  END as status_alerta,
  COUNT(*) as webhooks_falhados
FROM webhook_logs
WHERE processed_successfully = false
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Troubleshooting Rápido

### Problema: Taxa de Sucesso < 95%

**Diagnóstico:**

```sql
-- Ver erros recentes
SELECT 
  content,
  status,
  metadata->'error' as erro,
  created_at
FROM communication_log
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**Possíveis Causas:**
1. Evolution API fora do ar
2. Configurações incorretas (`system_settings`)
3. Números inválidos

**Solução:**
1. Verificar status da Evolution API
2. Validar `system_settings`:

```sql
SELECT * FROM system_settings 
WHERE key IN ('evolution_api_url', 'evolution_api_key', 'evolution_instance_name');
```

---

### Problema: Timeouts Não Redistribuindo

**Diagnóstico:**

```sql
SELECT * FROM visit_distribution_attempts
WHERE status = 'pending'
  AND timeout_at < NOW()
ORDER BY timeout_at ASC
LIMIT 10;
```

**Possíveis Causas:**
1. `visit-distribution-timeout-checker` não está rodando
2. Cron job desabilitado

**Solução:**
1. Verificar logs do timeout-checker
2. Validar cron job:

```sql
SELECT * FROM cron.job
WHERE jobname LIKE '%timeout%';
```

3. Executar manualmente se necessário:

```typescript
await supabase.functions.invoke('visit-distribution-timeout-checker', { body: {} });
```

---

### Problema: Respostas Não Processadas

**Diagnóstico:**

```sql
-- Ver webhooks recentes
SELECT * FROM webhook_logs
WHERE event_type = 'messages.upsert'
  AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

**Possíveis Causas:**
1. Webhook não está configurado
2. Payload diferente do esperado
3. Erro no `evolution-webhook-handler`

**Solução:**
1. Verificar webhook configurado na Evolution API
2. Analisar payload recebido em `webhook_logs.payload`
3. Ver logs do `evolution-webhook-handler`

---

## Dashboards

### Dashboard Sugerido (SQL para visualização)

```sql
-- Resumo Executivo
WITH stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE cl.status = 'sent') as msgs_enviadas,
    COUNT(*) FILTER (WHERE cl.status = 'failed') as msgs_falhadas,
    (SELECT COUNT(*) FROM visit_distribution_attempts WHERE status = 'pending') as pendentes,
    (SELECT COUNT(*) FROM visit_distribution_queue WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as falhas_24h,
    ROUND(AVG(EXTRACT(EPOCH FROM (vda.response_received_at - vda.message_sent_at))/60) FILTER (WHERE vda.response_type IS NOT NULL), 2) as tempo_medio_resposta
  FROM communication_log cl
  LEFT JOIN visit_distribution_attempts vda ON vda.whatsapp_message_id = cl.message_id
  WHERE cl.created_at > NOW() - INTERVAL '24 hours'
)
SELECT 
  msgs_enviadas,
  msgs_falhadas,
  ROUND(100.0 * msgs_enviadas / NULLIF(msgs_enviadas + msgs_falhadas, 0), 2) as taxa_sucesso,
  pendentes,
  falhas_24h,
  tempo_medio_resposta || ' min' as tempo_medio
FROM stats;
```

**Output Esperado:**

| msgs_enviadas | msgs_falhadas | taxa_sucesso | pendentes | falhas_24h | tempo_medio |
|---------------|---------------|--------------|-----------|------------|-------------|
| 95            | 2             | 97.94        | 3         | 0          | 4.5 min     |

---

## Logs Supabase

### Edge Function Logs

**Evolution Send WhatsApp V2:**
```
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/evolution-send-whatsapp-v2/logs
```

**Filtros úteis:**
- `📤 Request para Evolution API v2`
- `📥 Response status: 200`
- `✅ Message sent successfully`
- `❌ Evolution API error`

**Evolution Webhook Handler:**
```
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/evolution-webhook-handler/logs
```

**Filtros úteis:**
- `=== WEBHOOK EVOLUTION API RECEBIDO ===`
- `Processing message upsert`
- `Resposta analisada: accepted`
- `✅ Lead aceito`

**Timeout Checker:**
```
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/visit-distribution-timeout-checker/logs
```

---

## Métricas de Negócio

### Conversão de Distribuição

```sql
SELECT 
  COUNT(DISTINCT vdq.visita_id) as total_distribuicoes,
  COUNT(DISTINCT CASE WHEN vdq.status = 'completed' THEN vdq.visita_id END) as aceitas,
  COUNT(DISTINCT CASE WHEN vdq.status = 'failed' THEN vdq.visita_id END) as falhadas,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN vdq.status = 'completed' THEN vdq.visita_id END) / COUNT(DISTINCT vdq.visita_id), 2) as taxa_conversao
FROM visit_distribution_queue vdq
WHERE vdq.created_at > NOW() - INTERVAL '30 days';
```

**Meta:** Taxa de conversão > 80%

---

## Checklist de Monitoramento Diário

- [ ] Verificar taxa de sucesso de envios (> 95%)
- [ ] Validar que não há timeouts não processados
- [ ] Conferir se há distribuições que falharam (notificar admin)
- [ ] Revisar tempo médio de resposta dos corretores
- [ ] Verificar logs de edge functions para erros
- [ ] Validar que webhooks estão sendo recebidos
- [ ] Confirmar que message_ids estão sendo registrados

---

**Última atualização:** 2025-11-18  
**Versão:** 1.0
