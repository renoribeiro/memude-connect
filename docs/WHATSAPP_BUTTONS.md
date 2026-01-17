# Sistema de Botões WhatsApp - Evolution API V2

## Visão Geral

O sistema agora suporta mensagens com botões interativos do WhatsApp através da Evolution API V2, melhorando significativamente a experiência dos corretores ao responder consultas de distribuição de visitas.

## Benefícios

| Antes | Depois |
|-------|--------|
| 📝 Corretor digita "SIM" ou "NÃO" | 🖱️ Corretor clica em botão |
| ⏱️ Tempo médio de resposta: ~2-3min | ⏱️ Tempo médio: ~30seg |
| ❌ Risco de erro de digitação | ✅ Resposta sempre válida |
| 🤔 Possível confusão sobre formato | 🎯 Interface clara e intuitiva |

## Arquitetura

### Componentes Modificados

1. **enhanced-whatsapp-sender** (`supabase/functions/enhanced-whatsapp-sender/index.ts`)
   - Detecta flag `useButtons` no payload
   - Usa endpoint `/sendButton` ao invés de `/sendText`
   - Estrutura mensagem com `buttonMessage` e array de botões
   - Mantém fallback para texto simples

2. **distribute-visit** (`supabase/functions/distribute-visit/index.ts`)
   - Passa `useButtons: true` ao enviar mensagens de distribuição
   - Configura botões "✅ SIM" e "❌ NÃO"
   - Adiciona footer com tempo limite dinâmico

3. **evolution-webhook-handler** (`supabase/functions/evolution-webhook-handler/index.ts`)
   - Processa respostas de botões via `buttonsResponseMessage`
   - Remove emojis antes de normalizar resposta
   - Mantém compatibilidade com respostas de texto

## Formato da Mensagem com Botões

### Payload Enviado para Evolution API

```json
{
  "number": "5585996227722",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "buttonMessage": {
    "text": "🏠 *NOVA VISITA DISPONÍVEL*\n\n*Cliente:* João Silva...",
    "buttons": [
      {
        "type": "replyButton",
        "displayText": "✅ SIM"
      },
      {
        "type": "replyButton",
        "displayText": "❌ NÃO"
      }
    ],
    "footerText": "⏰ Você tem 15 minutos para responder"
  }
}
```

### Interface ButtonConfig

```typescript
interface ButtonConfig {
  buttons: Array<{
    displayText: string;
    type: 'replyButton';
  }>;
  footerText?: string;
}
```

## Processamento de Respostas

### Estrutura do Webhook (Resposta de Botão)

```json
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5585996227722@s.whatsapp.net"
    },
    "message": {
      "buttonsResponseMessage": {
        "selectedButtonId": "0",
        "selectedDisplayText": "✅ SIM"
      }
    }
  }
}
```

### Normalização de Resposta

```typescript
// Remove emojis e normaliza
const normalizedMessage = messageContent.replace(/[✅❌]/g, '').trim().toUpperCase();

// Valida resposta
const isPositive = ['SIM', 'S', 'YES', 'Y', 'OK', 'ACEITO', 'CONFIRMO'].includes(normalizedMessage);
const isNegative = ['NÃO', 'NAO', 'N', 'NO', 'RECUSO', 'NEGO'].includes(normalizedMessage);
```

## Fallback Inteligente

O sistema mantém compatibilidade total com respostas de texto:

1. **Prioridade de Extração:**
   - Tenta `buttonsResponseMessage.selectedDisplayText`
   - Fallback para `buttonsResponseMessage.selectedButtonId`
   - Fallback para `conversation` (texto normal)
   - Fallback para `extendedTextMessage.text`

2. **Compatibilidade Retroativa:**
   - Corretores ainda podem digitar "SIM" ou "NÃO"
   - Sistema normaliza ambas as formas
   - Zero breaking changes

## Como Usar

### 1. Enviar Mensagem com Botões (Edge Function)

```typescript
const { data, error } = await supabase.functions.invoke('enhanced-whatsapp-sender', {
  body: {
    phone_number: '5585996227722',
    message: 'Você aceita esta visita?',
    useButtons: true,
    buttonConfig: {
      buttons: [
        { type: 'replyButton', displayText: '✅ SIM' },
        { type: 'replyButton', displayText: '❌ NÃO' }
      ],
      footerText: '⏰ Responda em até 15 minutos'
    }
  }
});
```

### 2. Enviar Mensagem Simples (Fallback)

```typescript
const { data, error } = await supabase.functions.invoke('enhanced-whatsapp-sender', {
  body: {
    phone_number: '5585996227722',
    message: 'Esta é uma mensagem de texto simples',
    useButtons: false // ou omitir
  }
});
```

## Monitoramento

### Query: Ver Mensagens com Botões

```sql
SELECT 
  phone_number,
  content,
  status,
  metadata->>'api_used' as api,
  created_at
FROM communication_log
WHERE type = 'whatsapp' 
  AND direction = 'enviado'
  AND metadata->'response_data'->>'api' = 'evolution'
ORDER BY created_at DESC
LIMIT 20;
```

### Query: Taxa de Sucesso de Botões

```sql
SELECT 
  DATE(created_at) as data,
  COUNT(*) as total_mensagens,
  COUNT(*) FILTER (WHERE status = 'sent') as enviadas_sucesso,
  ROUND(COUNT(*) FILTER (WHERE status = 'sent')::numeric / COUNT(*) * 100, 2) as taxa_sucesso
FROM communication_log
WHERE type = 'whatsapp' 
  AND direction = 'enviado'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;
```

### Logs de Webhook

```sql
SELECT 
  event_type,
  instance_name,
  processed_successfully,
  processing_time_ms,
  payload->'data'->'message'->'buttonsResponseMessage' as button_response,
  created_at
FROM webhook_logs
WHERE event_type = 'messages.upsert'
  AND payload->'data'->'message' ? 'buttonsResponseMessage'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Problema: Botões não aparecem no WhatsApp

**Possíveis causas:**
1. Evolution API não atualizada para V2
2. Instância não suporta botões
3. Número do destinatário não é WhatsApp Business

**Solução:**
- Verificar versão da Evolution API
- Testar com outro número
- Verificar logs do edge function

### Problema: Resposta de botão não processada

**Verificar:**
1. Webhook configurado corretamente
2. `evolution-webhook-handler` recebendo eventos
3. Estrutura do payload no log

**Query de debug:**
```sql
SELECT * FROM webhook_logs 
WHERE event_type = 'messages.upsert'
ORDER BY created_at DESC 
LIMIT 5;
```

## Referências

- [Evolution API V2 - Send Button](https://doc.evolution-api.com/v2/api-reference/message-controller/send-button)
- [WhatsApp Button Message Format](https://developers.facebook.com/docs/whatsapp/guides/interactive-messages)

## Próximos Passos

- [ ] Adicionar suporte para **list messages** (listas interativas)
- [ ] Implementar **quick replies** para respostas rápidas
- [ ] Adicionar botões de **call-to-action** (ligar, abrir URL)
- [ ] Dashboard de analytics de engajamento com botões
