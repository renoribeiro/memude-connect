# Plano de Testes - WhatsApp Distribution System

## 📋 Índice
- [Fase 5: Testes Completos](#fase-5-testes-completos)
- [Testes Unitários](#testes-unitários)
- [Testes de Integração](#testes-de-integração)
- [Testes de Timeout](#testes-de-timeout)
- [Checklist de Validação](#checklist-de-validação)

---

## Fase 5: Testes Completos

### Objetivo

Validar que todas as correções implementadas funcionam corretamente end-to-end.

### Duração Estimada

⏱️ 1 hora

---

## Testes Unitários

### 5.1 Teste de Envio Direto

**Objetivo:** Validar que `evolution-send-whatsapp-v2` envia mensagens corretamente.

#### Setup

```typescript
// No console do Supabase (SQL Editor ou via cliente)
const { data, error } = await supabase.functions.invoke(
  'evolution-send-whatsapp-v2',
  {
    body: {
      phone_number: '5585996227722',  // SEU NÚMERO DE TESTE
      message: '🧪 *TESTE DE ENVIO*\n\nEsta é uma mensagem de teste do sistema.\n\n_Ignore esta mensagem._'
    }
  }
);

console.log('Data:', data);
console.log('Error:', error);
```

#### Validações

- [ ] ✅ Função retorna `success: true`
- [ ] ✅ Resposta contém `result.key.id`
- [ ] ✅ Mensagem é recebida no WhatsApp
- [ ] ✅ Formatação markdown funciona (negrito, itálico)

#### Logs Esperados

```
📤 Request para Evolution API v2: {
  url: "https://sua-api.com/message/sendText/GTFit",
  method: "POST",
  payload: { number: "5585996227722", text: "..." },
  headers: { ... }
}

📥 Response status: 200
📥 Response body: { "key": { "id": "..." }, ... }
✅ Message sent successfully: { ... }
```

#### Verificar no Banco

```sql
-- Verificar se foi registrado em communication_log
SELECT 
  id,
  phone_number,
  content,
  status,
  message_id,
  metadata,
  created_at
FROM communication_log
WHERE phone_number = '5585996227722'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado Esperado:**
- `status = 'sent'`
- `message_id` preenchido (exemplo: `3EB0A1B2C3D4E5F6`)
- `metadata.api_version = 'v2'`
- `metadata.endpoint = '/message/sendText/GTFit'`

---

## Testes de Integração

### 5.2 Teste de Distribuição Completa

**Objetivo:** Validar fluxo completo de distribuição de visita.

#### Pré-requisitos

1. **Corretor de teste cadastrado:**
   - WhatsApp válido
   - Status: `aprovado`
   - Bairros/construtoras configurados

2. **Lead de teste criado:**
   - Nome, telefone, e-mail
   - Empreendimento vinculado

3. **Visita agendada:**
   - Data futura
   - Horário definido
   - Corretor não designado

#### Passo a Passo

**1. Criar visita (se não existir):**

```sql
-- Buscar lead de teste
SELECT id, nome FROM leads WHERE email = 'teste@teste.com' LIMIT 1;

-- Criar visita
INSERT INTO visitas (lead_id, empreendimento_id, data_visita, horario_visita, status)
VALUES (
  'UUID_DO_LEAD',
  'UUID_DO_EMPREENDIMENTO',
  CURRENT_DATE + INTERVAL '7 days',
  '14:00',
  'agendada'
)
RETURNING id;
```

**2. Disparar distribuição:**

```typescript
const { data, error } = await supabase.functions.invoke(
  'distribute-visit',
  {
    body: {
      visita_id: 'UUID_DA_VISITA'
    }
  }
);
```

**3. Validações:**

- [ ] ✅ Função retorna sucesso
- [ ] ✅ Mensagem é enviada ao corretor
- [ ] ✅ Mensagem contém todos os dados da visita
- [ ] ✅ Instruções de resposta estão claras
- [ ] ✅ Timer de timeout está visível

**4. Verificar banco:**

```sql
-- Verificar tentativa criada
SELECT 
  vda.id,
  vda.status,
  vda.whatsapp_message_id,
  vda.timeout_at,
  c.creci as corretor
FROM visit_distribution_attempts vda
JOIN corretores c ON c.id = vda.corretor_id
WHERE vda.visita_id = 'UUID_DA_VISITA'
ORDER BY vda.created_at DESC
LIMIT 1;

-- Verificar queue
SELECT * FROM visit_distribution_queue
WHERE visita_id = 'UUID_DA_VISITA';
```

**Resultado Esperado:**
- `status = 'pending'`
- `whatsapp_message_id` preenchido
- `timeout_at` = now() + 15 minutos
- `queue.status = 'in_progress'`

---

### 5.3 Teste de Aceitação (SIM)

**Objetivo:** Validar processamento de resposta positiva.

#### Execução

1. Corretor recebe mensagem de distribuição
2. Corretor responde: **"SIM"** (ou "Sim", "sim!", "✅ SIM")

#### Validações

- [ ] ✅ Webhook é recebido
- [ ] ✅ Resposta é normalizada corretamente
- [ ] ✅ Tentativa atualizada: `status = 'accepted'`
- [ ] ✅ Visita atualizada: `corretor_id` preenchido
- [ ] ✅ Queue atualizada: `status = 'completed'`
- [ ] ✅ Outras tentativas canceladas
- [ ] ✅ Mensagem de confirmação enviada ao corretor

#### Verificar Logs

```bash
# Webhook Handler Logs
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/evolution-webhook-handler/logs

# Procurar por:
# - "Processing message upsert"
# - "Resposta analisada: accepted"
# - "✅ Lead aceito"
```

#### Verificar Banco

```sql
-- Tentativa deve estar accepted
SELECT status, response_type, response_message, response_received_at
FROM visit_distribution_attempts
WHERE visita_id = 'UUID_DA_VISITA'
  AND status = 'accepted';

-- Visita deve ter corretor designado
SELECT corretor_id, status
FROM visitas
WHERE id = 'UUID_DA_VISITA';

-- Queue deve estar completed
SELECT status, assigned_corretor_id, completed_at
FROM visit_distribution_queue
WHERE visita_id = 'UUID_DA_VISITA';
```

---

### 5.4 Teste de Rejeição (NÃO)

**Objetivo:** Validar processamento de resposta negativa e redistribuição.

#### Execução

1. Corretor recebe mensagem de distribuição
2. Corretor responde: **"NÃO"** (ou "Não", "nao", "❌ NÃO")

#### Validações

- [ ] ✅ Webhook é recebido
- [ ] ✅ Resposta normalizada: "nao"
- [ ] ✅ Tentativa atualizada: `status = 'rejected'`
- [ ] ✅ Sistema busca próximo corretor elegível
- [ ] ✅ Nova tentativa criada para próximo corretor
- [ ] ✅ Nova mensagem enviada
- [ ] ✅ Queue permanece `in_progress`

#### Verificar Banco

```sql
-- Primeira tentativa deve estar rejected
SELECT 
  attempt_order,
  status,
  response_type,
  corretor_id
FROM visit_distribution_attempts
WHERE visita_id = 'UUID_DA_VISITA'
ORDER BY attempt_order;

-- Deve haver tentativa 2
-- attempt_order = 1: status = rejected
-- attempt_order = 2: status = pending

-- Queue ainda in_progress
SELECT status, current_attempt
FROM visit_distribution_queue
WHERE visita_id = 'UUID_DA_VISITA';
-- current_attempt deve ser 2
```

---

## Testes de Timeout

### 5.5 Teste de Timeout e Redistribuição

**Objetivo:** Validar que timeouts são detectados e redistribuídos automaticamente.

#### Setup

**1. Configurar timeout curto (para teste):**

```sql
UPDATE distribution_settings
SET timeout_minutes = 2  -- 2 minutos para teste (padrão: 15)
WHERE id = (SELECT id FROM distribution_settings LIMIT 1);
```

**2. Disparar distribuição:**

```typescript
const { data } = await supabase.functions.invoke('distribute-visit', {
  body: { visita_id: 'UUID_DA_VISITA' }
});
```

**3. NÃO RESPONDER à mensagem.**

**4. Aguardar 2 minutos.**

**5. Timeout checker roda (a cada 2 minutos via cron):**
- Ou aguardar execução automática
- Ou disparar manualmente:

```typescript
await supabase.functions.invoke('visit-distribution-timeout-checker', {
  body: {}
});
```

#### Validações

- [ ] ✅ Tentativa 1 atualizada: `status = 'timeout'`
- [ ] ✅ Nova tentativa criada automaticamente (tentativa 2)
- [ ] ✅ Mensagem enviada ao próximo corretor
- [ ] ✅ Queue permanece `in_progress`
- [ ] ✅ Logs registram timeout e redistribuição

#### Verificar Banco

```sql
SELECT 
  attempt_order,
  status,
  timeout_at,
  corretor_id,
  created_at
FROM visit_distribution_attempts
WHERE visita_id = 'UUID_DA_VISITA'
ORDER BY attempt_order;

-- Resultado esperado:
-- attempt_order = 1: status = 'timeout'
-- attempt_order = 2: status = 'pending'
```

#### Verificar Logs

```bash
# Timeout Checker Logs
https://supabase.com/dashboard/project/oxybasvtphosdmlmrfnb/functions/visit-distribution-timeout-checker/logs

# Procurar por:
# - "Encontradas X tentativas expiradas"
# - "Processando timeout da tentativa..."
# - "Redistribuindo para próximo corretor"
```

---

### 5.6 Teste de Esgotamento de Tentativas

**Objetivo:** Validar comportamento quando todos os corretores recusam/não respondem.

#### Setup

**1. Configurar max_attempts = 2:**

```sql
UPDATE distribution_settings
SET max_attempts = 2
WHERE id = (SELECT id FROM distribution_settings LIMIT 1);
```

**2. Disparar distribuição.**

**3. Primeiro corretor:** Responder "NÃO"

**4. Segundo corretor:** Responder "NÃO" (ou aguardar timeout)

#### Validações

- [ ] ✅ Tentativa 1: `rejected` ou `timeout`
- [ ] ✅ Tentativa 2: `rejected` ou `timeout`
- [ ] ✅ Queue atualizada: `status = 'failed'`
- [ ] ✅ `failure_reason` preenchido
- [ ] ✅ Admin é notificado via WhatsApp
- [ ] ✅ Visita permanece sem corretor designado

#### Verificar Banco

```sql
SELECT 
  status,
  failure_reason,
  completed_at
FROM visit_distribution_queue
WHERE visita_id = 'UUID_DA_VISITA';

-- Resultado esperado:
-- status = 'failed'
-- failure_reason = 'Máximo de tentativas atingido (2)'
-- completed_at = NOW()
```

#### Verificar Notificação Admin

```sql
-- Verificar mensagem enviada ao admin
SELECT 
  phone_number,
  content,
  created_at
FROM communication_log
WHERE content LIKE '%Todas as tentativas%'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Checklist de Validação

### Envio de Mensagens

- [ ] Mensagem é enviada com sucesso
- [ ] `message_id` é extraído corretamente (`result.key.id`)
- [ ] `communication_log` registra envio com `status = 'sent'`
- [ ] Formatação markdown funciona (negrito, itálico)
- [ ] Emojis são exibidos corretamente
- [ ] Número é normalizado (55DDXXXXXXXXX)

### Processamento de Respostas

- [ ] Resposta "SIM" aceita visita
- [ ] Resposta "NÃO" redistribui
- [ ] Respostas com emojis são normalizadas
- [ ] Respostas case-insensitive ("sim", "SIM", "Sim")
- [ ] Webhook registra processamento correto
- [ ] `visit_distribution_attempts` atualizado

### Timeout e Redistribuição

- [ ] Timeouts são detectados corretamente
- [ ] Redistribuição automática funciona
- [ ] Próximo corretor recebe mensagem
- [ ] Tentativas são marcadas como `timeout`
- [ ] Logs registram redistribuição

### Finalizações

- [ ] Aceitação completa distribuição
- [ ] Rejeições esgotam tentativas corretamente
- [ ] Admin é notificado em falhas
- [ ] Queue é finalizada com `completed` ou `failed`
- [ ] Visita recebe corretor designado (se aceita)

### Logs e Monitoramento

- [ ] Logs detalhados em todas as funções
- [ ] Request/Response da Evolution API logados
- [ ] Erros registrados em `communication_log`
- [ ] Métricas atualizáveis via queries SQL

---

## Queries de Monitoramento

### Taxa de Sucesso (últimas 24h)

```sql
SELECT 
  COUNT(*) as total_envios,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as enviados,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as falhados,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_sucesso_percentual
FROM communication_log
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND type = 'whatsapp'
  AND direction = 'enviado';
```

**Meta:** Taxa de sucesso > 95%

### Distribuições em Andamento

```sql
SELECT 
  COUNT(*) as distribuicoes_pendentes,
  AVG(EXTRACT(EPOCH FROM (timeout_at - NOW()))/60) as tempo_medio_restante_minutos
FROM visit_distribution_attempts
WHERE status = 'pending'
  AND timeout_at > NOW();
```

### Tempo Médio de Resposta

```sql
SELECT 
  response_type,
  COUNT(*) as total_respostas,
  ROUND(AVG(EXTRACT(EPOCH FROM (response_received_at - message_sent_at))/60), 2) as tempo_medio_minutos,
  ROUND(MIN(EXTRACT(EPOCH FROM (response_received_at - message_sent_at))/60), 2) as tempo_minimo_minutos,
  ROUND(MAX(EXTRACT(EPOCH FROM (response_received_at - message_sent_at))/60), 2) as tempo_maximo_minutos
FROM visit_distribution_attempts
WHERE response_type IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY response_type;
```

---

## Resultado Esperado

Após todos os testes:

✅ **Taxa de sucesso de envio:** 95%+  
✅ **Respostas processadas corretamente:** 100%  
✅ **Timeouts redistribuem:** 100%  
✅ **Falhas notificam admin:** 100%  
✅ **Logs completos:** Todas as operações  
✅ **Zero botões:** Sistema funciona apenas com texto  

---

## Próxima Fase

➡️ **Fase 6:** Remover `enhanced-whatsapp-sender` (já concluído)  
➡️ **Fase 7:** Monitoramento contínuo em produção

---

**Última atualização:** 2025-11-18  
**Versão:** 1.0
