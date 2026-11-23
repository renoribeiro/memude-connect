// Espelho somente leitura das abas LEADS e VISITAS da planilha "CRM MeMude 2025".
// Modos: diario (cron 17h30/17h45: importa linhas novas, confere e envia) · enviar · conferencia · reconstruir · importar · puxar (status da planilha → core) · inspecionar · proteger.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { chaveTelefone } from '../_shared/fase1-phone.ts';
import {
  type Aba, COLUNA_ID, coluna, credencialGoogle, estrutura, type Estrutura, lerAba, MAPAS, PROTEGIDAS, sheets, valorSeguro,
} from '../_shared/fase1-sheets.ts';

const ORCAMENTO_MS = 50_000;
const ABAS: Aba[] = ['LEADS', 'VISITAS'];

interface Item { id: number; aba: Aba; registro_id: string; tentativas: number; linha: Record<string, string> | null }
interface Faixa { range: string; values: string[][] }

async function planilhaId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from('visit_automation_config').select('spreadsheet_id').eq('id', true).single();
  if (error || !data?.spreadsheet_id) throw new Error('Planilha espelho não configurada');
  return data.spreadsheet_id;
}

function normData(v: string): string {
  const t = (v ?? '').trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3].length === 2 ? `20${m[3]}` : m[3]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

function normValor(v: string | undefined): string {
  const t = (v ?? '').replace(/\s+/g, ' ').trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t.padStart(5, '0').slice(0, 5);
  if (/^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/.test(t)) return normData(t);
  return t;
}

function chaveLinha(aba: Aba, telefone: string | undefined, data: string | undefined): string | null {
  const k = chaveTelefone(telefone);
  if (!k) return null;
  return aba === 'VISITAS' ? `${k}|${normData(data ?? '')}` : k;
}

function faixasDaLinha(e: Estrutura, linha: number, valores: Record<string, string>, interpretado: boolean): Faixa[] {
  const celulas = Object.entries(e.mapa)
    .filter(([campo]) => campo in valores)
    .map(([campo, col]) => ({ col, valor: valorSeguro(valores[campo], interpretado) }))
    .sort((a, b) => a.col - b.col);
  const faixas: Faixa[] = [];
  let atual: { ini: number; fim: number; vals: string[] } | null = null;
  for (const c of celulas) {
    if (atual && c.col === atual.fim + 1) {
      atual.fim = c.col;
      atual.vals.push(c.valor);
    } else {
      if (atual) faixas.push({ range: `'${e.aba}'!${coluna(atual.ini)}${linha}:${coluna(atual.fim)}${linha}`, values: [atual.vals] });
      atual = { ini: c.col, fim: c.col, vals: [c.valor] };
    }
  }
  if (atual) faixas.push({ range: `'${e.aba}'!${coluna(atual.ini)}${linha}:${coluna(atual.fim)}${linha}`, values: [atual.vals] });
  return faixas;
}

async function gravar(planilha: string, faixas: Faixa[], interpretado: boolean) {
  for (let i = 0; i < faixas.length; i += 1500) {
    await sheets(planilha, '/values:batchUpdate', {
      valueInputOption: interpretado ? 'USER_ENTERED' : 'RAW',
      data: faixas.slice(i, i + 1500),
    });
  }
}

async function garantirLinhas(planilha: string, e: Estrutura, ultimaNecessaria: number) {
  if (ultimaNecessaria <= e.linhas) return;
  const extra = ultimaNecessaria - e.linhas + 100;
  await sheets(planilha, ':batchUpdate', {
    requests: [{ appendDimension: { sheetId: e.sheetId, dimension: 'ROWS', length: extra } }],
  });
  e.linhas += extra;
}

// ===== Envio da fila =====
async function enviarAba(planilha: string, aba: Aba, itens: Item[]) {
  const e = await estrutura(planilha, aba);
  const interpretado = e.locale.toLowerCase().startsWith('pt');
  const dados = await lerAba(planilha, e);
  const idCol = e.mapa[COLUNA_ID[aba]];
  const porId = new Map<string, number>();
  const livres = new Map<string, number[]>();
  let ultima = 1;
  dados.forEach((row, i) => {
    if (i === 0) return;
    const n = i + 1;
    if (row.some((c) => c.trim())) ultima = n;
    const id = (row[idCol] ?? '').trim();
    if (id) {
      if (!porId.has(id)) porId.set(id, n);
    } else if (e.mapa.telefone !== undefined) {
      const k = chaveLinha(aba, row[e.mapa.telefone], e.mapa['data visita'] !== undefined ? row[e.mapa['data visita']] : undefined);
      if (k) livres.set(k, [...(livres.get(k) ?? []), n]);
    }
  });

  const faixas: Faixa[] = [];
  let proxima = ultima + 1;
  for (const item of itens) {
    if (!item.linha) continue;
    let alvo = porId.get(item.registro_id);
    if (alvo === undefined) {
      const k = chaveLinha(aba, item.linha.telefone, item.linha['data visita']);
      const candidatas = k ? livres.get(k) : undefined;
      alvo = candidatas?.length ? candidatas.shift()! : proxima++;
      porId.set(item.registro_id, alvo);
    }
    faixas.push(...faixasDaLinha(e, alvo, item.linha, interpretado));
  }
  await garantirLinhas(planilha, e, proxima - 1);
  await gravar(planilha, faixas, interpretado);
}

async function enviar(db: SupabaseClient, planilha: string, limiteMs = ORCAMENTO_MS) {
  const inicio = Date.now();
  let enviados = 0;
  let erros = 0;
  const mensagens: string[] = [];
  while (Date.now() - inicio < limiteMs) {
    const { data, error } = await db.rpc('sheet_sync_claim', { p_limite: 300 });
    if (error) throw error;
    const itens = (data ?? []) as Item[];
    if (!itens.length) break;
    const ok: number[] = [];
    const falhas: { id: number; erro: string }[] = [];
    for (const aba of ABAS) {
      const daAba = itens.filter((i) => i.aba === aba);
      if (!daAba.length) continue;
      try {
        await enviarAba(planilha, aba, daAba);
        ok.push(...daAba.map((i) => i.id));
      } catch (err) {
        const msg = (err as Error).message;
        mensagens.push(`${aba}: ${msg}`);
        falhas.push(...daAba.map((i) => ({ id: i.id, erro: msg })));
      }
    }
    const { error: erroConcluir } = await db.rpc('sheet_sync_concluir', { p_ok: ok, p_falhas: falhas });
    if (erroConcluir) throw erroConcluir;
    enviados += ok.length;
    erros += falhas.length;
    if (falhas.length) break;
  }
  return { enviados, erros, mensagens };
}

// O PostgREST limita cada resposta a 1.000 linhas: lê em páginas.
async function todosRegistros(db: SupabaseClient, aba: Aba) {
  const todos: { registro_id: string; linha: Record<string, string> }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.rpc('sheet_sync_ids', { p_aba: aba }).range(de, de + 999);
    if (error) throw error;
    todos.push(...((data ?? []) as typeof todos));
    if (!data || data.length < 1000) return todos;
  }
}

async function idsExistentes(db: SupabaseClient, aba: Aba, ids: string[]): Promise<Set<string>> {
  const existentes = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await db.rpc('sheet_ids_existentes', { p_aba: aba, p_ids: ids.slice(i, i + 500) });
    if (error) throw error;
    for (const id of (data ?? []) as string[]) existentes.add(id);
  }
  return existentes;
}

// ===== Conferência banco × planilha =====
// apenasFaltantes: só enfileira o que está no core e não tem linha na planilha (não sobrescreve edições feitas na planilha).
async function conferir(db: SupabaseClient, planilha: string, apenasFaltantes = false) {
  const resultado: Record<string, unknown> = {};
  for (const aba of ABAS) {
    const e = await estrutura(planilha, aba);
    const dados = await lerAba(planilha, e);
    const idCol = e.mapa[COLUNA_ID[aba]];
    const naPlanilha = new Map<string, string[]>();
    const duplicados = new Set<string>();
    for (const row of dados.slice(1)) {
      const id = (row[idCol] ?? '').trim();
      if (!id) continue;
      if (naPlanilha.has(id)) duplicados.add(id);
      else naPlanilha.set(id, row);
    }
    const registros = await todosRegistros(db, aba);
    const divergentes: string[] = [];
    const faltantes: string[] = [];
    const noBanco = new Set<string>();
    for (const r of registros) {
      noBanco.add(r.registro_id);
      const row = naPlanilha.get(r.registro_id);
      if (!row) faltantes.push(r.registro_id);
      const difere = !row || Object.entries(e.mapa).some(([campo, col]) =>
        campo in r.linha && normValor(row[col]) !== normValor(r.linha[campo]));
      if (difere) divergentes.push(r.registro_id);
    }
    const enfileirar = apenasFaltantes ? faltantes : divergentes;
    for (let i = 0; i < enfileirar.length; i += 500) {
      const { error: errEnf } = await db.rpc('sheet_sync_enfileirar_ids', {
        p_aba: aba, p_ids: enfileirar.slice(i, i + 500), p_origem: apenasFaltantes ? 'diario' : 'conferencia',
      });
      if (errEnf) throw errEnf;
    }
    resultado[aba] = {
      divergentes: divergentes.length,
      faltando_na_planilha: faltantes.length,
      ids_na_planilha_sem_registro: [...naPlanilha.keys()].filter((id) => !noBanco.has(id)).length,
      ids_duplicados_na_planilha: duplicados.size,
    };
  }
  return resultado;
}

// ===== Importação histórica =====
async function importar(db: SupabaseClient, planilha: string, aba: Aba, aPartirDe: number, inicioMs: number) {
  const e = await estrutura(planilha, aba);
  const dados = await lerAba(planilha, e);
  const idCol = e.mapa[COLUNA_ID[aba]];
  // Ids que não existem mais no core (ex.: visitas antigas do robô) são tratados como linhas a importar.
  const idsLidos = [...new Set(dados.slice(1).map((r) => (r[idCol] ?? '').trim()).filter(Boolean))];
  const validos = await idsExistentes(db, aba, idsLidos);
  const idsNaPlanilha = new Set(validos);
  const orfaos = idsLidos.filter((id) => !validos.has(id)).length;
  const campos = Object.entries(e.mapa).filter(([c]) => c !== COLUNA_ID[aba]);
  const mapeadas = new Set(Object.values(e.mapa));
  // Colunas sem correspondência no core: preservadas no registro importado (planilha_extra.original).
  const extras = e.cabecalhos
    .map((h, col) => ({ h: h.trim(), col }))
    .filter(({ h, col }) => h && !mapeadas.has(col) && !PROTEGIDAS[aba].includes(col));

  const linhas: { linha: number; v: Record<string, unknown> }[] = [];
  dados.forEach((row, i) => {
    const n = i + 1;
    if (n < Math.max(aPartirDe, 2)) return;
    if (validos.has((row[idCol] ?? '').trim())) return;
    if (!row.some((c, ci) => ci !== idCol && c.trim())) return;
    const v: Record<string, unknown> = Object.fromEntries(campos.map(([c, col]) => [c, (row[col] ?? '').trim()]));
    const extra = Object.fromEntries(extras.map(({ h, col }) => [h, (row[col] ?? '').trim()]).filter(([, val]) => val));
    if (Object.keys(extra).length) v.colunas_sem_correspondencia = extra;
    linhas.push({ linha: n, v });
  });

  const contagem: Record<string, number> = { criado: 0, existente: 0, conflito: 0, erro: 0, ignorada: 0, duplicada_na_planilha: 0 };
  const avisos: Record<string, Record<string, number>> = {};
  const erros: { linha: number; mensagem: string }[] = [];
  let proxima: number | null = null;

  for (let i = 0; i < linhas.length; i += 150) {
    if (Date.now() - inicioMs > ORCAMENTO_MS) {
      proxima = linhas[i].linha;
      break;
    }
    const lote = linhas.slice(i, i + 150);
    const { data, error } = await db.rpc('planilha_importar_lote', { p_aba: aba, p_linhas: lote });
    if (error) throw error;
    const faixas: Faixa[] = [];
    for (const r of data as { linha: number; id?: string; acao: string; mensagem?: string; avisos?: Record<string, string> }[]) {
      contagem[r.acao] = (contagem[r.acao] ?? 0) + 1;
      if (r.acao === 'erro' || r.acao === 'ignorada') erros.push({ linha: r.linha, mensagem: r.mensagem ?? '' });
      for (const [tipo, valor] of Object.entries(r.avisos ?? {})) {
        avisos[tipo] ??= {};
        avisos[tipo][valor] = (avisos[tipo][valor] ?? 0) + 1;
      }
      if (!r.id || !['criado', 'existente', 'conflito'].includes(r.acao)) continue;
      if (idsNaPlanilha.has(r.id)) {
        contagem.duplicada_na_planilha += 1;
        continue;
      }
      idsNaPlanilha.add(r.id);
      faixas.push({ range: `'${aba}'!${coluna(idCol)}${r.linha}`, values: [[r.id]] });
    }
    await gravar(planilha, faixas, false);
  }
  return { aba, linhas_lidas: linhas.length, ids_orfaos_reimportados: orfaos, contagem, avisos, erros: erros.slice(0, 200),
    proxima_linha: proxima, colunas_nao_mapeadas: e.naoMapeadas };
}

// ===== Reconstrução e proteção =====
async function reconstruir(db: SupabaseClient, planilha: string, aba: Aba) {
  const e = await estrutura(planilha, aba);
  const carimbo = new Date().toLocaleString('sv-SE', { timeZone: 'America/Fortaleza' }).slice(0, 16).replace(/[-: ]/g, '');
  const nomeBackup = `${aba} backup ${carimbo}`;
  await sheets(planilha, ':batchUpdate', {
    requests: [{ duplicateSheet: { sourceSheetId: e.sheetId, newSheetName: nomeBackup } }],
  });
  const { data: enfileirados, error } = await db.rpc('sheet_sync_enfileirar_todos', { p_aba: aba, p_origem: 'reconstruir' });
  if (error) throw error;
  const envio = await enviar(db, planilha, 100_000);
  const conferencia = await conferir(db, planilha);
  return { backup: nomeBackup, enfileirados, ...envio, conferencia };
}

async function proteger(planilha: string) {
  const c = credencialGoogle();
  if (!c) throw new Error('Credencial Google não configurada');
  const meta = await sheets(planilha, '?fields=sheets(properties(sheetId,title),protectedRanges(description))');
  const pedidos: unknown[] = [];
  const resultado: Record<string, string> = {};
  for (const aba of ABAS) {
    const s = meta.sheets.find((x: { properties: { title: string } }) => x.properties.title === aba);
    if (!s) throw new Error(`Aba ${aba} não encontrada`);
    if ((s.protectedRanges ?? []).some((p: { description?: string }) => p.description === 'core.memude-espelho')) {
      resultado[aba] = 'já protegida';
      continue;
    }
    pedidos.push({ addProtectedRange: { protectedRange: {
      range: { sheetId: s.properties.sheetId },
      description: 'core.memude-espelho',
      warningOnly: false,
      editors: { users: [c.client_email] },
    } } });
    resultado[aba] = 'protegida';
  }
  if (pedidos.length) await sheets(planilha, ':batchUpdate', { requests: pedidos });
  return { abas: resultado, editor: c.client_email };
}

// ===== Puxar da planilha: status (e resultado das visitas) dos registros que já existem no core =====
async function puxar(db: SupabaseClient, planilha: string, aba: Aba, aplicar: boolean) {
  const e = await estrutura(planilha, aba, false);
  const dados = await lerAba(planilha, e);
  const idCol = e.mapa[COLUNA_ID[aba]];
  if (idCol === undefined) throw new ErroHttp(400, `A aba ${aba} não tem a coluna ${COLUNA_ID[aba]}`);
  const campos = aba === 'VISITAS' ? ['status', 'follow up lucas', 'data venda', 'follow up no show'] : ['status'];
  const vistos = new Set<string>();
  const linhas: Record<string, string>[] = [];
  for (const row of dados.slice(1)) {
    const id = (row[idCol] ?? '').trim();
    if (!id || vistos.has(id)) continue; // id repetido: vale a primeira linha
    vistos.add(id);
    linhas.push(Object.fromEntries([['id', id], ...campos.filter((c) => e.mapa[c] !== undefined).map((c) => [c, (row[e.mapa[c]] ?? '').trim()])]));
  }
  const total: Record<string, unknown> = { aba, aplicado: aplicar, contagem: {}, rotulos_fora_do_padrao: {}, exemplos: [] as unknown[] };
  for (let i = 0; i < linhas.length; i += 400) {
    const { data, error } = await db.rpc('planilha_puxar', { p_aba: aba, p_linhas: linhas.slice(i, i + 400), p_aplicar: aplicar });
    if (error) throw error;
    const r = data as { contagem: Record<string, number>; rotulos_fora_do_padrao: Record<string, number>; exemplos: unknown[] };
    const soma = (alvo: Record<string, number>, de: Record<string, number>) => {
      for (const [k, v] of Object.entries(de ?? {})) alvo[k] = (alvo[k] ?? 0) + v;
    };
    soma(total.contagem as Record<string, number>, r.contagem);
    soma(total.rotulos_fora_do_padrao as Record<string, number>, r.rotulos_fora_do_padrao);
    (total.exemplos as unknown[]).push(...(r.exemplos ?? []).slice(0, Math.max(0, 25 - (total.exemplos as unknown[]).length)));
  }
  total.linhas_sem_id = dados.slice(1).filter((r) => r.some((c) => c.trim()) && !(r[idCol] ?? '').trim()).length;
  return total;
}

async function inspecionar(planilha: string) {
  const saida: Record<string, unknown> = { conta_servico: credencialGoogle()?.client_email ?? null };
  for (const aba of ABAS) {
    const e = await estrutura(planilha, aba, false);
    const dados = await lerAba(planilha, e);
    const idCol = e.mapa[COLUNA_ID[aba]];
    const comDados = dados.slice(1).filter((r) => r.some((c) => c.trim()));
    saida[aba] = {
      locale: e.locale,
      linhas_com_dados: comDados.length,
      linhas_com_id: idCol === undefined ? 0 : comDados.filter((r) => (r[idCol] ?? '').trim()).length,
      mapeamento: Object.fromEntries(Object.entries(e.mapa).map(([campo, col]) => [campo, `${coluna(col)} (${e.cabecalhos[col]})`])),
      campos_sem_coluna: Object.keys(MAPAS[aba]).filter((campo) => e.mapa[campo] === undefined),
      colunas_nao_mapeadas: e.naoMapeadas,
    };
  }
  return saida;
}

Deno.serve(async (req) => {
  const opcoes = preflight(req);
  if (opcoes) return opcoes;
  const inicio = Date.now();
  const iniciadoEm = new Date().toISOString();
  let db: SupabaseClient | null = null;
  try {
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido');
    const acesso = await autorizar(req, 'admin-ou-interno');
    db = acesso.servico;
    const corpo = await lerJson<{ modo?: string; aba?: Aba; a_partir_de?: number; aplicar?: boolean }>(req, 4096);
    const modo = corpo.modo ?? 'enviar';
    const aba = corpo.aba;
    if (aba && !ABAS.includes(aba)) throw new ErroHttp(400, 'Aba inválida');
    const planilha = await planilhaId(db);

    let resultado: Record<string, unknown>;
    let enviados = 0;
    let erros = 0;
    switch (modo) {
      case 'enviar': {
        const r = await enviar(db, planilha);
        resultado = r;
        enviados = r.enviados;
        erros = r.erros;
        if (!enviados && !erros) return json(req, { modo, ...r });
        break;
      }
      case 'diario': {
        // Rotina das 17h30 (e repescagem às 17h45), nos dois sentidos:
        // 1) linhas novas da aba LEADS (sem id) viram leads no core e recebem o id na planilha;
        // 2) a conferência enfileira o que está no core e falta na planilha (edições feitas na planilha são preservadas);
        // 3) o envio grava a fila na planilha.
        const importacao = await importar(db, planilha, 'LEADS', 2, inicio);
        const conferencia = await conferir(db, planilha, true);
        const envio = await enviar(db, planilha, Math.max(20_000, 110_000 - (Date.now() - inicio)));
        resultado = { importacao, conferencia, envio };
        enviados = envio.enviados;
        erros = envio.erros + ((importacao.contagem as Record<string, number>).erro ?? 0);
        break;
      }
      case 'conferencia':
        resultado = await conferir(db, planilha);
        break;
      case 'reconstruir':
        if (!aba) throw new ErroHttp(400, 'Informe a aba');
        resultado = await reconstruir(db, planilha, aba);
        break;
      case 'importar':
        if (!aba) throw new ErroHttp(400, 'Informe a aba');
        resultado = await importar(db, planilha, aba, Number(corpo.a_partir_de) || 2, inicio);
        break;
      case 'puxar':
        if (!aba) throw new ErroHttp(400, 'Informe a aba');
        if (corpo.aplicar !== true) return json(req, { modo, ...(await puxar(db, planilha, aba, false)) }); // simulação não registra execução
        resultado = await puxar(db, planilha, aba, true);
        break;
      case 'inspecionar':
        return json(req, await inspecionar(planilha));
      case 'proteger':
        resultado = await proteger(planilha);
        break;
      default:
        throw new ErroHttp(400, 'Modo inválido');
    }
    await db.rpc('sheet_sync_execucao', {
      p_modo: aba ? `${modo}:${aba}` : modo, p_enviados: enviados, p_erros: erros,
      p_mensagem: erros ? 'Concluído com erros' : 'Concluído', p_detalhes: resultado, p_inicio: iniciadoEm,
    });
    return json(req, { modo, ...resultado });
  } catch (erro) {
    if (db) {
      await db.rpc('sheet_sync_execucao', {
        p_modo: 'falha', p_enviados: 0, p_erros: 1, p_mensagem: (erro as Error).message ?? 'Erro', p_detalhes: null, p_inicio: iniciadoEm,
      }).then(() => undefined, () => undefined);
    }
    return responderErro(req, erro);
  }
});
