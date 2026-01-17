-- Etapa 2: Inserir templates no banco
INSERT INTO public.message_templates (
  name,
  category,
  type,
  subject,
  content,
  variables,
  is_system,
  is_active
) VALUES (
  'Distribuição de Visita - WhatsApp',
  'visit_distribution',
  'whatsapp',
  NULL,
  '🏢 *Nova Visita Disponível!*

📋 *Lead:* {nome_lead}
📱 *Telefone:* {telefone_lead}
📧 *Email:* {email_lead}

🏗️ *Empreendimento:* {empreendimento_nome}
📍 *Endereço:* {empreendimento_endereco}
🏘️ *Bairro:* {bairro_nome}

📅 *Data da Visita:* {data_visita}
🕐 *Horário:* {horario_visita}

💬 *Observações:* {observacoes}

*Você aceita esta visita?*
Responda *SIM* para aceitar ou *NÃO* para recusar.

⏰ Você tem 15 minutos para responder.',
  '["nome_lead", "telefone_lead", "email_lead", "empreendimento_nome", "empreendimento_endereco", "bairro_nome", "data_visita", "horario_visita", "observacoes"]'::jsonb,
  true,
  true
) ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (
  name,
  category,
  type,
  subject,
  content,
  variables,
  is_system,
  is_active
) VALUES (
  'Notificação Admin - Distribuição Falhou',
  'admin_notification',
  'whatsapp',
  NULL,
  '⚠️ *ALERTA DO SISTEMA*

A distribuição automática falhou!

📋 *Visita ID:* {visita_id}
👤 *Lead:* {nome_lead}
🏢 *Empreendimento:* {empreendimento_nome}
📅 *Data/Hora:* {data_visita} às {horario_visita}

❌ *Motivo:* {motivo_falha}

Por favor, faça a distribuição manual desta visita.',
  '["visita_id", "nome_lead", "empreendimento_nome", "data_visita", "horario_visita", "motivo_falha"]'::jsonb,
  true,
  true
) ON CONFLICT DO NOTHING;