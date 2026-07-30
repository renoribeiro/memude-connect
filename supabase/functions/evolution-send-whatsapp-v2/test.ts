/**
 * Testes de Integração - evolution-send-whatsapp-v2
 * 
 * Execute com: deno test --allow-net --allow-env test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Configurar environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://oxybasvtphosdmlmrfnb.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TEST_PHONE = '5585996227722'; // Alterar para número de teste válido

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Teste 1: Enviar mensagem de texto simples
 */
Deno.test("Send simple text message via v2", async () => {
  console.log('🧪 Teste 1: Mensagem de texto simples');
  
  const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: TEST_PHONE,
      message: '🧪 Teste automatizado - Mensagem de texto simples'
    }
  });

  console.log('Resultado:', data);
  console.log('Erro:', error);

  assertEquals(error, null, 'Não deve retornar erro');
  assertExists(data, 'Deve retornar dados');
  assertEquals(data.success, true, 'Success deve ser true');
  assertExists(data.messageId, 'Deve retornar messageId');
});

/**
 * Teste 2: Enviar mensagem com botões
 */
Deno.test("Send button message via v2", async () => {
  console.log('🧪 Teste 2: Mensagem com botões');
  
  const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: TEST_PHONE,
      message: '🧪 Teste automatizado - Mensagem com botões\n\nEscolha uma opção:',
      buttons: [
        { id: 'test_yes', text: '✅ Sim' },
        { id: 'test_no', text: '❌ Não' },
        { id: 'test_maybe', text: '🤔 Talvez' }
      ]
    }
  });

  console.log('Resultado:', data);
  console.log('Erro:', error);

  assertEquals(error, null, 'Não deve retornar erro');
  assertEquals(data.success, true, 'Success deve ser true');
  assertEquals(data.type, 'buttons', 'Tipo deve ser buttons');
  assertExists(data.messageId, 'Deve retornar messageId');
});

/**
 * Teste 3: Enviar mensagem com lista
 */
Deno.test("Send list message via v2", async () => {
  console.log('🧪 Teste 3: Mensagem com lista');
  
  const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: TEST_PHONE,
      list: {
        title: '🧪 Teste - Menu de Opções',
        description: 'Selecione uma categoria de teste',
        buttonText: 'Ver Opções',
        sections: [
          {
            title: 'Categoria 1',
            rows: [
              { id: 'opt1', title: 'Opção 1', description: 'Descrição da opção 1' },
              { id: 'opt2', title: 'Opção 2', description: 'Descrição da opção 2' }
            ]
          },
          {
            title: 'Categoria 2',
            rows: [
              { id: 'opt3', title: 'Opção 3', description: 'Descrição da opção 3' }
            ]
          }
        ]
      }
    }
  });

  console.log('Resultado:', data);
  console.log('Erro:', error);

  assertEquals(error, null, 'Não deve retornar erro');
  assertEquals(data.success, true, 'Success deve ser true');
  assertEquals(data.type, 'list', 'Tipo deve ser list');
  assertExists(data.messageId, 'Deve retornar messageId');
});

/**
 * Teste 4: Validação de número inválido
 */
Deno.test("Reject invalid phone number", async () => {
  console.log('🧪 Teste 4: Validação de número inválido');
  
  const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: '123456', // Número inválido
      message: 'Esta mensagem não deve ser enviada'
    }
  });

  console.log('Resultado:', data);
  console.log('Erro:', error);

  assertExists(error, 'Deve retornar erro');
  assertEquals(data.success, undefined, 'Success não deve estar presente');
});

/**
 * Teste 5: Validação de mensagem vazia
 */
Deno.test("Reject empty message without media or buttons", async () => {
  console.log('🧪 Teste 5: Validação de mensagem vazia');
  
  const { data, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: TEST_PHONE
      // Sem message, media, buttons ou list
    }
  });

  console.log('Resultado:', data);
  console.log('Erro:', error);

  assertExists(error, 'Deve retornar erro para mensagem vazia');
});

/**
 * Teste 6: Verificar logging no banco
 */
Deno.test("Verify message logging in communication_log", async () => {
  console.log('🧪 Teste 6: Verificar logging no banco');
  
  // Enviar mensagem
  const { data: sendData } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
    body: {
      phone_number: TEST_PHONE,
      message: '🧪 Teste de logging'
    }
  });

  assertExists(sendData, 'Mensagem deve ser enviada');

  // Aguardar 2 segundos para logging
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Buscar último log
  const { data: logs, error: logError } = await supabase
    .from('communication_log')
    .select('*')
    .eq('phone_number', TEST_PHONE)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Log encontrado:', logs);

  assertEquals(logError, null, 'Não deve haver erro ao buscar logs');
  assertExists(logs, 'Deve existir log da mensagem');
  assertEquals(logs.phone_number, TEST_PHONE, 'Phone number deve corresponder');
  assertEquals(logs.type, 'whatsapp', 'Tipo deve ser whatsapp');
});

/**
 * Teste 7: Rate Limiting (se implementado)
 */
Deno.test("Rate limiting protection", { ignore: true }, async () => {
  console.log('🧪 Teste 7: Rate limiting');
  
  const promises = [];
  
  // Enviar 15 mensagens rapidamente (acima do limite de 10/min)
  for (let i = 0; i < 15; i++) {
    promises.push(
      supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone_number: TEST_PHONE,
          message: `🧪 Rate limit test ${i + 1}`
        }
      })
    );
  }

  const results = await Promise.all(promises);
  
  // Pelo menos uma deve ter sido bloqueada (status 429)
  const blocked = results.some(r => 
    r.error?.message?.includes('Rate limit') || 
    r.error?.message?.includes('429')
  );

  assertEquals(blocked, true, 'Deve bloquear requisições acima do limite');
});

console.log('✅ Todos os testes concluídos!');
console.log('📝 Lembre-se de configurar TEST_PHONE com um número válido');
console.log('🔧 Execute com: deno test --allow-net --allow-env test.ts');
