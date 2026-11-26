// MeMude Conversas — IA que lê as conversas e ATUALIZA a ficha do cliente sozinha (o corretor não preenche nada).
// Travas: só o que o cliente disse (com o trecho como evidência), nunca sobre o que uma pessoa preencheu, status só para
// frente até INTERESSADO, etapa só para frente; mudanças graves (desistiu, sem renda, vendido, perdido) viram sugestão +
// alerta para o closer confirmar. Tudo pode ser desfeito na ficha do lead (ia_mudanca_desfazer).
// Roda pelo pg_cron a cada minuto (x-internal-secret). Em cada rodada:
//   1) transcreve áudios novos;
//   2) analisa conversas paradas há 60 s: resumo, o que falta, temperatura, ficha e etapa (aplicadas), sugestões (resposta,
//      lembrete, imóveis que combinam) e alertas (sinal de compra, contato pessoal fora do número da MeMude).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, json, preflight, responderErro } from '../_shared/fase1-http.ts';
import { BUCKET, ENTRADAS, ETAPAS, FINALIDADES, PRAZOS, RENDAS, STATUS_CRM } from '../_shared/conversas.ts';

const OPENAI = 'https://api.openai.com/v1';
const MODELO = 'gpt-4o-mini';
const FUSO = 'America/Fortaleza';
// Visita marcada e Visitou andam sozinhas (aceite do corretor e resultado da visita); a IA não sugere essas duas.
const ETAPAS_IA = ETAPAS.filter((e) => !['novo', 'visita_marcada', 'visitou'].includes(e));
// Etapas que a IA move sozinha (só para frente). Vendido e Perdido pedem a confirmação do closer.
const ETAPAS_AUTO = ['em_atendimento', 'proposta', 'documentacao'];
const ETAPAS_GRAVES = ['vendido', 'perdido'];
const CAMPOS_FICHA: Record<string, string> = {
  status_atendimento: 'status', renda: 'renda', entrada_fgts: 'entrada/FGTS', prazo: 'prazo', finalidade: 'finalidade', regiao: 'região',
};
const ROTULO_ETAPA: Record<string, string> = {
  novo: 'Novo', em_atendimento: 'Em atendimento', visita_marcada: 'Visita marcada', visitou: 'Visitou', proposta: 'Proposta',
  documentacao: 'Documentação', vendido: 'Vendido', perdido: 'Perdido',
};
// Telefone no texto de quem atende (tentativa de levar o cliente para o número pessoal)
const TELEFONE_NO_TEXTO = /(\(?\b\d{2}\)?[\s.-]?)?\b9?\d{4}[\s.-]?\d{4}\b/;
const PEDIDO_PESSOAL = /(meu (whats|zap|n[uú]mero|celular|pessoal)|me chama no|chama no meu|salva (meu|o meu))/i;

async function chaveOpenAI(db: SupabaseClient) {
  const env = Deno.env.get('OPENAI_API_KEY');
  if (env) return env;
  const { data } = await db.from('system_settings').select('value').eq('key', 'openai_api_key').maybeSingle();
  return data?.value ? String(data.value) : null;
}

async function transcrever(db: SupabaseClient, chave: string) {
  const { data: audios } = await db.from('mensagens').select('id, conversa_id, midia_path, midia_mime')
    .eq('tipo', 'audio').is('transcricao', null).not('midia_path', 'is', null)
    .gte('criado_em', new Date(Date.now() - 86_400_000).toISOString()).order('criado_em').limit(8);
  for (const a of audios ?? []) {
    try {
      const arq = await db.storage.from(BUCKET).download(a.midia_path!);
      if (arq.error || !arq.data) throw new Error('arquivo');
      if (arq.data.size > 24 * 1024 * 1024) throw new Error('grande');
      const form = new FormData();
      const ext = a.midia_path!.split('.').pop() ?? 'ogg';
      form.append('file', new File([arq.data], `audio.${ext}`, { type: a.midia_mime ?? 'audio/ogg' }));
      form.append('model', 'gpt-4o-mini-transcribe');
      form.append('language', 'pt');
      const r = await fetch(`${OPENAI}/audio/transcriptions`, {
        method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: form, signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) throw new Error(`openai ${r.status}`);
      const { text } = await r.json() as { text?: string };
      await db.from('mensagens').update({ transcricao: (text ?? '').trim().slice(0, 8000) }).eq('id', a.id);
      // a conversa entra de novo na fila para a IA considerar o que foi dito
      await db.from('conversas').update({ ia_pendente_desde: new Date().toISOString() }).eq('id', a.conversa_id);
    } catch (err) {
      console.warn('transcrição falhou', a.id, (err as Error).message);
      await db.from('mensagens').update({ transcricao: '' }).eq('id', a.id); // não tenta para sempre
    }
  }
}

const nulo = (tipos: string[] | string) => ({ type: [...(Array.isArray(tipos) ? tipos : [tipos]), 'null'] });
const enumNulo = (valores: string[]) => ({ type: ['string', 'null'], enum: [...valores, null] });

const ESQUEMA = {
  name: 'analise_conversa',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['resumo', 'falta', 'temperatura', 'etapa', 'status_crm', 'qualificacao', 'evidencias', 'resposta', 'lembrete', 'busca_imovel',
      'sinal_compra', 'contato_pessoal'],
    properties: {
      resumo: { type: 'string', description: 'Até 2 frases: quem é o cliente, o que busca e em que pé está.' },
      falta: { ...nulo('string'), description: 'O que falta para a venda avançar (1 frase curta) ou null.' },
      temperatura: { type: 'string', enum: ['quente', 'morno', 'frio'] },
      etapa: enumNulo(ETAPAS_IA),
      status_crm: enumNulo(STATUS_CRM),
      qualificacao: {
        type: 'object', additionalProperties: false, required: ['renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao'],
        properties: {
          renda: enumNulo(RENDAS), entrada_fgts: enumNulo(ENTRADAS), prazo: enumNulo(PRAZOS), finalidade: enumNulo(FINALIDADES),
          regiao: nulo('string'),
        },
      },
      evidencias: {
        type: 'object', additionalProperties: false,
        required: ['renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao', 'status_crm', 'etapa'],
        properties: Object.fromEntries(['renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao', 'status_crm', 'etapa']
          .map((k) => [k, { ...nulo('string'), description: 'Trecho literal curto da conversa que comprova (até 120 caracteres) ou null.' }])),
      },
      resposta: nulo('string'),
      lembrete: {
        type: ['object', 'null'], additionalProperties: false, required: ['atividade', 'quando'],
        properties: { atividade: { type: 'string' }, quando: { type: 'string', description: 'Data e hora ISO 8601 com fuso -03:00' } },
      },
      busca_imovel: nulo('string'),
      sinal_compra: { type: 'object', additionalProperties: false, required: ['ha', 'motivo'], properties: { ha: { type: 'boolean' }, motivo: { type: 'string' } } },
      contato_pessoal: { type: 'object', additionalProperties: false, required: ['ha', 'motivo'], properties: { ha: { type: 'boolean' }, motivo: { type: 'string' } } },
    },
  },
};

interface Analise {
  resumo: string; falta: string | null; temperatura: 'quente' | 'morno' | 'frio'; etapa: string | null; status_crm: string | null;
  qualificacao: Record<string, string | null>; evidencias: Record<string, string | null>; resposta: string | null; lembrete: { atividade: string; quando: string } | null;
  busca_imovel: string | null; sinal_compra: { ha: boolean; motivo: string }; contato_pessoal: { ha: boolean; motivo: string };
}

interface Conversa { id: string; lead_id: string | null; etapa: string; dono_id: string | null; dono_papel: string; nome_contato: string | null; telefone: string }

const agora = () => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function instrucoes() {
  return [
    'Você é assistente de uma equipe de vendas de imóveis na planta em Fortaleza (MeMude). Lê a conversa de WhatsApp e mantém a ficha do',
    'cliente no CRM em dia: o que você preencher é gravado automaticamente, por isso a precisão vale mais que a quantidade.',
    `Agora: ${agora()} (horário de Fortaleza).`,
    'Regras:',
    '- Use somente o que está escrito na conversa. Nunca invente renda, prazo ou interesse. Na dúvida, null.',
    '- "resumo": só fatos confirmados. Cliente pedir ou sugerir visita NÃO é visita agendada; diga "quer visitar". Não repita o nome do cliente.',
    '- "etapa": só sugira se a conversa mostra claramente que a etapa atual ficou para trás; senão null. Significados:',
    '  em_atendimento = conversando; proposta = proposta ou simulação enviada, em negociação; documentacao = cliente enviando documentos;',
    '  vendido = assinou/fechou; perdido = cliente desistiu claramente. (Visita marcada e visitou o sistema registra sozinho.)',
    '- "status_crm": só se mudou claramente em relação ao status atual; senão null. INTERESSADO = demonstrou interesse real em um imóvel;',
    '  VISITA AGENDADA só com visita confirmada; SEM RENDA = renda insuficiente declarada; NÃO INTERESSADO = recusou.',
    '- "qualificacao": preencha só os campos que o cliente informou e que diferem da ficha atual; o resto null.',
    '  entrada_fgts: "Tem entrada" (só entrada), "Entrada + FGTS" (tem os dois), "Só FGTS", "Ainda não tem". renda = renda familiar mensal.',
    '- "evidencias": para cada campo de qualificacao, status_crm e etapa que você preencheu, copie o trecho exato da conversa que comprova',
    '  (até 120 caracteres, sem inventar). Campo sem trecho que comprove deve ficar null também na qualificacao/status/etapa.',
    '- "falta": o próximo passo concreto para a venda avançar (ex.: "enviar simulação", "cliente mandar documentos", "marcar visita").',
    '- "resposta": se a última mensagem é do cliente, escreva a próxima resposta da equipe: curta (até 3 linhas), calorosa, natural, em português',
    '  do Brasil, avançando a conversa (ex.: propor horários de visita, pedir a informação que falta). Não prometa preço, condição ou aprovação',
    '  de crédito; no máximo 1 emoji; não assine. Se a última mensagem é da equipe, null.',
    '- "lembrete": só quando alguém da equipe prometeu fazer algo numa data ("te ligo amanhã às 10h", "envio a tabela segunda") ou o cliente',
    '  pediu contato numa data. Não crie lembrete para a visita em si (a visita é agendada na agenda do Connect). "quando" no fuso -03:00.',
    '- "busca_imovel": descreva o imóvel que o cliente procura (bairro, quartos, faixa de preço) se ele disse; senão null.',
    '- "sinal_compra": true se o cliente demonstrou intenção forte (pediu proposta, simulação, documentação, reserva, "quero fechar").',
    '- "contato_pessoal": true se quem atende pediu para o cliente falar em outro número/WhatsApp pessoal ou passou contato pessoal.',
  ].join('\n');
}

async function analisar(db: SupabaseClient, chave: string, c: Conversa) {
  const [{ data: msgs }, { data: lead }] = await Promise.all([
    db.from('mensagens').select('direcao, tipo, texto, transcricao, autor_nome, origem, criado_em')
      .eq('conversa_id', c.id).neq('tipo', 'reacao').order('criado_em', { ascending: false }).limit(40),
    c.lead_id
      ? db.from('leads').select('nome, status_atendimento, qualificacao, empreendimentos(nome)').eq('id', c.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const linhas = [...(msgs ?? [])].reverse().map((m) => {
    const quem = m.direcao === 'entrada' ? 'CLIENTE' : m.direcao === 'nota' ? `NOTA INTERNA (${m.autor_nome ?? 'equipe'})` : `EQUIPE (${m.autor_nome ?? 'celular'})`;
    const conteudo = m.texto ?? (m.transcricao ? `[áudio] ${m.transcricao}` : `[${m.tipo}]`);
    return `${hora(m.criado_em)} ${quem}: ${conteudo}`.slice(0, 1200);
  });
  if (!linhas.length) return null;
  const ultima = (msgs ?? []).find((m) => m.direcao !== 'nota');
  const ficha = lead
    ? `Ficha atual — nome: ${lead.nome}; status: ${lead.status_atendimento ?? '—'}; empreendimento: ${(lead.empreendimentos as { nome?: string } | null)?.nome ?? '—'}; qualificação: ${JSON.stringify(lead.qualificacao ?? {})}`
    : 'Sem ficha no CRM.';

  const r = await fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: MODELO, temperature: 0.2, max_tokens: 700,
      response_format: { type: 'json_schema', json_schema: ESQUEMA },
      messages: [
        { role: 'system', content: instrucoes() },
        { role: 'user', content: `Etapa atual da conversa: ${c.etapa}. ${ficha}\n\nConversa (mais antiga primeiro):\n${linhas.join('\n')}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const corpo = await r.json() as { choices?: Array<{ message?: { content?: string; refusal?: string } }> };
  const txt = corpo.choices?.[0]?.message?.content;
  if (!txt) return null;
  return { a: JSON.parse(txt) as Analise, lead, clienteEsperando: ultima?.direcao === 'entrada', msgs: msgs ?? [] };
}

async function embedding(chave: string, texto: string) {
  const r = await fetch(`${OPENAI}/embeddings`, {
    method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texto.slice(0, 2000) }), signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`embedding ${r.status}`);
  const j = await r.json() as { data: Array<{ embedding: number[] }> };
  return j.data[0].embedding;
}

async function sugerir(db: SupabaseClient, c: Conversa, tipo: string, titulo: string, conteudo: Record<string, unknown>) {
  await db.from('ia_sugestoes').update({ status: 'substituida' }).eq('conversa_id', c.id).eq('tipo', tipo).eq('status', 'aberta');
  await db.from('ia_sugestoes').insert({ conversa_id: c.id, lead_id: c.lead_id, tipo, titulo: titulo.slice(0, 160), conteudo });
}

async function alertar(db: SupabaseClient, c: Conversa, tipo: 'sinal_compra' | 'contato_pessoal', titulo: string, detalhe: string) {
  const { error } = await db.from('conv_alertas').insert({
    tipo, conversa_id: c.id, lead_id: c.lead_id, responsavel_id: c.dono_id, titulo: titulo.slice(0, 160), detalhe: detalhe.slice(0, 400),
  });
  if (error && error.code !== '23505') throw error; // já existe um aberto igual
}

async function aplicar(db: SupabaseClient, chave: string, c: Conversa, res: NonNullable<Awaited<ReturnType<typeof analisar>>>) {
  const { a, lead } = res;
  let imoveis = 0;
  let erroImoveis: string | null = null;
  const nome = lead?.nome ?? c.nome_contato ?? c.telefone;
  // Prova vazia, "null" escrito por extenso ou só aspas não vale como prova
  const ev: Record<string, string | null> = Object.fromEntries(Object.entries(a.evidencias ?? {}).map(([k, v]) => {
    const t = typeof v === 'string' ? v.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim() : '';
    return [k, t && t.toLowerCase() !== 'null' ? t.slice(0, 300) : null];
  }));
  await db.from('conversas').update({
    resumo_ia: a.resumo.slice(0, 600), temperatura: a.temperatura, ia_falta: a.falta ? a.falta.slice(0, 200) : null,
  }).eq('id', c.id);
  const closer = async () => (await db.from('fase1_config').select('closer_user_id').eq('id', true).maybeSingle()).data?.closer_user_id ?? null;
  const confirmar = async (titulo: string, detalhe: string) => {
    const { error } = await db.from('conv_alertas').insert({
      tipo: 'confirmar_ia', conversa_id: c.id, lead_id: c.lead_id, responsavel_id: await closer(),
      titulo: titulo.slice(0, 160), detalhe: detalhe.slice(0, 400),
    });
    if (error && error.code !== '23505') throw error; // já existe um aberto para esta conversa
  };
  let ficha: { aplicados: { campo: string }[]; conferir: Record<string, string>; grave: string | null } | null = null;

  if (c.lead_id && lead) {
    // Só entra o que tem trecho da conversa que comprova
    const qualificacao = Object.fromEntries(Object.entries(a.qualificacao ?? {}).filter(([k, v]) => v && ev[k]));
    const status = a.status_crm && ev.status_crm ? a.status_crm : null;
    if (Object.keys(qualificacao).length || status) {
      const { data, error } = await db.rpc('ia_aplicar_ficha', {
        p_conversa: c.id, p_lead: c.lead_id, p_status: status, p_qualificacao: qualificacao, p_evidencias: ev,
      });
      if (error) throw error;
      ficha = data as typeof ficha;
      const conferir = ficha?.conferir ?? {};
      if (Object.keys(conferir).length || ficha?.grave) {
        const partes = [ficha?.grave ? `status ${ficha.grave}` : null, ...Object.values(conferir)].filter(Boolean);
        await sugerir(db, c, 'crm', `Conferir ficha: ${partes.join(' · ')}`, {
          ...(ficha?.grave ? { status_atendimento: ficha.grave } : {}), ...(Object.keys(conferir).length ? { qualificacao: conferir } : {}),
        });
      }
      if (ficha?.grave) {
        await confirmar(`${nome}: a IA entendeu ${ficha.grave === 'SEM RENDA' ? 'que a renda não basta' : 'que o cliente não tem interesse'}`,
          ev.status_crm ? `"${ev.status_crm}"` : 'Confira na conversa');
      }
    }
  }
  if (a.etapa && a.etapa !== c.etapa && ETAPAS_IA.includes(a.etapa) && ev.etapa) {
    const frente = ETAPAS.indexOf(a.etapa) > ETAPAS.indexOf(c.etapa) && !ETAPAS_GRAVES.includes(c.etapa);
    if (ETAPAS_AUTO.includes(a.etapa) && frente) {
      await db.from('conversas').update({ etapa: a.etapa }).eq('id', c.id).eq('etapa', c.etapa);
      if (c.lead_id) {
        await db.from('lead_eventos').insert({
          lead_id: c.lead_id, tipo: 'alteracao', campo: 'Etapa da conversa', de: ROTULO_ETAPA[c.etapa] ?? c.etapa, para: ROTULO_ETAPA[a.etapa],
          observacao: `Atualizado pela IA a partir da conversa: "${String(ev.etapa).slice(0, 200)}"`,
        });
      }
    } else {
      await sugerir(db, c, 'etapa', `Mover para ${ROTULO_ETAPA[a.etapa]}`, { etapa: a.etapa });
      if (ETAPAS_GRAVES.includes(a.etapa)) {
        await confirmar(`${nome}: a IA entendeu que ${a.etapa === 'vendido' ? 'a venda fechou' : 'o cliente desistiu'}`,
          `"${String(ev.etapa).slice(0, 300)}"`);
      }
    }
  }
  if (a.resposta && res.clienteEsperando) await sugerir(db, c, 'resposta', 'Resposta sugerida', { texto: a.resposta.slice(0, 1000) });
  if (a.lembrete?.atividade && c.lead_id) {
    const quando = new Date(a.lembrete.quando);
    if (!Number.isNaN(quando.getTime()) && quando.getTime() > Date.now() - 3600_000) {
      await sugerir(db, c, 'lembrete', `Lembrete: ${a.lembrete.atividade}`, { atividade: a.lembrete.atividade.slice(0, 200), quando: quando.toISOString() });
    }
  }
  if (a.busca_imovel) {
    try {
      const vetor = await embedding(chave, a.busca_imovel);
      // Bairro citado pelo cliente vira filtro exato; a similaridade só ordena dentro dele
      const regiao = String(a.qualificacao?.regiao ?? (lead?.qualificacao as { regiao?: string } | null)?.regiao ?? '').split(/[,;/]| e /)[0]?.trim();
      const { data: bairro } = regiao && regiao.length >= 3
        ? await db.from('bairros').select('id').ilike('nome', regiao).limit(1).maybeSingle()
        : { data: null };
      const { data: itens, error: eMatch } = await db.rpc('match_properties', {
        query_embedding: JSON.stringify(vetor), match_threshold: bairro?.id ? 0 : 0.2, match_count: 3,
        filter_min_price: null, filter_max_price: null, filter_bairro_id: bairro?.id ?? null,
      });
      if (eMatch) throw eMatch;
      const lista = (itens ?? []) as Array<{ empreendimento_id: string; nome: string; valor_min: number | null; similarity: number }>;
      imoveis = lista.length;
      if (lista.length) {
        await sugerir(db, c, 'empreendimento', `${lista.length} imóve${lista.length > 1 ? 'is combinam' : 'l combina'} com o que ${nome.split(' ')[0]} busca`, {
          busca: a.busca_imovel,
          itens: lista.map((i) => ({ id: i.empreendimento_id, nome: i.nome, valor_min: i.valor_min, afinidade: Math.round(i.similarity * 100) })),
        });
      }
    } catch (err) {
      erroImoveis = (err as Error).message;
      console.warn('match de imóveis falhou', erroImoveis);
    }
  }
  if (a.sinal_compra?.ha) await alertar(db, c, 'sinal_compra', `${nome}: sinal de compra`, a.sinal_compra.motivo);

  // Contato pessoal: regra fixa + leitura da IA (só mensagens de quem atende nos últimos 10 min)
  const recentes = res.msgs.filter((m) => m.direcao === 'saida' && Date.now() - new Date(m.criado_em).getTime() < 600_000);
  const regra = recentes.find((m) => m.texto && (PEDIDO_PESSOAL.test(m.texto) || TELEFONE_NO_TEXTO.test(m.texto.replace(/\*[^*]+\*/g, ''))));
  if (regra || a.contato_pessoal?.ha) {
    await alertar(db, c, 'contato_pessoal', `${nome}: possível contato fora do número da MeMude`,
      a.contato_pessoal?.motivo || `Mensagem de ${regra?.autor_nome ?? 'quem atende'}: "${(regra?.texto ?? '').slice(0, 160)}"`);
  }
  return { conversa: c.id, ficha: (ficha?.aplicados ?? []).map((m) => CAMPOS_FICHA[m.campo] ?? m.campo), busca: Boolean(a.busca_imovel), imoveis, erroImoveis };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { servico: db } = await autorizar(req, 'interno');
    const chave = await chaveOpenAI(db);
    if (!chave) return json(req, { ok: false, motivo: 'sem chave da OpenAI' });
    await transcrever(db, chave);
    const { data: fila, error } = await db.rpc('conv_ia_proximas', { p_limite: 8 });
    if (error) throw error;
    const conversas = (fila ?? []) as Conversa[];
    let feitas = 0;
    const detalhes: unknown[] = [];
    for (let i = 0; i < conversas.length; i += 4) {
      await Promise.all(conversas.slice(i, i + 4).map(async (c) => {
        try {
          const res = await analisar(db, chave, c);
          if (res) { detalhes.push(await aplicar(db, chave, c, res)); feitas += 1; }
        } catch (err) {
          console.warn('análise falhou', c.id, (err as Error).message);
        }
      }));
    }
    return json(req, { ok: true, analisadas: feitas, fila: conversas.length, detalhes });
  } catch (err) {
    return responderErro(req, err);
  }
});
