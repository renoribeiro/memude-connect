import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
  validateExternalHttpUrl,
} from '../_shared/security.ts';

interface SyncRequest {
  visitaId?: string;
}

type JsonObject = Record<string, unknown>;

function safeText(value: unknown, maxLength = 1000): string {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : '';
}

function mergeMetadata(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return { ...base, ...patch };
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
    const { visitaId } = await readJson<SyncRequest>(req, 4 * 1024);
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
        interesse,
        status,
        feedback_corretor,
        comentarios_lead,
        avaliacao_lead,
        confirmation_metadata,
        lead:leads!inner(id, nome, telefone, email),
        corretor:corretores(id, whatsapp, profiles(user_id, first_name, last_name)),
        empreendimento:empreendimentos(id, nome, endereco, valor_min)
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
      profiles: {
        user_id: string;
        first_name: string | null;
        last_name: string | null;
      } | null;
    } | null;

    if (!isAdmin && corretor?.profiles?.user_id !== access.userId) {
      return jsonResponse(req, { error: 'Acesso negado para esta visita' }, 403);
    }
    if (visita.status !== 'realizada' || visita.interesse !== true) {
      return jsonResponse(req, {
        error: 'A visita precisa estar realizada e marcada com interesse',
      }, 409);
    }

    const existingMetadata = visita.confirmation_metadata as JsonObject | null;
    if (existingMetadata?.crm_sync_status === 'success') {
      return jsonResponse(req, {
        success: true,
        already_synced: true,
        message: 'Lead já sincronizado com o CRM',
      });
    }

    const configuredUrl = Deno.env.get('KRAYIN_API_URL')?.trim();
    const token = Deno.env.get('KRAYIN_API_TOKEN')?.trim();
    if (!configuredUrl || !token) {
      return jsonResponse(req, {
        success: false,
        error: 'Integração com o CRM não configurada',
      }, 503);
    }

    const baseUrl = validateExternalHttpUrl(
      configuredUrl.endsWith('/') ? configuredUrl : `${configuredUrl}/`,
    );
    const endpoint = new URL('leads', baseUrl);
    validateExternalHttpUrl(endpoint.toString());

    const lead = visita.lead as unknown as {
      id: string;
      nome: string;
      telefone: string | null;
      email: string | null;
    };
    const empreendimento = visita.empreendimento as unknown as {
      id: string;
      nome: string | null;
      endereco: string | null;
      valor_min: number | null;
    } | null;
    const brokerName = [
      corretor?.profiles?.first_name,
      corretor?.profiles?.last_name,
    ].filter(Boolean).join(' ');

    const description = [
      '[Origem: MeMude Connect]',
      `Empreendimento: ${safeText(empreendimento?.nome, 200) || 'N/A'}`,
      `Endereço: ${safeText(empreendimento?.endereco, 300) || 'N/A'}`,
      '',
      '[Detalhes da Visita]',
      `Data: ${safeText(visita.data_visita, 20)}`,
      `Horário: ${safeText(visita.horario_visita, 20)}`,
      `Corretor: ${safeText(brokerName, 200) || 'N/A'}`,
      '',
      '[Feedback]',
      `Feedback do corretor: ${safeText(visita.feedback_corretor) || 'N/A'}`,
      `Comentários do lead: ${safeText(visita.comentarios_lead) || 'N/A'}`,
      `Avaliação do lead: ${visita.avaliacao_lead ?? 'N/A'}`,
    ].join('\n');

    const payload = {
      title: `${safeText(lead.nome, 160)} - Interesse em ${
        safeText(empreendimento?.nome, 160) || 'Imóvel'
      }`,
      description,
      lead_value: empreendimento?.valor_min || 0,
      status: 1,
      lead_source_id: 1,
      lead_type_id: 1,
      person: {
        name: safeText(lead.nome, 200),
        emails: lead.email
          ? [{ value: safeText(lead.email, 320), label: 'work' }]
          : [],
        contact_numbers: lead.telefone
          ? [{ value: safeText(lead.telefone, 30), label: 'mobile' }]
          : [],
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Idempotency-Key': `memude-visita-${visita.id}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = (await response.text()).slice(0, 16 * 1024);

    if (!response.ok) {
      await access.supabase
        .from('visitas')
        .update({
          confirmation_metadata: mergeMetadata(existingMetadata, {
            crm_sync_status: 'failed',
            crm_sync_attempted_at: new Date().toISOString(),
            crm_sync_http_status: response.status,
          }),
        })
        .eq('id', visita.id);

      console.error('CRM synchronization failed with status:', response.status);
      return jsonResponse(req, {
        success: false,
        error: 'O CRM recusou a sincronização',
      }, 502);
    }

    let externalId: string | number | null = null;
    try {
      const parsed = JSON.parse(responseText) as {
        id?: string | number;
        data?: { id?: string | number };
      };
      externalId = parsed.id ?? parsed.data?.id ?? null;
    } catch {
      // A resposta pode ser vazia ou não-JSON; o status HTTP já confirmou sucesso.
    }

    const { error: updateError } = await access.supabase
      .from('visitas')
      .update({
        confirmation_metadata: mergeMetadata(existingMetadata, {
          crm_sync_status: 'success',
          crm_synced_at: new Date().toISOString(),
          crm_external_id: externalId,
        }),
      })
      .eq('id', visita.id);
    if (updateError) throw updateError;

    return jsonResponse(req, {
      success: true,
      external_id: externalId,
    });
  } catch (error) {
    const message = safeError(error);
    console.error('Falha na sincronização com CRM:', message);
    const status = message.includes('limite') || message.includes('JSON')
      ? 400
      : 500;
    return jsonResponse(req, {
      success: false,
      error: status === 500 ? 'Falha interna ao sincronizar com o CRM' : message,
    }, status);
  }
});
