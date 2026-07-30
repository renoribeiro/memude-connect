import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

interface ReminderRequest {
  visitaId?: string;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const access = await authorize(req, 'authenticated');
  if (access instanceof Response) return access;

  try {
    const { visitaId } = await readJson<ReminderRequest>(req, 4 * 1024);
    if (!visitaId || !/^[0-9a-f-]{36}$/i.test(visitaId)) {
      return jsonResponse(req, { error: 'visitaId inválido' }, 400);
    }

    const { data: isAdmin, error: roleError } = await access.supabase.rpc(
      'has_role',
      {
        _user_id: access.userId,
        _role: 'admin',
      },
    );
    if (roleError) throw roleError;

    const { data: visita, error: visitaError } = await access.supabase
      .from('visitas')
      .select(`
        id,
        data_visita,
        horario_visita,
        status,
        lead:leads!inner(id, nome, telefone),
        corretor:corretores(id, whatsapp, profiles(user_id, first_name)),
        empreendimento:empreendimentos(nome)
      `)
      .eq('id', visitaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (visitaError) throw visitaError;
    if (!visita) {
      return jsonResponse(req, { error: 'Visita não encontrada' }, 404);
    }

    const corretor = visita.corretor as unknown as {
      id: string;
      whatsapp: string | null;
      profiles: { user_id: string; first_name: string | null } | null;
    } | null;
    if (!isAdmin && corretor?.profiles?.user_id !== access.userId) {
      return jsonResponse(req, { error: 'Acesso negado para esta visita' }, 403);
    }
    if (!['agendada', 'confirmada', 'reagendada'].includes(visita.status || '')) {
      return jsonResponse(req, {
        error: 'O status atual da visita não permite lembretes',
      }, 409);
    }

    const rateLimitSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentReminder, error: rateLimitError } = await access.supabase
      .from('communication_log')
      .select('id')
      .contains('metadata', {
        visita_id: visita.id,
        type: 'manual_reminder',
      })
      .gte('created_at', rateLimitSince)
      .limit(1)
      .maybeSingle();
    if (rateLimitError) throw rateLimitError;
    if (recentReminder) {
      return jsonResponse(req, {
        error: 'Um lembrete já foi enviado nos últimos 15 minutos',
      }, 429, { 'Retry-After': '900' });
    }

    const lead = visita.lead as unknown as {
      id: string;
      nome: string;
      telefone: string | null;
    };
    const empreendimento = visita.empreendimento as unknown as {
      nome: string | null;
    } | null;
    const visitDate = formatDate(visita.data_visita);
    const propertyName = empreendimento?.nome || 'empreendimento agendado';
    const brokerName = corretor?.profiles?.first_name || 'corretor responsável';

    const messages = [
      lead.telefone
        ? {
            target: 'client',
            phone_number: lead.telefone,
            lead_id: lead.id,
            corretor_id: corretor?.id,
            message:
              `⏰ *LEMBRETE DE VISITA*\n\nOlá ${lead.nome}, sua visita ao *${propertyName}* está próxima.\n\n📅 Data: ${visitDate}\n🕒 Horário: ${visita.horario_visita}\n📍 Corretor: ${brokerName}\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`,
          }
        : null,
      corretor?.whatsapp
        ? {
            target: 'corretor',
            phone_number: corretor.whatsapp,
            lead_id: lead.id,
            corretor_id: corretor.id,
            message:
              `⏰ *LEMBRETE DE VISITA*\n\n${brokerName}, sua visita com *${lead.nome}* está próxima.\n\n🏢 ${propertyName}\n📅 Data: ${visitDate}\n🕒 Horário: ${visita.horario_visita}\n\nResponda *SIM* para confirmar ou *NÃO* se não puder comparecer.`,
          }
        : null,
    ].filter((message): message is NonNullable<typeof message> => Boolean(message));

    if (messages.length === 0) {
      return jsonResponse(req, {
        error: 'Lead e corretor não possuem WhatsApp cadastrado',
      }, 422);
    }

    const queuedTargets: string[] = [];
    for (const item of messages) {
      const { data, error } = await access.supabase.functions.invoke(
        'evolution-send-whatsapp-v2',
        {
          body: {
            phone_number: item.phone_number,
            message: item.message,
            lead_id: item.lead_id,
            corretor_id: item.corretor_id,
            async: true,
            metadata: {
              visita_id: visita.id,
              type: 'manual_reminder',
              target: item.target,
              context: 'visit_reminder',
              requested_by: access.userId,
            },
          },
        },
      );
      if (error || !data?.success) {
        console.error('Falha ao enfileirar lembrete para:', item.target);
        throw new Error('Não foi possível enfileirar todos os lembretes');
      }
      queuedTargets.push(item.target);
    }

    return jsonResponse(req, {
      success: true,
      queued_targets: queuedTargets,
      message: 'Lembretes enfileirados para envio',
    }, 202);
  } catch (error) {
    const message = safeError(error);
    console.error('Falha no lembrete de visita:', message);
    const status = message.includes('inválido')
      || message.includes('JSON')
      || message.includes('limite')
      ? 400
      : 500;
    return jsonResponse(req, {
      error: status === 500 ? 'Falha interna ao enviar lembrete' : message,
    }, status);
  }
});
