import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateEmbeddingsRequest {
    empreendimento_id?: string;
    regenerate_all?: boolean;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { empreendimento_id, regenerate_all }: GenerateEmbeddingsRequest = await req.json().catch(() => ({}));

        console.log('🧮 Gerando embeddings...', { empreendimento_id, regenerate_all });

        // Get OpenAI API key
        const { data: openaiSetting } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'openai_api_key')
            .single();

        if (!openaiSetting?.value) {
            throw new Error('OpenAI API key não configurada');
        }

        const openai = new OpenAI({ apiKey: openaiSetting.value });

        let empreendimentos: any[] = [];

        if (empreendimento_id) {
            // Single empreendimento
            const { data, error } = await supabase
                .from('empreendimentos')
                .select(`
          id,
          nome,
          descricao,
          valor_min,
          valor_max,
          endereco,
          tipo_imovel,
          bairro:bairros(nome, cidade),
          construtora:construtoras(nome)
        `)
                .eq('id', empreendimento_id)
                .eq('ativo', true)
                .single();

            if (error) {
                throw new Error(`Empreendimento não encontrado: ${error.message}`);
            }

            empreendimentos = [data];
        } else if (regenerate_all) {
            // All active empreendimentos
            const { data, error } = await supabase
                .from('empreendimentos')
                .select(`
          id,
          nome,
          descricao,
          valor_min,
          valor_max,
          endereco,
          tipo_imovel,
          bairro:bairros(nome, cidade),
          construtora:construtoras(nome)
        `)
                .eq('ativo', true);

            if (error) {
                throw new Error(`Erro ao buscar empreendimentos: ${error.message}`);
            }

            empreendimentos = data || [];
        } else {
            // Only empreendimentos without embeddings
            const { data: existing } = await supabase
                .from('property_embeddings')
                .select('empreendimento_id');

            const existingIds = new Set((existing || []).map(e => e.empreendimento_id));

            const { data, error } = await supabase
                .from('empreendimentos')
                .select(`
          id,
          nome,
          descricao,
          valor_min,
          valor_max,
          endereco,
          tipo_imovel,
          bairro:bairros(nome, cidade),
          construtora:construtoras(nome)
        `)
                .eq('ativo', true);

            if (error) {
                throw new Error(`Erro ao buscar empreendimentos: ${error.message}`);
            }

            empreendimentos = (data || []).filter(e => !existingIds.has(e.id));
        }

        console.log(`📊 ${empreendimentos.length} empreendimentos para processar`);

        if (empreendimentos.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    processed: 0,
                    message: 'Nenhum empreendimento para processar',
                    duration: Date.now() - startTime
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let processed = 0;
        const errors: string[] = [];

        // Process in batches of 10
        const batchSize = 10;

        for (let i = 0; i < empreendimentos.length; i += batchSize) {
            const batch = empreendimentos.slice(i, i + batchSize);

            const results = await Promise.allSettled(
                batch.map(async (emp) => {
                    try {
                        // Build content text for embedding
                        const contentText = buildContentText(emp);

                        // Generate embedding
                        const embeddingResponse = await openai.embeddings.create({
                            model: 'text-embedding-3-small',
                            input: contentText
                        });

                        const embedding = embeddingResponse.data[0].embedding;

                        // Upsert to database
                        const { error: upsertError } = await supabase
                            .from('property_embeddings')
                            .upsert({
                                empreendimento_id: emp.id,
                                embedding: embedding,
                                content_text: contentText,
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'empreendimento_id'
                            });

                        if (upsertError) {
                            throw new Error(upsertError.message);
                        }

                        processed++;
                        console.log(`✅ Embedding gerado: ${emp.nome}`);
                    } catch (error) {
                        const msg = `Erro em ${emp.nome}: ${error.message}`;
                        console.error(msg);
                        errors.push(msg);
                    }
                })
            );

            // Rate limiting between batches
            if (i + batchSize < empreendimentos.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`🏁 Processamento concluído: ${processed}/${empreendimentos.length}`);

        return new Response(
            JSON.stringify({
                success: true,
                processed,
                total: empreendimentos.length,
                errors: errors.length > 0 ? errors : undefined,
                duration: Date.now() - startTime
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('❌ Erro ao gerar embeddings:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});

function buildContentText(emp: any): string {
    const parts: string[] = [];

    // Name (most important)
    parts.push(`Empreendimento: ${emp.nome}`);

    // Description
    if (emp.descricao) {
        // Limit description to 500 chars
        const desc = emp.descricao.length > 500
            ? emp.descricao.substring(0, 500) + '...'
            : emp.descricao;
        parts.push(`Descrição: ${desc}`);
    }

    // Property type
    if (emp.tipo_imovel) {
        parts.push(`Tipo: ${emp.tipo_imovel}`);
    }

    // Price range
    if (emp.valor_min || emp.valor_max) {
        const min = emp.valor_min ? formatPrice(emp.valor_min) : '';
        const max = emp.valor_max ? formatPrice(emp.valor_max) : '';
        if (min && max) {
            parts.push(`Preço: de ${min} até ${max}`);
        } else if (min) {
            parts.push(`Preço a partir de: ${min}`);
        } else if (max) {
            parts.push(`Preço até: ${max}`);
        }
    }

    // Location
    if (emp.bairro) {
        parts.push(`Bairro: ${emp.bairro.nome}`);
        if (emp.bairro.cidade) {
            parts.push(`Cidade: ${emp.bairro.cidade}`);
        }
    }

    if (emp.endereco) {
        parts.push(`Endereço: ${emp.endereco}`);
    }

    // Builder
    if (emp.construtora) {
        parts.push(`Construtora: ${emp.construtora.nome}`);
    }

    return parts.join('. ');
}

function formatPrice(value: number): string {
    if (value >= 1000000) {
        return `R$ ${(value / 1000000).toFixed(1)} milhões`;
    }
    if (value >= 1000) {
        return `R$ ${(value / 1000).toFixed(0)} mil`;
    }
    return `R$ ${value.toFixed(0)}`;
}
