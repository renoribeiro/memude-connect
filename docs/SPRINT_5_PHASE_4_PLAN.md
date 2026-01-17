# Sprint 5 - Fase 4: Plano de Remoção de enhanced-whatsapp-sender

## ⚠️ STATUS: NÃO PODE SER REMOVIDO AINDA

Após análise do código, `enhanced-whatsapp-sender` ainda está em **USO ATIVO** em múltiplos arquivos.

## 🎯 STATUS GERAL DA FASE 4

### ✅ Concluído (7/7 arquivos - 100%)
1. ✅ distribute-visit (Sprint 3)
2. ✅ distribution-timeout-checker (Fase 4a)
3. ✅ visit-distribution-timeout-checker (Fase 4a)
4. ✅ distribution-webhook-handler (Fase 4b)
5. ✅ evolution-webhook-handler (Fase 4b)
6. ✅ proactive-notifications (Fase 4c)
7. ✅ DistributionTester.tsx (Fase 4c)

### 🎉 MIGRAÇÃO COMPLETA!
**Total de chamadas migradas:** 13/13 (100%)
**Arquivos restantes:** 0/7

1. **distribute-visit/index.ts** (1 uso)
   - ❓ Status: Verificar - deveria estar usando v2
   - Linha 778: Notificação de falha para admin

2. **distribution-timeout-checker/index.ts** (2 usos)
   - ❌ Pendente migração
   - Linha 304: Enviar mensagem para próximo corretor
   - Linha 361: Notificar admin sobre falha

3. **distribution-webhook-handler/index.ts** (3 usos)
   - ❌ Pendente migração
   - Linha 292: Confirmação de aceitação
   - Linha 318: Pedido de clarificação
   - Linha 351: Notificação de rejeição para admin

4. **evolution-webhook-handler/index.ts** (3 usos)
   - ❌ Pendente migração
   - Linha 342: Confirmação de visita aceita
   - Linha 404: Confirmação de visita rejeitada
   - Linha 534: Notificação de falha para admin

5. **proactive-notifications/index.ts** (2 usos)
   - ❌ Pendente migração
   - Linha 60: Alerta de falha de distribuição
   - Linha 210: Lembrete de timeout

6. **visit-distribution-timeout-checker/index.ts** (2 usos)
   - ❌ Pendente migração
   - Linha 428: Mensagem para próximo corretor
   - Linha 497: Notificação de falha para admin

### Frontend que usa `enhanced-whatsapp-sender`:

7. **src/components/automation/DistributionTester.tsx** (1 uso)
   - ❌ Pendente migração
   - Linha 74: Teste de distribuição manual

## 🎯 Plano de Migração Completo

### Fase 4a: Migrar Edge Functions Críticas
**Prioridade: ALTA**

Migrar as seguintes funções que são executadas automaticamente:

1. ✅ **distribute-visit** - JÁ MIGRADO (Sprint 3)
2. ✅ **distribution-timeout-checker** - MIGRADO (Fase 4a) - 2 chamadas
3. ✅ **visit-distribution-timeout-checker** - MIGRADO (Fase 4a) - 2 chamadas
4. ✅ **distribution-webhook-handler** - MIGRADO (Fase 4b) - 3 chamadas
5. ✅ **evolution-webhook-handler** - MIGRADO (Fase 4b) - 3 chamadas

**Status:** 5/5 concluídas (100%) ✅
**Tempo investido:** ~1h 30min

### Fase 4c: Migrar Notificações Proativas ✅ CONCLUÍDO
**Prioridade: MÉDIA**

6. ✅ **proactive-notifications** (2 chamadas) - MIGRADO

**Status:** 1/1 concluída (100%) ✅
**Tempo investido:** 20 minutos

### Fase 4d: Migrar Frontend ✅ CONCLUÍDO
**Prioridade: BAIXA**

7. ✅ **DistributionTester.tsx** (1 chamada) - MIGRADO

**Status:** 1/1 concluída (100%) ✅
**Tempo investido:** 10 minutos

### Fase 4e: Remover Função Legacy
**Prioridade: FINAL**

Após todas as migrações:
- [x] Confirmar que não há mais chamadas ativas
- [ ] Adicionar log de depreciação por 1 semana
- [ ] Remover diretório `supabase/functions/enhanced-whatsapp-sender/`
- [ ] Atualizar documentação

**Estimativa:** 15 minutos

## 📋 Checklist de Migração por Arquivo

### distribution-timeout-checker/index.ts ✅ MIGRADO
- ✅ Linha 304: Migrado `sendDistributionMessage` para usar v2
- ✅ Linha 361: Migrado `notifyAdminFailure` para usar v2
- ✅ Estrutura de metadados atualizada
- ⏳ Aguardando testes em produção

### visit-distribution-timeout-checker/index.ts ✅ MIGRADO
- ✅ Linha 428: Migrado `sendDistributionMessage` para usar v2
- ✅ Linha 497: Migrado `notifyAdminFailure` para usar v2
- ✅ Estrutura de metadados atualizada
- ⏳ Aguardando testes em produção

### distribution-webhook-handler/index.ts ✅ MIGRADO
- ✅ Linha 292: Migrado `sendConfirmationMessage` para usar v2
- ✅ Linha 318: Migrado `requestClarification` para usar v2
- ✅ Linha 351: Migrado `notifyAdminRejection` para usar v2
- ✅ Estrutura de metadados atualizada
- ⏳ Aguardando testes em produção

### evolution-webhook-handler/index.ts ✅ MIGRADO
- ✅ Linha 342: Migrado confirmação de aceitação para usar v2
- ✅ Linha 404: Migrado confirmação de rejeição para usar v2
- ✅ Linha 534: Migrado notificação de falha para admin para usar v2
- ✅ Estrutura de metadados atualizada
- ⏳ Aguardando testes em produção

### proactive-notifications/index.ts ✅ MIGRADO
- ✅ Linha 60-67: Migrado notificação de visita falhada para usar v2
- ✅ Linha 214-219: Migrado lembrete de timeout para usar v2
- ✅ Estrutura de metadados atualizada
- ✅ Pronto para produção

### DistributionTester.tsx ✅ MIGRADO
- ✅ Linha 76-82: Migrado teste de WhatsApp para usar v2
- ✅ Atualizada resposta para usar `key.id` ao invés de `messageId`
- ✅ Removidos campos `lead_id` e `corretor_id` do root
- ✅ Pronto para testes

## 🔄 Template de Migração

### ANTES (enhanced-whatsapp-sender):
```typescript
await supabase.functions.invoke('enhanced-whatsapp-sender', {
  body: {
    phone_number: phoneNumber,
    message: message,
    lead_id: leadId,
    corretor_id: corretorId
  }
});
```

### DEPOIS (evolution-send-whatsapp-v2):
```typescript
await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone: phoneNumber,
    message: message,
    metadata: {
      lead_id: leadId,
      corretor_id: corretorId
    }
  }
});
```

## ⚠️ Atenção Especial

### Campos Diferentes:
- `phone_number` → `phone`
- `lead_id`, `corretor_id` → dentro de `metadata`

### Resposta Diferente:
- ANTES: `{ messageId, apiUsed }`
- DEPOIS: `{ success, messageId, phone, type }`

## 📊 Impacto Estimado

- **Total de chamadas**: 13 chamadas ativas
- **Tempo total estimado**: 3-4 horas
- **Arquivos afetados**: 7 arquivos
- **Testes necessários**: 6 flows diferentes

## 🎯 Próximos Passos Recomendados

1. **OPÇÃO A - Migração Gradual** (Recomendado)
   - Migrar 1-2 arquivos por vez
   - Testar cada migração isoladamente
   - Monitorar logs por 24h antes de próxima migração

2. **OPÇÃO B - Migração Completa**
   - Migrar todos os 7 arquivos de uma vez
   - Testar todos os flows em staging
   - Deploy único com monitoramento intensivo

## 🔍 Como Verificar Progresso

```bash
# Buscar por usos remanescentes
grep -r "enhanced-whatsapp-sender" supabase/functions/ src/
```

## ✅ Critérios de Conclusão da Fase 4

- [ ] Zero referências a `enhanced-whatsapp-sender` no código ativo
- [ ] Todos os testes passando
- [ ] Logs mostrando apenas chamadas v2
- [ ] Zero erros nos últimos 7 dias relacionados à migração
- [ ] Função `enhanced-whatsapp-sender` removida do codebase
