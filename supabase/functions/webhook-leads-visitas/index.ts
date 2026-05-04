import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructured } from "../_shared/structuredLogger.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_TOKEN = "memude-api-token2026";

interface LeadPayload {
    nome: string;
    telefone: string;
    email?: string;
    origem?: string;
    observacoes?: string;
}

interface VisitaPayload {
    empreendimento_nome: string;
    data_visita: string;
    horario_visita: string;
    observacoes?: string;
}

interface WebhookRequest {
    lead: LeadPayload;
    visita?: VisitaPayload;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        // ── Auth: validate static token ──
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token || token !== WEBHOOK_TOKEN) {
            await logStructured(supabase, {
                level: "warn",
                function_name: "webhook-leads-visitas",
                event: "auth_failed",
                message: "Invalid or missing webhook token",
                request_id: requestId,
                execution_time_ms: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: "Unauthorized: token inválido ou ausente" }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 401,
                }
            );
        }

        // ── Rate limiting: 30 requests / minute ──
        const { data: rateLimit } = await supabase.rpc("increment_rate_limit", {
            p_key: "webhook_leads_visitas",
            p_max: 30,
            p_window_seconds: 60,
        });

        if (rateLimit && !rateLimit[0]?.is_allowed) {
            return new Response(
                JSON.stringify({
                    error: "Rate limit excedido. Tente novamente em 60 segundos.",
                    retry_after: 60,
                }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 429,
                }
            );
        }

        // ── Parse and validate body ──
        const body: WebhookRequest = await req.json();

        if (!body.lead?.nome || !body.lead?.telefone) {
            return new Response(
                JSON.stringify({
                    error: "Campos obrigatórios ausentes: lead.nome e lead.telefone",
                }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                }
            );
        }

        const cleanPhone = body.lead.telefone.replace(/\D/g, "");

        // ── Step 1: Upsert lead (match by telefone) ──
        const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("telefone", cleanPhone)
            .is("deleted_at", null)
            .maybeSingle();

        let leadId: string;
        let leadAction: "created" | "updated";

        const leadData: Record<string, unknown> = {
            nome: body.lead.nome,
            telefone: cleanPhone,
            origem: body.lead.origem ?? "webhook",
            updated_at: new Date().toISOString(),
        };

        if (body.lead.email) leadData.email = body.lead.email;
        if (body.lead.observacoes) leadData.observacoes = body.lead.observacoes;

        if (existingLead) {
            // Update existing lead
            const { error: updateError } = await supabase
                .from("leads")
                .update(leadData)
                .eq("id", existingLead.id);

            if (updateError) {
                throw new Error(`Erro ao atualizar lead: ${updateError.message}`);
            }

            leadId = existingLead.id;
            leadAction = "updated";
            console.log(`Lead atualizado: ${leadId}`);
        } else {
            // Create new lead
            leadData.data_visita_solicitada =
                body.visita?.data_visita ?? new Date().toISOString().split("T")[0];
            leadData.horario_visita_solicitada =
                body.visita?.horario_visita ?? "10:00";
            leadData.status = "novo";

            const { data: newLead, error: insertError } = await supabase
                .from("leads")
                .insert(leadData)
                .select("id")
                .single();

            if (insertError || !newLead) {
                throw new Error(
                    `Erro ao criar lead: ${insertError?.message ?? "unknown"}`
                );
            }

            leadId = newLead.id;
            leadAction = "created";
            console.log(`Lead criado: ${leadId}`);
        }

        // ── Step 2: Create visit (if visita payload present) ──
        let visitaId: string | null = null;
        let empreendimentoId: string | null = null;

        if (body.visita) {
            // Find empreendimento by name (case-insensitive)
            const { data: empreendimentos, error: empError } = await supabase
                .from("empreendimentos")
                .select("id, nome")
                .ilike("nome", `%${body.visita.empreendimento_nome}%`)
                .eq("ativo", true)
                .limit(5);

            if (empError) {
                throw new Error(
                    `Erro ao buscar empreendimento: ${empError.message}`
                );
            }

            if (!empreendimentos || empreendimentos.length === 0) {
                await logStructured(supabase, {
                    level: "warn",
                    function_name: "webhook-leads-visitas",
                    event: "empreendimento_not_found",
                    message: `Empreendimento não encontrado: ${body.visita.empreendimento_nome}`,
                    lead_id: leadId,
                    request_id: requestId,
                    execution_time_ms: Date.now() - startTime,
                });

                return new Response(
                    JSON.stringify({
                        error: `Empreendimento não encontrado: "${body.visita.empreendimento_nome}"`,
                        lead_id: leadId,
                        lead_action: leadAction,
                        hint: "Verifique o nome exato do empreendimento cadastrado no sistema.",
                    }),
                    {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 404,
                    }
                );
            }

            // Pick best match: exact match first, then first partial match
            const exactMatch = empreendimentos.find(
                (e: { nome: string }) =>
                    e.nome.toLowerCase() ===
                    body.visita!.empreendimento_nome.toLowerCase()
            );
            const selectedEmp = exactMatch ?? empreendimentos[0];
            empreendimentoId = selectedEmp.id;

            // Also update the lead's empreendimento reference
            await supabase
                .from("leads")
                .update({ empreendimento_id: empreendimentoId })
                .eq("id", leadId);

            // Create visit
            const visitaData: Record<string, unknown> = {
                lead_id: leadId,
                empreendimento_id: empreendimentoId,
                data_visita: body.visita.data_visita,
                horario_visita: body.visita.horario_visita,
                status: "agendada",
            };

            if (body.visita.observacoes) {
                visitaData.comentarios_lead = body.visita.observacoes;
            }

            const { data: newVisita, error: visitaError } = await supabase
                .from("visitas")
                .insert(visitaData)
                .select("id")
                .single();

            if (visitaError || !newVisita) {
                throw new Error(
                    `Erro ao criar visita: ${visitaError?.message ?? "unknown"}`
                );
            }

            visitaId = newVisita.id;
            console.log(`Visita criada: ${visitaId}`);

            // Update lead status
            await supabase
                .from("leads")
                .update({
                    status: "visita_agendada",
                    data_visita_solicitada: body.visita.data_visita,
                    horario_visita_solicitada: body.visita.horario_visita,
                })
                .eq("id", leadId);
        }

        // ── Log success ──
        await logStructured(supabase, {
            level: "info",
            function_name: "webhook-leads-visitas",
            event: "webhook_processed",
            message: `Webhook processado: lead ${leadAction}, visita ${visitaId ? "criada" : "não solicitada"}`,
            lead_id: leadId,
            request_id: requestId,
            execution_time_ms: Date.now() - startTime,
            metadata: {
                lead_action: leadAction,
                visita_id: visitaId,
                empreendimento_id: empreendimentoId,
                origem: body.lead.origem ?? "webhook",
            },
        });

        return new Response(
            JSON.stringify({
                success: true,
                lead_id: leadId,
                lead_action: leadAction,
                visita_id: visitaId,
                empreendimento_id: empreendimentoId,
                message:
                    leadAction === "created"
                        ? "Lead criado e visita agendada com sucesso."
                        : "Lead atualizado e visita agendada com sucesso.",
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error: unknown) {
        const errMsg =
            error instanceof Error ? error.message : "Erro interno desconhecido";
        const errStack = error instanceof Error ? error.stack : undefined;

        console.error("Erro no webhook-leads-visitas:", errMsg);

        await logStructured(supabase, {
            level: "error",
            function_name: "webhook-leads-visitas",
            event: "webhook_failed",
            message: errMsg,
            error_stack: errStack,
            request_id: requestId,
            execution_time_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify({ error: errMsg }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
