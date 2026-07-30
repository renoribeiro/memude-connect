import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorize, handleOptions, readJson } from '../_shared/security.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// HELPERS
// ============================================================

async function sendWhatsAppWithRetry(supabase: any, phone: string, message: string, maxRetries = 3): Promise<boolean> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const { error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
                body: {
                    phone_number: phone,
                    message: message
                }
            });

            if (error) throw error;
            return true;
        } catch (error) {
            attempt++;
            console.warn(`WhatsApp attempt ${attempt}/${maxRetries} failed:`, error);
            if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
    }
    return false;
}

// ============================================================
// PAYMENT REMINDER CHECKER
// Cron job diário que verifica vendas com pagamento próximo
// e envia lembretes internos + WhatsApp para o admin
// ============================================================

serve(async (req) => {
    const optionsResponse = handleOptions(req);
    if (optionsResponse) return optionsResponse;

    const startTime = Date.now();
    const access = await authorize(req, 'internal');
    if (access instanceof Response) return access;

    const internalHeader = req.headers.get('x-internal-secret');
    const authHeader = req.headers.get('Authorization') || (internalHeader ? `Bearer ${internalHeader}` : null);
    const cronSecret = internalHeader;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const { supabase } = access;

    const token = authHeader?.replace('Bearer ', '');
    const isValidCronAuth = token === cronSecret;
    const isValidServiceAuth = token === serviceRoleKey;

    let isValidInternalAuth = false;
    if (!isValidCronAuth && !isValidServiceAuth && token) {
        try {
            const { data: internalSecret } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'cron_secret')
                .single();
            if (internalSecret && internalSecret.value === token) {
                isValidInternalAuth = true;
            }
        } catch (e) {
            console.warn('Erro ao verificar internal cron secret:', e);
        }
    }

    if (!isValidCronAuth && !isValidServiceAuth && !isValidInternalAuth) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        console.log('🔔 Payment Reminder Checker iniciando...');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const { data: vendas, error: vendasError } = await supabase
            .from('vendas')
            .select(`
                id,
                valor_imovel,
                valor_corretor,
                valor_memude,
                valor_comissao_liquida,
                data_pagamento,
                status,
                is_venda_direta,
                leads!inner ( nome, telefone ),
                empreendimentos!inner ( nome ),
                corretores ( nome )
            `)
            .eq('data_pagamento', tomorrowStr)
            .eq('lembrete_enviado', false)
            .in('status', ['pendente', 'aprovada']);

        if (vendasError) {
            throw new Error(`Erro ao buscar vendas: ${vendasError.message}`);
        }

        console.log(`📋 Encontradas ${vendas?.length || 0} vendas com pagamento amanhã`);

        const results = { checked: vendas?.length || 0, reminders: 0, errors: 0 };

        const { data: admins } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('role', 'admin');

        for (const venda of vendas || []) {
            try {
                const leadNome = (venda.leads as any)?.nome || 'Lead';
                const empNome = (venda.empreendimentos as any)?.nome || 'Empreendimento';
                const corretorNome = venda.is_venda_direta ? 'Venda Direta' : ((venda.corretores as any)?.nome || 'Corretor');

                const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(venda.valor_comissao_liquida));

                // 1. Send Internal Notifications
                for (const admin of admins || []) {
                    await supabase.from('notifications').insert({
                        user_id: admin.id,
                        type: 'payment_reminder',
                        title: '💰 Lembrete de Pagamento',
                        message: `Pagamento de ${valorFormatado} para venda de ${leadNome} (${empNome}) vence amanhã. Corretor: ${corretorNome}.`,
                        data: { venda_id: venda.id }
                    });
                }

                // 2. Send WhatsApp with Retry
                for (const admin of admins || []) {
                    if (admin.phone) {
                        const whatsappMessage = `💰 *Lembrete de Pagamento*\n\n` +
                            `📋 Venda: ${leadNome} - ${empNome}\n` +
                            `👤 Corretor: ${corretorNome}\n` +
                            `💵 Valor Líquido: ${valorFormatado}\n` +
                            `📅 Vencimento: ${new Date(venda.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}\n\n` +
                            `⚠️ Este pagamento vence *amanhã*!`;

                        await sendWhatsAppWithRetry(supabase, admin.phone, whatsappMessage);
                    }
                }

                await supabase
                    .from('vendas')
                    .update({ lembrete_enviado: true })
                    .eq('id', venda.id);

                results.reminders++;
                console.log(`✅ Lembrete enviado para venda ${venda.id} (${leadNome})`);

            } catch (vendaError: any) {
                console.error(`❌ Erro ao processar venda ${venda.id}:`, vendaError.message);
                results.errors++;
            }
        }

        console.log(`📊 Resultado: ${results.reminders} lembretes enviados, ${results.errors} erros`);

        return new Response(
            JSON.stringify({ success: true, ...results, duration: Date.now() - startTime }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('❌ Erro no Payment Reminder Checker:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message, duration: Date.now() - startTime }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
