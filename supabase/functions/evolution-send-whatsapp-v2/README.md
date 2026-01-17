# Evolution Send WhatsApp V2

**Função unificada para envio de mensagens WhatsApp usando Evolution API V2**

## 📋 Visão Geral

Esta edge function substitui a `enhanced-whatsapp-sender` e oferece suporte completo para todos os tipos de mensagem da Evolution API V2:
- ✅ Mensagens de texto simples
- ✅ Mensagens com mídia (imagem, vídeo, documento, áudio)
- ✅ Mensagens com botões interativos
- ✅ Mensagens com listas (menus)

## 🚀 Como Usar

### Mensagem de Texto Simples

```typescript
const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone_number: '5585996227722',
    message: 'Olá! Esta é uma mensagem de teste.',
    lead_id: 'uuid-do-lead', // Opcional
    corretor_id: 'uuid-do-corretor' // Opcional
  }
});
```

### Mensagem com Botões

```typescript
const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone_number: '5585996227722',
    message: 'Deseja confirmar a visita?',
    buttons: [
      { id: 'btn_sim', text: '✅ SIM' },
      { id: 'btn_nao', text: '❌ NÃO' }
    ],
    lead_id: 'uuid-do-lead',
    corretor_id: 'uuid-do-corretor'
  }
});
```

### Mensagem com Mídia

```typescript
const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone_number: '5585996227722',
    media: {
      type: 'image',
      url: 'https://exemplo.com/imagem.jpg',
      caption: 'Veja esta foto do imóvel!'
    },
    corretor_id: 'uuid-do-corretor'
  }
});
```

### Mensagem com Lista (Menu)

```typescript
const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone_number: '5585996227722',
    list: {
      title: 'Escolha uma opção',
      description: 'Selecione o tipo de imóvel desejado',
      buttonText: 'Ver Opções',
      sections: [
        {
          title: 'Residenciais',
          rows: [
            { id: 'apt', title: 'Apartamento', description: 'Apartamentos diversos' },
            { id: 'casa', title: 'Casa', description: 'Casas e sobrados' }
          ]
        },
        {
          title: 'Comerciais',
          rows: [
            { id: 'sala', title: 'Sala Comercial', description: 'Salas e conjuntos' },
            { id: 'loja', title: 'Loja', description: 'Pontos comerciais' }
          ]
        }
      ]
    }
  }
});
```

## 📊 Resposta

### Sucesso
```json
{
  "success": true,
  "messageId": "BAE5...",
  "phone": "5585996227722",
  "type": "buttons",
  "logged": true
}
```

### Erro
```json
{
  "error": "Número de telefone inválido"
}
```

## 🔧 Configuração Necessária

As seguintes configurações devem estar presentes na tabela `system_settings`:

- `evolution_api_url`: URL base da Evolution API (ex: `https://api.evolution.com`)
- `evolution_api_key`: Chave de autenticação da API
- `evolution_instance_name`: Nome da instância configurada

## 📝 Logs

Todas as mensagens enviadas são automaticamente registradas na tabela `communication_log` com:
- Número de telefone
- Conteúdo da mensagem
- Status (sent/failed)
- ID da mensagem
- Metadados (tipo, corretor, lead)

## ⚡ Validações

A função valida automaticamente:
- ✅ Número de telefone no formato brasileiro (13 dígitos com DDI 55)
- ✅ Configurações da Evolution API
- ✅ Estrutura correta dos payloads
- ✅ Tamanho máximo de mensagem (4096 caracteres)

## 🆚 Diferenças com enhanced-whatsapp-sender

| Característica | enhanced-whatsapp-sender | evolution-send-whatsapp-v2 |
|----------------|-------------------------|----------------------------|
| Texto simples | ✅ | ✅ |
| Botões | ⚠️ (formato incorreto) | ✅ (formato correto Evolution V2) |
| Listas | ❌ | ✅ |
| Mídia | ❌ | ✅ |
| Fallback API Oficial | ✅ | ❌ |
| Rate Limiting | ❌ | ✅ (planejado) |
| Structured Logging | ❌ | ✅ (planejado) |

## 🔄 Migração

Para migrar de `enhanced-whatsapp-sender` para `evolution-send-whatsapp-v2`:

### Antes (enhanced-whatsapp-sender)
```typescript
await supabase.functions.invoke('enhanced-whatsapp-sender', {
  body: {
    phone_number: '5585996227722',
    message: 'Teste',
    useButtons: true,
    buttonConfig: {
      buttons: [
        { type: 'replyButton', displayText: '✅ SIM' }
      ]
    }
  }
});
```

### Depois (evolution-send-whatsapp-v2)
```typescript
await supabase.functions.invoke('evolution-send-whatsapp-v2', {
  body: {
    phone_number: '5585996227722',
    message: 'Teste',
    buttons: [
      { id: 'btn_sim', text: '✅ SIM' }
    ]
  }
});
```

## 🐛 Troubleshooting

### Erro: "Configurações da Evolution API não encontradas"
- Verifique se as chaves `evolution_api_url`, `evolution_api_key` e `evolution_instance_name` estão configuradas em `system_settings`

### Erro: "Número de telefone inválido"
- Certifique-se de que o número está no formato `55DDXXXXXXXXX` (13 dígitos)
- Use a função `normalizePhoneNumber()` para normalizar números antes de enviar

### Botões não aparecem
- Limite de 3 botões por mensagem (restrição do WhatsApp)
- Texto do botão deve ter no máximo 20 caracteres

### Listas não funcionam
- Lista deve ter entre 1 e 10 seções
- Cada seção pode ter no máximo 10 itens
- Descrições devem ser curtas (< 72 caracteres)

## 📚 Referências

- [Documentação Evolution API V2](https://doc.evolution-api.com/v2/api-reference/get-information)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)

## ⚠️ Status

- ✅ **PRODUÇÃO**: Pronta para uso em produção
- 🔄 **MIGRAÇÃO**: `enhanced-whatsapp-sender` será depreciada
- 📅 **Data de Remoção**: A ser definida (Q2 2026)
