import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

interface LegacyButtonConfig {
  buttons?: Array<{ displayText?: string }>;
}

interface LegacyWhatsAppMessage {
  phone_number?: string;
  message?: string;
  lead_id?: string;
  corretor_id?: string;
  useButtons?: boolean;
  buttonConfig?: LegacyButtonConfig;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const access = await authorize(req, 'admin-or-internal');
  if (access instanceof Response) return access;

  try {
    const body = await readJson<LegacyWhatsAppMessage>(req, 16 * 1024);
    const phone = body.phone_number?.trim();
    const message = body.message?.trim();

    if (!phone || !message) {
      return jsonResponse(req, {
        error: 'phone_number e message são obrigatórios',
      }, 400);
    }
    if (message.length > 4096) {
      return jsonResponse(req, { error: 'Mensagem excede 4096 caracteres' }, 400);
    }

    const legacyButtons = body.useButtons
      ? (body.buttonConfig?.buttons || [])
          .map((button, index) => ({
            id: `legacy_${index + 1}`,
            text: button.displayText?.trim() || '',
          }))
          .filter((button) => button.text)
          .slice(0, 3)
      : undefined;

    const { data, error } = await access.supabase.functions.invoke(
      'evolution-send-whatsapp-v2',
      {
        body: {
          phone_number: phone,
          message,
          lead_id: body.lead_id,
          corretor_id: body.corretor_id,
          buttons: legacyButtons,
          metadata: {
            compatibility_source: 'enhanced-whatsapp-sender',
          },
        },
      },
    );

    if (error) {
      const upstreamStatus = Number(
        (error as { context?: { status?: number } }).context?.status,
      ) || 502;
      return jsonResponse(req, {
        success: false,
        error: 'Falha no transportador WhatsApp',
      }, upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502);
    }

    return jsonResponse(req, {
      ...data,
      deprecated_endpoint: true,
      replacement: 'evolution-send-whatsapp-v2',
    });
  } catch (error) {
    console.error('Falha no adaptador legado de WhatsApp:', safeError(error));
    return jsonResponse(req, { error: safeError(error) }, 400);
  }
});
