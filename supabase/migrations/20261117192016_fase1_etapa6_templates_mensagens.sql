-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function private.f1_lead_json(p_lead uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'nome', l.nome, 'telefone', l.telefone, 'telefone_exibicao', l.telefone_exibicao,
    'telefone_chave', l.telefone_chave, 'status_atendimento', l.status_atendimento, 'fonte', l.fonte,
    'empreendimento_id', l.empreendimento_id, 'empreendimento', e.nome,
    'responsavel_id', l.responsavel_id, 'responsavel', nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
    'data_entrada', l.data_entrada, 'observacoes', l.observacoes, 'url', '/leads/' || l.id
  )
  from public.leads l
  left join public.empreendimentos e on e.id = l.empreendimento_id
  left join public.profiles p on p.user_id = l.responsavel_id
  where l.id = p_lead;
$$;

insert into public.template_variables (name, description, category, data_type, default_value)
select v.name, v.descr, 'visita_fase1', v.tipo::public.variable_data_type, '—'
from (values
  ('[DATA]', 'Data da visita (DD/MM/AAAA)', 'date'),
  ('[HORÁRIO]', 'Horário da visita (HH:MM)', 'time'),
  ('[LOCAL]', 'Nome do local + endereço', 'text'),
  ('[ENDEREÇO]', 'Endereço do local da visita', 'text'),
  ('[EMPREENDIMENTO]', 'Nome do empreendimento', 'text'),
  ('[LINK DO EMPREENDIMENTO]', 'Página do empreendimento no memude.com.br', 'text'),
  ('[NOME DO CLIENTE]', 'Nome do lead', 'text'),
  ('[PERFIL DO CLIENTE]', 'Perfil do cliente informado no agendamento', 'text'),
  ('[NOME DO CORRETOR]', 'Corretor responsável pela visita', 'text'),
  ('[ORIGEM DO LEAD]', 'Fonte do lead (Google, Meta, Cadastro, Follow, Outros)', 'text')
) as v(name, descr, tipo)
where not exists (select 1 from public.template_variables t where t.name = v.name);

insert into public.message_templates (name, category, type, content, variables, is_active, is_system, metadata)
select t.nome, t.categoria::public.template_category, 'whatsapp'::public.communication_channel, t.conteudo,
  t.variaveis::jsonb, true, true,
  jsonb_build_object('fase1', true, 'chave', t.chave, 'momento', t.momento, 'destino', t.destino, 'quem', t.quem, 'ordem', t.ordem)
from (values
('Visita · MSG 1 — cliente', 'visit_confirmation', 'msg1', 'criacao', 'cliente', 'agendador', 1,
$m$Será um prazer te acompanhar nesta visita e auxiliar na aquisição do seu imóvel.

Para garantir um atendimento ágil e especializado no empreendimento escolhido, contamos com corretores parceiros que atuam diretamente no local e possuem conhecimento detalhado do projeto.

Só confirmando os dados:
Data: [DATA]
Horário: [HORÁRIO]
Local: Stand do empreendimento [EMPREENDIMENTO] ([ENDEREÇO])

Fico no aguardo da sua confirmação!$m$, '["[DATA]","[HORÁRIO]","[EMPREENDIMENTO]","[ENDEREÇO]"]'),
('Visita · MSG 2 — cliente', 'visit_confirmation', 'msg2', 'criacao', 'cliente', 'agendador', 2,
$m$Sua visita foi agendada com sucesso!

Um dia antes da visita entraremos em contato novamente para lembrete e confirmação do corretor responsável pelo atendimento.$m$, '[]'),
('Visita · MSG 2A — corretor', 'visit_confirmation', 'msg2a', 'criacao', 'corretor', 'agendador', 3,
$m$⚠ *AGENDAMENTO DE VISITA* ⚠

Portal MeMude tem um cliente perfeito pra você!

*Empreendimento:* [EMPREENDIMENTO]
*Acessar o empreendimento:* [LINK DO EMPREENDIMENTO]

👤 Cliente: [NOME DO CLIENTE]
🏠 Perfil: [PERFIL DO CLIENTE]

📅 *Data:* [DATA]
⏰ *Horário:* [HORÁRIO]
📍 *Local:* [LOCAL]

━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, responda em até 15 minutos com:
*SIM* – Confirmo a visita
*NÃO* – Não poderei comparecer

🔗 Portal MeMude – www.memude.com.br$m$, '["[EMPREENDIMENTO]","[LINK DO EMPREENDIMENTO]","[NOME DO CLIENTE]","[PERFIL DO CLIENTE]","[DATA]","[HORÁRIO]","[LOCAL]"]'),
('Visita · MSG 2B — corretor', 'visit_confirmation', 'msg2b', 'aceite', 'corretor', 'agendador', 1,
$m$*Confirmação recebida.*

Você será o corretor responsável por este atendimento!

Acesse o Manual do Corretor MeMude:
https://canva.link/memudeguias-corretorparceiro$m$, '[]'),
('Visita · MSG 3 — cliente', 'visit_confirmation', 'msg3', 'aceite', 'cliente', 'agendador', 2,
$m$*Já identificamos o especialista que irá te acompanhar na visita!*

Corretor: [NOME DO CORRETOR]

Ele estará no local combinado com antecedência para te receber e conduzir o atendimento.$m$, '["[NOME DO CORRETOR]"]'),
('Visita · MSG 4 — grupo', 'visit_confirmation', 'msg4', 'aceite', 'grupo', 'agendador', 3,
$m$✅ +1 VISITA AGENDADA ✅

Local: [LOCAL]
Data: [DATA]
Corretor: [NOME DO CORRETOR]
Origem Lead: [ORIGEM DO LEAD]
Imóvel: [EMPREENDIMENTO]$m$, '["[LOCAL]","[DATA]","[NOME DO CORRETOR]","[ORIGEM DO LEAD]","[EMPREENDIMENTO]"]'),
('Visita · D-2 — cliente', 'visit_reminder', 'd2_cliente', 'd2', 'cliente', 'agendador', 1,
$m$Passando para lembrar da sua visita!

Só confirmando os dados:
Data: [DATA]
Horário: [HORÁRIO]
Local: Stand do empreendimento [EMPREENDIMENTO] ([ENDEREÇO])

Fico no aguardo da sua confirmação!$m$, '["[DATA]","[HORÁRIO]","[EMPREENDIMENTO]","[ENDEREÇO]"]'),
('Visita · D-2 — corretor', 'visit_reminder', 'd2_corretor', 'd2', 'corretor', 'agendador', 2,
$m$⚠ *LEMBRETE DE VISITA* ⚠

Faltam 2 dias para o atendimento do cliente Portal MeMude!

*Empreendimento:* [EMPREENDIMENTO]

👤 Cliente: [NOME DO CLIENTE]
🏠 Perfil: [PERFIL DO CLIENTE]

📅 *Data:* [DATA]
⏰ *Horário:* [HORÁRIO]
📍 *Local:* [LOCAL]

━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, confirme com:
*SIM* – Confirmo a visita
*NÃO* – Não poderei comparecer

🔗 Portal MeMude – www.memude.com.br$m$, '["[EMPREENDIMENTO]","[NOME DO CLIENTE]","[PERFIL DO CLIENTE]","[DATA]","[HORÁRIO]","[LOCAL]"]'),
('Visita · D-1 — cliente', 'visit_reminder', 'd1_cliente', 'd1', 'cliente', 'agendador', 1,
$m$*Sua visita é amanhã!*

Data: [DATA]
Horário: [HORÁRIO]
Local: Stand do empreendimento [EMPREENDIMENTO] ([ENDEREÇO])
Corretor: [NOME DO CORRETOR]

O especialista estará no local com antecedência para te receber e conduzir o atendimento.

Fico no aguardo da sua confirmação!$m$, '["[DATA]","[HORÁRIO]","[EMPREENDIMENTO]","[ENDEREÇO]","[NOME DO CORRETOR]"]'),
('Visita · D-1 — corretor', 'visit_reminder', 'd1_corretor', 'd1', 'corretor', 'agendador', 2,
$m$⚠ *VISITA AMANHÃ* ⚠

*Empreendimento:* [EMPREENDIMENTO]
*Acessar o empreendimento:* [LINK DO EMPREENDIMENTO]

👤 Cliente: [NOME DO CLIENTE]
🏠 Perfil: [PERFIL DO CLIENTE]

📅 *Data:* [DATA]
⏰ *Horário:* [HORÁRIO]
📍 *Local:* [LOCAL]

━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, confirme com:
*SIM* – Confirmo a visita
*NÃO* – Não poderei comparecer

🔗 Portal MeMude – www.memude.com.br$m$, '["[EMPREENDIMENTO]","[LINK DO EMPREENDIMENTO]","[NOME DO CLIENTE]","[PERFIL DO CLIENTE]","[DATA]","[HORÁRIO]","[LOCAL]"]'),
('Visita · D0 — cliente', 'visit_reminder', 'd0_cliente', 'd0', 'cliente', 'closer', 1,
$m$*Hoje é o dia da sua visita!*

Horário: [HORÁRIO]
Local: Stand do empreendimento [EMPREENDIMENTO] ([ENDEREÇO])
Corretor: [NOME DO CORRETOR]

Qualquer imprevisto, é só nos avisar por aqui. Será um prazer te receber!$m$, '["[HORÁRIO]","[EMPREENDIMENTO]","[ENDEREÇO]","[NOME DO CORRETOR]"]'),
('Visita · D0 — corretor', 'visit_reminder', 'd0_corretor', 'd0', 'corretor', 'closer', 2,
$m$⚠ *VISITA HOJE* ⚠

*Empreendimento:* [EMPREENDIMENTO]

👤 Cliente: [NOME DO CLIENTE]
🏠 Perfil: [PERFIL DO CLIENTE]

⏰ *Horário:* [HORÁRIO]
📍 *Local:* [LOCAL]

━━━━━━━━━━━━━━━━━━━━━━━━

Após o atendimento, nos envie um breve retorno de como foi a visita.

🔗 Portal MeMude – www.memude.com.br$m$, '["[EMPREENDIMENTO]","[NOME DO CLIENTE]","[PERFIL DO CLIENTE]","[HORÁRIO]","[LOCAL]"]'),
('Visita · Realizada — corretor', 'feedback_request', 'realizada_corretor', 'realizada', 'corretor', 'closer', 1,
$m$📋 *RETORNO DE VISITA* 📋

👤 Cliente: [NOME DO CLIENTE]
*Empreendimento:* [EMPREENDIMENTO]
📅 *Data:* [DATA]

━━━━━━━━━━━━━━━━━━━━━━━━

Como foi o atendimento? Por favor, nos envie:
*1.* Impressão do cliente sobre o empreendimento
*2.* Próximo passo combinado

🔗 Portal MeMude – www.memude.com.br$m$, '["[NOME DO CLIENTE]","[EMPREENDIMENTO]","[DATA]"]'),
('Visita · Realizada — cliente', 'feedback_request', 'realizada_cliente', 'realizada', 'cliente', 'closer', 2,
$m$*Obrigado pela visita ao [EMPREENDIMENTO]!*

Queremos saber como foi sua experiência. O que achou do empreendimento e do atendimento do corretor [NOME DO CORRETOR]?

Seguimos à disposição para te auxiliar nos próximos passos da aquisição do seu imóvel.$m$, '["[EMPREENDIMENTO]","[NOME DO CORRETOR]"]'),
('Visita · Realizada — grupo', 'feedback_request', 'realizada_grupo', 'realizada', 'grupo', 'closer', 3,
$m$✅ VISITA REALIZADA ✅

Imóvel: [EMPREENDIMENTO]
Data: [DATA]
Corretor: [NOME DO CORRETOR]
Origem Lead: [ORIGEM DO LEAD]$m$, '["[EMPREENDIMENTO]","[DATA]","[NOME DO CORRETOR]","[ORIGEM DO LEAD]"]'),
('Visita · No-show — cliente', 'follow_up', 'noshow_cliente', 'no_show', 'cliente', 'closer', 1,
$m$Sentimos sua falta na visita de hoje ao [EMPREENDIMENTO].

Sabemos que imprevistos acontecem. Gostaria de reagendar para uma nova data e horário?

Fico no aguardo do seu retorno!$m$, '["[EMPREENDIMENTO]"]'),
('Visita · No-show — corretor', 'follow_up', 'noshow_corretor', 'no_show', 'corretor', 'closer', 2,
$m$⚠ *CLIENTE NÃO COMPARECEU* ⚠

👤 Cliente: [NOME DO CLIENTE]
*Empreendimento:* [EMPREENDIMENTO]
📅 *Data:* [DATA]

━━━━━━━━━━━━━━━━━━━━━━━━

Obrigado pela disponibilidade! Já estamos em contato com o cliente para reagendar e te avisamos a nova data.

🔗 Portal MeMude – www.memude.com.br$m$, '["[NOME DO CLIENTE]","[EMPREENDIMENTO]","[DATA]"]'),
('Visita · No-show — grupo', 'follow_up', 'noshow_grupo', 'no_show', 'grupo', 'closer', 3,
$m$❌ NO-SHOW ❌

Imóvel: [EMPREENDIMENTO]
Data: [DATA]
Corretor: [NOME DO CORRETOR]
Origem Lead: [ORIGEM DO LEAD]$m$, '["[EMPREENDIMENTO]","[DATA]","[NOME DO CORRETOR]","[ORIGEM DO LEAD]"]'),
('Visita · Reagendada — grupo', 'follow_up', 'reagendada_grupo', 'reagendada', 'grupo', 'closer', 1,
$m$🔄 VISITA REAGENDADA 🔄

Imóvel: [EMPREENDIMENTO]
Nova data: [DATA]
Horário: [HORÁRIO]
Corretor: [NOME DO CORRETOR]$m$, '["[EMPREENDIMENTO]","[DATA]","[HORÁRIO]","[NOME DO CORRETOR]"]')
) as t(nome, categoria, chave, momento, destino, quem, ordem, conteudo, variaveis)
where not exists (
  select 1 from public.message_templates m where m.metadata->>'fase1' = 'true' and m.metadata->>'chave' = t.chave
);
;
