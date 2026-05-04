import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPressPost {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  link: string;
  modified: string;
  categories: number[];
  tags: number[];
  meta?: Record<string, any>;
  class_list?: string[]; // Added for enhanced extraction
}

interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
}

interface SyncStats {
  totalPostsFetched: number;
  newEmpreendimentos: number;
  updatedEmpreendimentos: number;
  errorsCount: number;
  lastWpPostId: number;
}

interface PerformanceMetric {
  operationType: string;
  operationStart: string;
  postId?: number;
  empreendimentoId?: string;
  metadata?: Record<string, any>;
}

// Cache global para categorias
const categoriesCache: Map<number, WordPressCategory> = new Map();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const syncId = crypto.randomUUID();

  // Parse request body to get parameters
  const { manual = false, test_mode = false, limit = null } = await req.json().catch(() => ({}));

  console.log(`🚀 Iniciando sincronização WordPress [${syncId}] - Manual: ${manual}, Teste: ${test_mode} às:`, new Date().toISOString());

  // Initialize Supabase client with proper credentials
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Credenciais do Supabase não encontradas');
    return new Response(JSON.stringify({
      success: false,
      error: 'Credenciais do Supabase não configuradas'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('🔑 Conectando ao Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Test Supabase connection
  try {
    const { error: connectionError } = await supabase
      .from('wp_sync_log')
      .select('count')
      .limit(1);

    if (connectionError) {
      throw new Error(`Falha na conexão com Supabase: ${connectionError.message}`);
    }

    console.log('✅ Conexão com Supabase estabelecida');
  } catch (error) {
    console.error('❌ Erro de conexão com Supabase:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `Erro de conexão: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const stats: SyncStats = {
    totalPostsFetched: 0,
    newEmpreendimentos: 0,
    updatedEmpreendimentos: 0,
    errorsCount: 0,
    lastWpPostId: 0
  };

  const errors: string[] = [];
  const performanceMetrics: PerformanceMetric[] = [];
  let syncLogId: string | null = null;

  // Test mode - just verify connection
  if (test_mode) {
    console.log('🧪 Modo de teste ativado');

    try {
      const testUrl = `https://memude.com.br/wp-json/wp/v2/posts?per_page=${limit || 5}&_fields=id,title,modified`;
      console.log('🔗 Testando URL:', testUrl);

      const testResponse = await fetch(testUrl);

      if (!testResponse.ok) {
        throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`);
      }

      const testPosts = await testResponse.json();
      stats.totalPostsFetched = testPosts.length;

      console.log(`✅ Teste concluído: ${testPosts.length} posts encontrados em ${Date.now() - startTime}ms`);

      return new Response(JSON.stringify({
        success: true,
        test_mode: true,
        totalPostsFetched: stats.totalPostsFetched,
        newEmpreendimentos: 0,
        updatedEmpreendimentos: 0,
        connectionStatus: 'OK',
        duration: Date.now() - startTime,
        samplePosts: testPosts.map((p: any) => ({ id: p.id, title: p.title?.rendered || 'Sem título' }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (error) {
      console.error('❌ Erro no teste:', error);
      return new Response(JSON.stringify({
        success: false,
        test_mode: true,
        error: error.message,
        connectionStatus: 'FAILED',
        totalPostsFetched: 0,
        newEmpreendimentos: 0,
        updatedEmpreendimentos: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  try {
    // Create initial sync log entry
    const { data: syncLogData, error: logError } = await supabase
      .from('wp_sync_log')
      .insert({
        total_posts_fetched: 0,
        status: 'success'
      })
      .select('id')
      .single();

    if (!logError && syncLogData) {
      syncLogId = syncLogData.id;
    }

    // Load categories cache
    await loadCategoriesCache(supabase);

    // Fetch all WordPress posts with performance tracking
    const fetchStart = Date.now();
    const allPosts = await fetchAllWordPressPosts(performanceMetrics, syncLogId, supabase);
    const fetchDuration = Date.now() - fetchStart;

    stats.totalPostsFetched = allPosts.length;
    console.log(`📊 Total de posts encontrados: ${allPosts.length} (${fetchDuration}ms)`);

    // Process posts in batches of 10 for better performance
    const batchSize = 10;
    for (let i = 0; i < allPosts.length; i += batchSize) {
      const batch = allPosts.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (post) => {
          try {
            await processWordPressPost(post, stats, supabase, performanceMetrics, syncLogId);
            stats.lastWpPostId = Math.max(stats.lastWpPostId, post.id);
          } catch (error) {
            stats.errorsCount++;
            const errorMsg = `Erro ao processar post ID ${post.id}: ${error.message}`;
            console.error('❌', errorMsg);
            errors.push(errorMsg);
          }
        })
      );

      // Rate limiting between batches - 500ms delay
      if (i + batchSize < allPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save performance metrics
    if (performanceMetrics.length > 0 && syncLogId) {
      await savePerformanceMetrics(supabase, performanceMetrics, syncLogId);
    }

    // Log final sync results
    const syncDuration = Date.now() - startTime;
    await logSyncResults(supabase, stats, syncDuration, errors, syncLogId);

    const response = {
      success: true,
      syncId,
      stats,
      duration: syncDuration,
      performanceMetrics: performanceMetrics.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`✅ Sincronização [${syncId}] concluída:`, response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`🚨 Erro crítico na sincronização [${syncId}]:`, error);

    const syncDuration = Date.now() - startTime;
    await logSyncResults(supabase, stats, syncDuration, [error.message], syncLogId, 'error');

    return new Response(JSON.stringify({
      error: error.message,
      syncId,
      stats,
      duration: syncDuration
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function loadCategoriesCache(supabase: any) {
  console.log('📥 Carregando cache de categorias...');

  // Try to load from database cache first
  const { data: cachedCategories } = await supabase
    .from('wp_categories_cache')
    .select('*')
    .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

  if (cachedCategories && cachedCategories.length > 0) {
    cachedCategories.forEach((cat: any) => {
      categoriesCache.set(cat.wp_category_id, {
        id: cat.wp_category_id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parent: cat.parent
      });
    });
    console.log(`📋 Cache carregado: ${cachedCategories.length} categorias`);
    return;
  }

  // Fetch from WordPress API if cache is empty or old
  try {
    const response = await fetch('https://memude.com.br/wp-json/wp/v2/categories?per_page=100', {
      headers: { 'User-Agent': 'Memude Sync Bot/1.0' },
      signal: AbortSignal.timeout(30000)
    });

    if (response.ok) {
      const categories: WordPressCategory[] = await response.json();

      // Update database cache
      if (categories.length > 0) {
        await supabase.from('wp_categories_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const cacheData = categories.map(cat => ({
          wp_category_id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          parent: cat.parent
        }));

        await supabase.from('wp_categories_cache').insert(cacheData);

        // Update memory cache
        categories.forEach(cat => categoriesCache.set(cat.id, cat));
        console.log(`📋 Cache atualizado: ${categories.length} categorias`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar categorias:', error.message);
  }
}

async function fetchAllWordPressPosts(
  performanceMetrics: PerformanceMetric[],
  syncLogId: string | null,
  supabase: any
): Promise<WordPressPost[]> {
  const allPosts: WordPressPost[] = [];
  let page = 1;
  const perPage = 100;
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  while (true) {
    console.log(`📄 Buscando página ${page}...`);

    const fetchStart = Date.now();
    const metricData: PerformanceMetric = {
      operationType: 'fetch_posts',
      operationStart: new Date(fetchStart).toISOString(),
      metadata: { page, perPage }
    };

    const url = `https://memude.com.br/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&orderby=modified&order=desc`;

    let success = false;
    let posts: WordPressPost[] = [];
    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentativa ${attempt}/${maxRetries} para página ${page}`);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Memude Sync Bot/1.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(45000) // 45s timeout
        });

        const fetchEnd = Date.now();
        const duration = fetchEnd - fetchStart;

        if (!response.ok) {
          if (response.status === 400 && page > 1) {
            console.log(`✅ Fim das páginas alcançado na página ${page}`);
            success = true;
            posts = [];
            break;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        posts = await response.json();
        success = true;

        // Record performance metric
        performanceMetrics.push({
          ...metricData,
          metadata: {
            ...metricData.metadata,
            postsCount: posts.length,
            duration,
            success: true,
            attempt
          }
        });

        console.log(`✅ Página ${page}: ${posts.length} posts (${duration}ms, tentativa ${attempt})`);
        break;

      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - fetchStart;

        console.error(`❌ Erro na tentativa ${attempt}/${maxRetries} para página ${page}:`, error.message);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Record failed metric
          performanceMetrics.push({
            ...metricData,
            metadata: {
              ...metricData.metadata,
              duration,
              success: false,
              error: error.message,
              attempts: maxRetries
            }
          });
        }
      }
    }

    if (!success) {
      throw new Error(`Falha após ${maxRetries} tentativas: ${lastError?.message}`);
    }

    if (posts.length === 0) {
      console.log(`✅ Página ${page} vazia, finalizando busca`);
      break;
    }

    allPosts.push(...posts);

    if (posts.length < perPage) {
      console.log(`✅ Última página encontrada (${posts.length} < ${perPage})`);
      break;
    }

    page++;

    // Rate limiting between pages
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allPosts;
}

async function processWordPressPost(
  post: WordPressPost,
  stats: SyncStats,
  supabase: any,
  performanceMetrics: PerformanceMetric[],
  syncLogId: string | null
) {
  const processStart = Date.now();
  const metricData: PerformanceMetric = {
    operationType: 'process_post',
    operationStart: new Date(processStart).toISOString(),
    postId: post.id
  };

  console.log(`🔄 Processando post ID ${post.id}: "${post.title.rendered}"`);

  const maxRetries = 2;
  let lastError: Error | null = null;

  // Retry logic for database operations
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Extract empreendimento data from post
      const empreendimentoData = await extractEmpreendimentoData(post, supabase);

      if (!empreendimentoData.nome || empreendimentoData.nome.trim().length === 0) {
        throw new Error('Nome do empreendimento não pode estar vazio');
      }

      // Check if empreendimento already exists
      const { data: existingEmp, error: selectError } = await supabase
        .from('empreendimentos')
        .select('*')
        .eq('wp_post_id', post.id)
        .maybeSingle();

      if (selectError) {
        throw new Error(`Erro ao verificar empreendimento existente: ${selectError.message}`);
      }

      const processEnd = Date.now();
      const duration = processEnd - processStart;

      if (existingEmp) {
        // Update existing empreendimento
        const { error } = await supabase
          .from('empreendimentos')
          .update(empreendimentoData)
          .eq('wp_post_id', post.id);

        if (error) {
          throw new Error(`Erro ao atualizar empreendimento: ${error.message}`);
        }

        stats.updatedEmpreendimentos++;
        console.log(`✅ Empreendimento atualizado: ${empreendimentoData.nome} (${duration}ms)`);

        // Record performance metric
        performanceMetrics.push({
          ...metricData,
          operationType: 'update_emp',
          empreendimentoId: existingEmp.id,
          metadata: { duration, success: true, attempt }
        });
      } else {
        // Create new empreendimento
        const { data: newEmp, error } = await supabase
          .from('empreendimentos')
          .insert({ ...empreendimentoData, wp_post_id: post.id })
          .select('id')
          .single();

        if (error) {
          throw new Error(`Erro ao criar empreendimento: ${error.message}`);
        }

        stats.newEmpreendimentos++;
        console.log(`✅ Novo empreendimento criado: ${empreendimentoData.nome} (${duration}ms)`);

        // Record performance metric
        performanceMetrics.push({
          ...metricData,
          operationType: 'create_emp',
          empreendimentoId: newEmp?.id,
          metadata: { duration, success: true, attempt }
        });
      }

      return; // Success, exit retry loop

    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Tentativa ${attempt}/${maxRetries} falhou para post ID ${post.id}:`, error.message);

      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // If we get here, all retries failed
  const processEnd = Date.now();
  const duration = processEnd - processStart;

  // Record failed metric
  performanceMetrics.push({
    ...metricData,
    metadata: {
      duration,
      success: false,
      error: lastError?.message,
      attempts: maxRetries
    }
  });

  throw lastError || new Error('Falha desconhecida após múltiplas tentativas');
}

async function extractEmpreendimentoData(post: WordPressPost, supabase: any) {
  // Extract name from title
  const nome = post.title.rendered.replace(/<[^>]*>/g, '').trim();

  // Extract description from excerpt or content
  let descricao = post.excerpt.rendered || post.content.rendered;
  descricao = descricao.replace(/<[^>]*>/g, '').trim();
  if (descricao.length > 500) {
    descricao = descricao.substring(0, 500) + '...';
  }

  // Enhanced price extraction with comprehensive patterns
  const content = post.content.rendered;
  const title = post.title.rendered;
  const fullText = `${title} ${content}`;

  const pricePatterns = [
    // Direct price patterns
    /R\$\s*[\d.,]+/gi,
    /valor.*?R\$\s*[\d.,]+/gi,
    /pre[çc]o.*?R\$\s*[\d.,]+/gi,
    /apartamentos.*?R\$\s*[\d.,]+/gi,
    /unidades.*?R\$\s*[\d.,]+/gi,

    // Price ranges
    /de\s+R\$\s*[\d.,]+\s+a\s+R\$\s*[\d.,]+/gi,
    /entre\s+R\$\s*[\d.,]+\s+e\s+R\$\s*[\d.,]+/gi,
    /R\$\s*[\d.,]+\s*(?:a|até)\s*R\$\s*[\d.,]+/gi,

    // Financing patterns
    /financiamento.*?R\$\s*[\d.,]+/gi,
    /entrada.*?R\$\s*[\d.,]+/gi,
    /parcela.*?R\$\s*[\d.,]+/gi,

    // Area-based value indicators (m² values)
    /m[²2]\s*(?:por|a partir de)?\s*R\$\s*[\d.,]+/gi,
    /R\$\s*[\d.,]+\s*(?:por|\/)\s*m[²2]/gi
  ];

  let valorMin = null;
  let valorMax = null;
  const foundPrices: number[] = [];

  for (const pattern of pricePatterns) {
    const matches = fullText.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Extract all numbers from the match
        const priceMatches = match.match(/[\d.,]+/g);
        if (priceMatches) {
          for (const priceStr of priceMatches) {
            // Convert to number (handle Brazilian number format)
            let numStr = priceStr;

            // If it has dots and commas, assume Brazilian format (1.234.567,89)
            if (numStr.includes('.') && numStr.includes(',')) {
              numStr = numStr.replace(/\./g, '').replace(',', '.');
            }
            // If it only has commas, treat as decimal separator
            else if (numStr.includes(',') && !numStr.includes('.')) {
              numStr = numStr.replace(',', '.');
            }
            // If it only has dots, check if it's thousands separator or decimal
            else if (numStr.includes('.')) {
              const parts = numStr.split('.');
              if (parts[parts.length - 1].length === 2) {
                // Likely decimal separator
                numStr = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
              } else {
                // Likely thousands separator
                numStr = numStr.replace(/\./g, '');
              }
            }

            const price = parseFloat(numStr);

            // Filter realistic property prices (between R$ 50.000 and R$ 50.000.000)
            if (!isNaN(price) && price >= 50000 && price <= 50000000) {
              foundPrices.push(price);
            }
          }
        }
      }
    }
  }

  if (foundPrices.length > 0) {
    // Remove outliers (prices that are more than 3x different from median)
    foundPrices.sort((a, b) => a - b);
    const median = foundPrices[Math.floor(foundPrices.length / 2)];
    const filteredPrices = foundPrices.filter(price =>
      price >= median / 3 && price <= median * 3
    );

    if (filteredPrices.length > 0) {
      valorMin = Math.min(...filteredPrices);
      valorMax = Math.max(...filteredPrices);

      // If we only found one price, use it for both min and max
      if (filteredPrices.length === 1) {
        valorMin = valorMax = filteredPrices[0];
      }
    }
  }

  // Enhanced construtora and bairro identification
  const construtoraId = await findOrCreateConstructoraEnhanced(post, supabase);
  const bairroId = await findOrCreateBairroEnhanced(post, supabase);

  // Try to get address from the actual rendered page first (most reliable)
  let endereco = await fetchAddressFromPage(post.link);
  // Fallback to regex extraction from API content
  if (!endereco) {
    console.log(`⚠️ Page fetch failed for "${nome}", falling back to regex extraction`);
    endereco = extractAddress(content);
  } else {
    console.log(`✅ Address extracted from page for "${nome}": ${endereco}`);
  }

  return {
    nome,
    descricao,
    valor_min: valorMin,
    valor_max: valorMax,
    construtora_id: construtoraId,
    bairro_id: bairroId,
    endereco,
    ativo: true,
    updated_at: new Date().toISOString()
  };
}

function extractAddress(content: string): string | null {
  // PHASE 2: Enhanced address extraction with improved patterns and validation

  // 1. Pre-process content to remove HTML tags but keep structure hints
  // Replace block tags with newlines to avoid merging separate lines
  let cleanContent = content.replace(/<(br|p|div|h\d|li|tr)[^>]*>/gi, '\n');
  // Remove all other tags
  cleanContent = cleanContent.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  cleanContent = cleanContent.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  // Normalize whitespace (keep newlines for context, but collapse spaces)
  cleanContent = cleanContent.replace(/[ \t]+/g, ' ');

  const addressPatterns = [
    // Pattern 1: Explicit Label followed by address (supporting newlines)
    // Matches: "Localização: Rua X, 123" or "Endereço \n Av Y, 456"
    /(?:endere[çc]o|localiza[çc][ãa]o|situado|localizado|fica)(?:\s*:)?\s*(?:\n\s*)?((?:rua|r\.|avenida|av\.|alameda|travessa|rodovia|estrada|loteamento)\s+[^(\n]{5,150}(?:\s*,\s*\d+)?(?:[^\n]{0,100}))/im,

    // Pattern 2: Strong Address Format (Street + Number + Neighborhood/City)
    // Matches: "Rua Júlio Pinto, 2090, Jacarecanga"
    /((?:rua|r\.|avenida|av\.|alameda|travessa|rodovia)\s+[A-ZÀ-Ú][a-zà-ú]+(?:[ \t]+(?:de|do|da|dos|das|e|em)?\s*[A-ZÀ-Ú][a-zà-ú]+)+\s*,\s*\d+\s*(?:,\s*[A-ZÀ-Úa-zà-ú\s/()-]+)?)/gm,

    // Pattern 3: Generic context (Located at...)
    /(?:localizado|situado)\s+(?:no|na|em)\s+([^.\n]{10,150})/im,

    // Pattern 4: Proximity (Near...)
    /(?:pr[óo]xim[ao]|perto)\s+(?:de|do|da|a|ao)\s+([^.\n]{10,100})/im
  ];

  const potentialAddresses: { address: string; score: number }[] = [];

  for (const pattern of addressPatterns) {
    // Use matchAll or exec depending on flags
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    // For global patterns, iterate matches. For others, just single match.
    if (regex.flags.includes('g')) {
      const matches = cleanContent.matchAll(regex);
      for (const m of matches) {
        processMatch(m);
      }
    } else {
      match = regex.exec(cleanContent);
      if (match) processMatch(match);
    }

    function processMatch(m: RegExpMatchArray | RegExpExecArray) {
      let address = (m[1] || m[0]).trim();

      // Clean noise
      address = address.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '');

      // Skip if invalid
      if (address.length < 8 || address.length > 200) return;

      let score = 0;

      // SCORING RULES

      // Starts with Street Type (High Confidence)
      if (/^(rua|avenida|av\.|travessa|alameda|rodovia)/i.test(address)) score += 5;

      // Contains Number (High Confidence)
      if (/\d+/.test(address)) score += 3;

      // Contains Neighborhood/City hints
      if (/(bairro|centro|fortaleza|caucaia|eusebio|aquiraz|ceará|ce\b)/i.test(address)) score += 2;

      // Contains CEP
      if (/\d{5}-?\d{3}/.test(address)) score += 5;

      // Context Bonus (if found via "Localização" label)
      if (pattern.source.includes('localiza')) score += 4;

      // Penalties
      if (/(clique|saiba|veja|confira|visite)/i.test(address)) score -= 5; // Call to actions
      if (address.split(' ').length < 3) score -= 3; // Too short (e.g. "Rua X")

      if (score > 0) {
        potentialAddresses.push({ address, score });
      }
    }
  }

  // Return the highest scoring address
  if (potentialAddresses.length > 0) {
    potentialAddresses.sort((a, b) => b.score - a.score);
    const bestMatch = potentialAddresses[0];

    if (bestMatch.score >= 5) { // Minimum threshold
      return validateAndCleanAddress(bestMatch.address);
    }
  }

  return null;
}

function validateAndCleanAddress(address: string): string | null {
  // Additional validation and cleaning

  // Remove leading/trailing punctuation
  address = address.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '');

  // Check for common address components
  const hasStreetType = /(?:rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?|rodovia|rod\.?)/i.test(address);
  const hasNumber = /\d+/.test(address);
  const hasNeighborhood = /bairro|condom[íi]nio|residencial|vila/i.test(address);
  const isCEP = /^\d{5}-?\d{3}$/.test(address);

  // Address must have at least one quality indicator
  if (!hasStreetType && !hasNumber && !hasNeighborhood && !isCEP) {
    return null;
  }

  // Further clean common issues
  const cleanedAddress = address
    .replace(/\b(?:clique|aqui|saiba|mais|leia)\b/gi, '') // Remove web-specific terms
    .replace(/\s{2,}/g, ' ') // Fix multiple spaces
    .trim();

  return cleanedAddress.length >= 8 ? cleanedAddress : null;
}

async function fetchAddressFromPage(postLink: string): Promise<string | null> {
  if (!postLink) return null;

  try {
    const response = await fetch(postLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.warn(`⚠️ HTTP ${response.status} fetching page: ${postLink}`);
      return null;
    }

    const html = await response.text();

    // Strategy 1: Find div.text-44 after "localização" label (div.text-38)
    // Pattern: <div class="text-38">localização</div> ... <div class="text-44">ADDRESS</div>
    const localizacaoPattern = /class=["']text-38["'][^>]*>[^<]*localiza[çc][ãa]o[^<]*<\/div>\s*(?:<[^>]*>\s*)*<div[^>]*class=["']text-44["'][^>]*>(.*?)<\/div>/is;
    const match = localizacaoPattern.exec(html);
    if (match?.[1]) {
      let address = match[1].replace(/<[^>]*>/g, '').trim();
      // Decode HTML entities
      address = address
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .replace(/\s+/g, ' ')
        .trim();

      if (address.length > 5) {
        console.log(`📍 [Strategy 1] Address from text-44: "${address}"`);
        return address;
      }
    }

    // Strategy 2: Extract address from Google Maps iframe URL
    // The URL contains the address encoded as: !2sEncoded%20Address!5e
    const iframePattern = /google\.com\/maps\/embed\?pb=[^"']*!2s([^!]+)!5e/i;
    const iframeMatch = iframePattern.exec(html);
    if (iframeMatch?.[1]) {
      try {
        const decoded = decodeURIComponent(iframeMatch[1]);
        if (decoded.length > 5) {
          console.log(`📍 [Strategy 2] Address from Maps iframe: "${decoded}"`);
          return decoded;
        }
      } catch {
        // decodeURIComponent can throw on malformed URIs
      }
    }

    // Strategy 3: Look for any div with "text-44" class containing address-like text
    const anyText44Pattern = /<div[^>]*class=["']text-44["'][^>]*>(.*?)<\/div>/gis;
    let text44Match;
    while ((text44Match = anyText44Pattern.exec(html)) !== null) {
      let candidate = text44Match[1].replace(/<[^>]*>/g, '').trim();
      candidate = candidate.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      // Check if it looks like an address (contains street type or number)
      if (candidate.length > 10 && /(?:rua|r\.|avenida|av\.|alameda|travessa|rodovia|estrada|loteamento|\d+)/i.test(candidate)) {
        console.log(`📍 [Strategy 3] Address from text-44 fallback: "${candidate}"`);
        return candidate;
      }
    }

    console.log(`⚠️ No address found in page HTML for: ${postLink}`);
    return null;
  } catch (error: any) {
    console.warn(`⚠️ Error fetching page ${postLink}: ${error.message}`);
    return null;
  }
}

async function findOrCreateConstructoraEnhanced(post: WordPressPost, supabase: any): Promise<string | null> {
  const content = `${post.title.rendered} ${post.content.rendered}`;

  // PRIORITY 1: Extract from class_list (most reliable source)
  if (post.class_list && Array.isArray(post.class_list)) {
    for (const className of post.class_list) {
      if (className.startsWith('anunciantes-')) {
        const construtoraSlug = className.replace('anunciantes-', '');

        // PHASE 3: Comprehensive construtora mapping with major Brazilian developers
        const construtoraMap: { [key: string]: string } = {
          // Major National Developers
          'cyrela': 'Cyrela Brazil Realty',
          'mrv': 'MRV Engenharia e Participações',
          'direcional': 'Direcional Engenharia',
          'tecnisa': 'Tecnisa',
          'rossi': 'Rossi Residencial',
          'gafisa': 'Gafisa',
          'pdg': 'PDG Realty',
          'even': 'Even Construtora',
          'eztec': 'Eztec Empreendimentos',
          'brookfield': 'Brookfield Incorporações',
          'rodobens': 'Rodobens Negócios Imobiliários',
          'patrimar': 'Patrimar Engenharia',
          'viver': 'Viver Incorporadora',
          'tenda': 'Tenda',
          'construtora-tenda': 'Tenda',

          // Regional CE Developers
          'engeplan': 'Engeplan Engenharia',
          'moura-dubeux': 'Moura Dubeux Engenharia',
          'bld-urbanismo': 'BLD Urbanismo',
          'diagonal': 'Diagonal Empreendimentos',
          'mota-machado': 'Mota Machado',
          'terra-brasilis': 'Terra Brasilis',
          'newland': 'Newland Empreendimentos',
          'goldsztein': 'Goldsztein Cyrela',
          'mont-blanc': 'Mont Blanc Incorporações',
          'standard': 'Standard Empreendimentos',
          'jockey': 'Jockey Empreendimentos',
          'urbana': 'Urbana Empreendimentos',
          'bairro-novo': 'Bairro Novo Empreendimentos',
          'emccamp': 'Emccamp',
          'colmeia': 'Colmeia Empreendimentos',
          'terra-nova': 'Terra Nova Empreendimentos',
          'habitat': 'Habitat Empreendimentos',
          'absoluto': 'Absoluto Incorporações',
          'dimensao': 'Dimensão Engenharia',
          'sousa-neto': 'Sousa Neto Empreendimentos',
          'construtora-sucesso': 'Construtora Sucesso',
          'rb-engenharia': 'RB Engenharia'
        };

        const construtoraName = construtoraMap[construtoraSlug] ||
          construtoraSlug.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');

        // Check if construtora exists
        const { data: existing } = await supabase
          .from('construtoras')
          .select('id, nome')
          .ilike('nome', `%${construtoraName}%`)
          .maybeSingle();

        if (existing) {
          return existing.id;
        }

        // Create new construtora
        const { data: newConstrutora, error } = await supabase
          .from('construtoras')
          .insert({ nome: construtoraName, ativo: true })
          .select('id')
          .single();

        if (!error && newConstrutora) {
          console.log(`🏢 Nova construtora criada: ${construtoraName}`);
          return newConstrutora.id;
        }
      }
    }
  }

  // PRIORITY 2: Enhanced content analysis with scoring system
  const categoryNames = post.categories.map(catId => {
    const category = categoriesCache.get(catId);
    return category?.name || '';
  }).join(' ');

  const fullContent = `${content} ${categoryNames}`.toLowerCase();

  // PHASE 3: Comprehensive construtora identification with AI-like scoring
  const construtoraDatabase = [
    // National Major Developers (high confidence patterns)
    { names: ['cyrela', 'cyrela brazil', 'cyrela brazil realty'], score: 10 },
    { names: ['mrv', 'mrv engenharia', 'mrv participações'], score: 10 },
    { names: ['direcional', 'direcional engenharia'], score: 9 },
    { names: ['tecnisa'], score: 9 },
    { names: ['rossi', 'rossi residencial'], score: 9 },
    { names: ['gafisa'], score: 9 },
    { names: ['pdg', 'pdg realty'], score: 8 },
    { names: ['even', 'even construtora'], score: 8 },
    { names: ['eztec', 'eztec empreendimentos'], score: 8 },
    { names: ['brookfield', 'brookfield incorporações'], score: 8 },
    { names: ['rodobens', 'rodobens negócios'], score: 7 },
    { names: ['patrimar', 'patrimar engenharia'], score: 7 },
    { names: ['viver', 'viver incorporadora'], score: 7 },
    { names: ['tenda', 'construtora tenda'], score: 7 },

    // Regional CE Developers (medium to high confidence)
    { names: ['engeplan', 'engeplan engenharia'], score: 9 },
    { names: ['moura dubeux', 'moura-dubeux'], score: 9 },
    { names: ['bld', 'bld urbanismo'], score: 8 },
    { names: ['diagonal', 'diagonal empreendimentos'], score: 8 },
    { names: ['mota machado'], score: 8 },
    { names: ['terra brasilis'], score: 7 },
    { names: ['newland', 'newland empreendimentos'], score: 7 },
    { names: ['goldsztein', 'goldsztein cyrela'], score: 7 },
    { names: ['mont blanc', 'mont blanc incorporações'], score: 6 },
    { names: ['standard', 'standard empreendimentos'], score: 6 },
    { names: ['jockey', 'jockey empreendimentos'], score: 6 },
    { names: ['urbana', 'urbana empreendimentos'], score: 6 },
    { names: ['bairro novo', 'bairro novo empreendimentos'], score: 6 },
    { names: ['emccamp'], score: 6 },
    { names: ['colmeia', 'colmeia empreendimentos'], score: 5 },
    { names: ['terra nova', 'terra nova empreendimentos'], score: 5 },
    { names: ['habitat', 'habitat empreendimentos'], score: 5 },
    { names: ['absoluto', 'absoluto incorporações'], score: 5 },
    { names: ['dimensão', 'dimensao', 'dimensão engenharia'], score: 5 },
    { names: ['sousa neto', 'sousa neto empreendimentos'], score: 5 },
    { names: ['construtora sucesso'], score: 4 },
    { names: ['rb engenharia'], score: 4 }
  ];

  // Score-based matching
  const candidateConstructors: { name: string; score: number }[] = [];

  for (const construtora of construtoraDatabase) {
    for (const name of construtora.names) {
      const pattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (pattern.test(fullContent)) {
        candidateConstructors.push({
          name: construtora.names[0], // Use primary name
          score: construtora.score
        });
        break; // Found a match for this construtora, move to next
      }
    }
  }

  // PRIORITY 3: Generic pattern matching (lower scores)
  const genericPatterns = [
    { pattern: /(construtora|incorporadora|grupo)\s+([a-z][a-z\s]+)/gi, scoreBonus: 2 },
    { pattern: /([a-z][a-z\s]+)\s+(empreendimentos|engenharia|incorporações)/gi, scoreBonus: 3 },
    { pattern: /construção\s+([a-z][a-z\s]+)/gi, scoreBonus: 1 },
    { pattern: /desenvolvimento\s+([a-z][a-z\s]+)/gi, scoreBonus: 1 }
  ];

  for (const patternData of genericPatterns) {
    const matches = Array.from(fullContent.matchAll(patternData.pattern));

    for (const match of matches) {
      let construtoraName = (match[2] || match[1])?.trim();

      if (construtoraName && construtoraName.length >= 3 && construtoraName.length <= 50) {
        // Clean and format the name
        construtoraName = construtoraName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Check if it's not already a candidate with higher score
        const existingCandidate = candidateConstructors.find(c =>
          c.name.toLowerCase().includes(construtoraName.toLowerCase()) ||
          construtoraName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (!existingCandidate) {
          candidateConstructors.push({
            name: construtoraName,
            score: patternData.scoreBonus
          });
        }
      }
    }
  }

  // Select the best candidate (highest score, minimum threshold)
  if (candidateConstructors.length > 0) {
    candidateConstructors.sort((a, b) => b.score - a.score);
    const bestCandidate = candidateConstructors[0];

    // Only proceed with candidates that have minimum confidence
    if (bestCandidate.score >= 4) {
      // Format the name properly
      const construtoraName = bestCandidate.name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Check if construtora exists (more flexible matching)
      const searchTerms = [
        construtoraName,
        construtoraName.split(' ')[0], // First word
        construtoraName.split(' ').slice(0, 2).join(' ') // First two words
      ];

      for (const searchTerm of searchTerms) {
        const { data: existing } = await supabase
          .from('construtoras')
          .select('id, nome')
          .ilike('nome', `%${searchTerm}%`)
          .maybeSingle();

        if (existing) {
          console.log(`🏢 Construtora encontrada: ${existing.nome} (busca: ${searchTerm})`);
          return existing.id;
        }
      }

      // Create new construtora if not found
      const { data: newConstrutora, error } = await supabase
        .from('construtoras')
        .insert({
          nome: construtoraName,
          ativo: true,
          descricao: `Identificada automaticamente do post: ${post.title.rendered.substring(0, 100)}`
        })
        .select('id')
        .single();

      if (!error && newConstrutora) {
        console.log(`🏢 Nova construtora criada: ${construtoraName} (score: ${bestCandidate.score})`);
        return newConstrutora.id;
      }
    }
  }

  return null;
}

async function findOrCreateBairroEnhanced(post: WordPressPost, supabase: any): Promise<string | null> {
  const content = `${post.title.rendered} ${post.content.rendered}`;

  // PRIORITY 1: Extract from class_list categories (most reliable)
  if (post.class_list && Array.isArray(post.class_list)) {
    for (const className of post.class_list) {
      if (className.startsWith('category-')) {
        const bairroSlug = className.replace('category-', '');

        // Map slugs to proper neighborhood names
        const bairroMap: { [key: string]: string } = {
          'aldeota': 'Aldeota',
          'meireles': 'Meireles',
          'coco': 'Cocó',
          'dionisio-torres': 'Dionísio Torres',
          'papicu': 'Papicu',
          'varjota': 'Varjota',
          'praia-de-iracema': 'Praia de Iracema',
          'centro': 'Centro',
          'benfica': 'Benfica',
          'fatima': 'Fátima',
          'joaquim-tavora': 'Joaquim Távora',
          'mucuripe': 'Mucuripe',
          'praia-do-futuro': 'Praia do Futuro',
          'cambeba': 'Cambeba',
          'edson-queiroz': 'Edson Queiroz',
          'guararapes': 'Guararapes',
          'maraponga': 'Maraponga',
          'cidade-dos-funcionarios': 'Cidade dos Funcionários',
          'jose-bonifacio': 'José Bonifácio',
          'montese': 'Montese',
          'parangaba': 'Parangaba',
          'antonio-bezerra': 'Antônio Bezerra',
          'vila-olimpica': 'Vila Olímpica',
          'agua-fria': 'Água Fria',
          'parquelandia': 'Parquelândia',
          'rodolfo-teofilo': 'Rodolfo Teófilo',
          'damas': 'Damas',
          'bom-futuro': 'Bom Futuro',
          'passare': 'Passaré',
          'sabiaguaba': 'Sabiaguaba',
          'porto-das-dunas': 'Porto das Dunas',
          'messejana': 'Messejana',
          'lagoa-redonda': 'Lagoa Redonda',
          'sapiranga': 'Sapiranga',
          'coacu': 'Coaçu',
          'engenheiro-luciano-cavalcante': 'Engenheiro Luciano Cavalcante',
          'salinas': 'Salinas',
          'dunas': 'Dunas',
          'cidade-2000': 'Cidade 2000',
          'jurema': 'Jurema' // For Caucaia
        };

        const bairroName = bairroMap[bairroSlug] ||
          bairroSlug.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');

        // Determine city based on known neighborhoods
        let cidade = 'Fortaleza';
        if (['Jurema'].includes(bairroName)) {
          cidade = 'Caucaia';
        }

        // Check if bairro exists
        const { data: existing } = await supabase
          .from('bairros')
          .select('id')
          .eq('nome', bairroName)
          .eq('cidade', cidade)
          .eq('estado', 'CE')
          .maybeSingle();

        if (existing) {
          return existing.id;
        }

        // Create new bairro
        const { data: newBairro, error } = await supabase
          .from('bairros')
          .insert({
            nome: bairroName,
            cidade: cidade,
            estado: 'CE',
            ativo: true
          })
          .select('id')
          .single();

        if (!error && newBairro) {
          console.log(`🏘️ Novo bairro criado: ${bairroName} - ${cidade}`);
          return newBairro.id;
        }
      }
    }
  }

  // PRIORITY 2: Get category names from API
  const categoryNames = post.categories.map(catId => {
    const category = categoriesCache.get(catId);
    return category?.name || '';
  }).join(' ');

  const fullContent = `${content} ${categoryNames}`;

  // PRIORITY 3: Enhanced neighborhoods list with more comprehensive mapping
  const bairrosFortaleza = [
    'Aldeota', 'Meireles', 'Cocó', 'Dionísio Torres', 'Papicu', 'Varjota',
    'Praia de Iracema', 'Centro', 'Benfica', 'Fátima', 'Joaquim Távora',
    'Mucuripe', 'Praia do Futuro', 'Cambeba', 'Edson Queiroz', 'Guararapes',
    'Maraponga', 'Cidade dos Funcionários', 'José Bonifácio', 'Montese',
    'Parangaba', 'Antônio Bezerra', 'Vila Olímpica', 'Água Fria', 'Parquelândia',
    'Rodolfo Teófilo', 'Damas', 'Bom Futuro', 'Passaré', 'Sabiaguaba',
    'Porto das Dunas', 'Messejana', 'Lagoa Redonda', 'Sapiranga', 'Coaçu',
    'Engenheiro Luciano Cavalcante', 'Salinas', 'Dunas', 'Cidade 2000',
    'Eusébio', 'Aquiraz', 'Vila Velha', 'Prefeito José Walter', 'Jangurussu',
    'Barroso', 'Granja Portugal', 'Granja Lisboa', 'Castelão', 'Itaperi'
  ];

  const bairrosCaucaia = ['Jurema', 'Cumbuco', 'Icaraí', 'Tabuba'];

  // Try exact matches for Fortaleza
  for (const bairroName of bairrosFortaleza) {
    const regex = new RegExp(`\\b${bairroName}\\b`, 'i');

    if (regex.test(fullContent)) {
      // Check if bairro exists
      const { data: existing } = await supabase
        .from('bairros')
        .select('id')
        .eq('nome', bairroName)
        .eq('cidade', 'Fortaleza')
        .eq('estado', 'CE')
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Create new bairro
      const { data: newBairro, error } = await supabase
        .from('bairros')
        .insert({
          nome: bairroName,
          cidade: 'Fortaleza',
          estado: 'CE',
          ativo: true
        })
        .select('id')
        .single();

      if (!error && newBairro) {
        console.log(`🏘️ Novo bairro criado: ${bairroName} - Fortaleza`);
        return newBairro.id;
      }
    }
  }

  // Try exact matches for Caucaia
  for (const bairroName of bairrosCaucaia) {
    const regex = new RegExp(`\\b${bairroName}\\b`, 'i');

    if (regex.test(fullContent)) {
      // Check if bairro exists
      const { data: existing } = await supabase
        .from('bairros')
        .select('id')
        .eq('nome', bairroName)
        .eq('cidade', 'Caucaia')
        .eq('estado', 'CE')
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Create new bairro
      const { data: newBairro, error } = await supabase
        .from('bairros')
        .insert({
          nome: bairroName,
          cidade: 'Caucaia',
          estado: 'CE',
          ativo: true
        })
        .select('id')
        .single();

      if (!error && newBairro) {
        console.log(`🏘️ Novo bairro criado: ${bairroName} - Caucaia`);
        return newBairro.id;
      }
    }
  }

  return null;
}

async function savePerformanceMetrics(
  supabase: any,
  performanceMetrics: PerformanceMetric[],
  syncLogId: string
) {
  try {
    const metricsData = performanceMetrics.map(metric => ({
      sync_log_id: syncLogId,
      operation_type: metric.operationType,
      operation_start: metric.operationStart,
      operation_end: new Date().toISOString(),
      duration_ms: metric.metadata?.duration || null,
      post_id: metric.postId || null,
      empreendimento_id: metric.empreendimentoId || null,
      success: metric.metadata?.success !== false,
      error_message: metric.metadata?.error || null,
      metadata: metric.metadata
    }));

    const { error } = await supabase
      .from('wp_sync_performance')
      .insert(metricsData);

    if (error) {
      console.error('❌ Erro ao salvar métricas de performance:', error);
    } else {
      console.log(`📈 Salvado ${metricsData.length} métricas de performance`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar métricas:', error);
  }
}

async function logSyncResults(
  supabase: any,
  stats: SyncStats,
  syncDuration: number,
  errors: string[],
  syncLogId: string | null,
  status: 'success' | 'partial' | 'error' = 'success'
) {
  if (errors.length > 0 && status === 'success') {
    status = 'partial';
  }

  const logData = {
    total_posts_fetched: stats.totalPostsFetched,
    new_empreendimentos: stats.newEmpreendimentos,
    updated_empreendimentos: stats.updatedEmpreendimentos,
    errors_count: stats.errorsCount,
    sync_duration_ms: syncDuration,
    last_wp_post_id: stats.lastWpPostId,
    status,
    error_details: errors.length > 0 ? { errors } : null
  };

  try {
    if (syncLogId) {
      // Update existing log
      const { error } = await supabase
        .from('wp_sync_log')
        .update(logData)
        .eq('id', syncLogId);

      if (error) {
        console.error('❌ Erro ao atualizar log da sincronização:', error);
      } else {
        console.log('📝 Log da sincronização atualizado com sucesso');
      }
    } else {
      // Create new log
      const { error } = await supabase
        .from('wp_sync_log')
        .insert(logData);

      if (error) {
        console.error('❌ Erro ao criar log da sincronização:', error);
      } else {
        console.log('📝 Log da sincronização criado com sucesso');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar log:', error);
  }
}