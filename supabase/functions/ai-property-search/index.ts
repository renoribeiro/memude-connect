import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import OpenAI from 'https://esm.sh/openai@4.28.0';
import { authorize, readJson } from '../_shared/security.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertySearchRequest {
    query: string;
    filters?: {
        min_price?: number;
        max_price?: number;
        bairro_id?: string;
        tipo_imovel?: string;
    };
    max_results?: number;
    threshold?: number;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const access = await authorize(req, 'internal');
        if (access instanceof Response) return access;

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { query, filters, max_results = 5, threshold = 0.6 }: PropertySearchRequest = await readJson(req, 1024 * 1024);

        if (!query) {
            throw new Error('Query é obrigatória');
        }

        console.log(`🔍 Buscando imóveis: "${query.substring(0, 50)}..."`);

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

        // Generate embedding for query
        console.log('🧮 Gerando embedding da query...');
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Search using vector similarity
        console.log('🔎 Buscando por similaridade vetorial...');
        const { data: matchedProperties, error: searchError } = await supabase.rpc('match_properties', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: max_results,
            filter_min_price: filters?.min_price || null,
            filter_max_price: filters?.max_price || null,
            filter_bairro_id: filters?.bairro_id || null
        });

        if (searchError) {
            console.error('Erro na busca vetorial:', searchError);
            throw new Error(`Erro na busca: ${searchError.message}`);
        }

        console.log(`✅ Encontrados ${matchedProperties?.length || 0} imóveis`);

        // Enrich results with full empreendimento data
        let enrichedResults: any[] = [];

        if (matchedProperties && matchedProperties.length > 0) {
            const empreendimentoIds = matchedProperties.map((p: any) => p.empreendimento_id);

            const { data: fullData } = await supabase
                .from('empreendimentos')
                .select(`
          id,
          nome,
          descricao,
          valor_min,
          valor_max,
          endereco,
          tipo_imovel,
          bairro:bairros(id, nome, cidade),
          construtora:construtoras(id, nome)
        `)
                .in('id', empreendimentoIds)
                .eq('ativo', true);

            // Merge with similarity scores
            enrichedResults = (fullData || []).map(emp => {
                const match = matchedProperties.find((m: any) => m.empreendimento_id === emp.id);
                return {
                    ...emp,
                    similarity: match?.similarity || 0
                };
            }).sort((a, b) => b.similarity - a.similarity);
        }

        // Format for AI/WhatsApp
        const formattedForAI = enrichedResults.map((emp, index) => ({
            position: index + 1,
            id: emp.id,
            nome: emp.nome,
            tipo: emp.tipo_imovel,
            preco: formatPriceRange(emp.valor_min, emp.valor_max),
            localizacao: emp.bairro?.nome || 'Não informado',
            construtora: emp.construtora?.nome || 'Não informada',
            similarity: (emp.similarity * 100).toFixed(1) + '%'
        }));

        // Generate text summary for WhatsApp
        let textSummary = '';
        if (enrichedResults.length > 0) {
            textSummary = '🏠 *Imóveis encontrados para você:*\n\n';
            enrichedResults.forEach((emp, i) => {
                textSummary += `*${i + 1}. ${emp.nome}*\n`;
                textSummary += `📍 ${emp.bairro?.nome || 'Localização não informada'}\n`;
                textSummary += `💰 ${formatPriceRange(emp.valor_min, emp.valor_max)}\n`;
                if (emp.construtora) {
                    textSummary += `🏗️ ${emp.construtora.nome}\n`;
                }
                textSummary += '\n';
            });
            textSummary += '_Posso te dar mais detalhes sobre algum deles?_';
        } else {
            textSummary = 'Não encontrei imóveis compatíveis com sua busca. Pode me contar mais sobre o que você procura?';
        }

        return new Response(
            JSON.stringify({
                success: true,
                count: enrichedResults.length,
                properties: enrichedResults,
                formatted: formattedForAI,
                text_summary: textSummary,
                query_used: query,
                duration: Date.now() - startTime
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('❌ Erro na busca de imóveis:', error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                count: 0,
                properties: [],
                duration: Date.now() - startTime
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});

function formatPriceRange(min: number | null, max: number | null): string {
    const formatValue = (value: number): string => {
        if (value >= 1000000) {
            return `R$ ${(value / 1000000).toFixed(1)} mi`;
        }
        if (value >= 1000) {
            return `R$ ${(value / 1000).toFixed(0)} mil`;
        }
        return `R$ ${value.toFixed(0)}`;
    };

    if (min && max) {
        if (min === max) {
            return formatValue(min);
        }
        return `${formatValue(min)} a ${formatValue(max)}`;
    }

    if (min) {
        return `A partir de ${formatValue(min)}`;
    }

    if (max) {
        return `Até ${formatValue(max)}`;
    }

    return 'Consulte';
}
