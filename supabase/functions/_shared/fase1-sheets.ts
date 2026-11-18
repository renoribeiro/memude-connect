const ESCOPO = 'https://www.googleapis.com/auth/spreadsheets';
let tokenCache: { valor: string; ate: number } | undefined;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export function credencialGoogle(): { client_email: string; private_key: string } | null {
  try {
    const c = JSON.parse(Deno.env.get('VISIT_GOOGLE_SERVICE_ACCOUNT') ?? '{}');
    return c.client_email && c.private_key ? c : null;
  } catch {
    return null;
  }
}

async function tokenGoogle(): Promise<string> {
  if (tokenCache && tokenCache.ate > Date.now()) return tokenCache.valor;
  const c = credencialGoogle();
  if (!c) throw new Error('Credencial Google (VISIT_GOOGLE_SERVICE_ACCOUNT) não configurada no servidor');
  const enc = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));
  const agora = Math.floor(Date.now() / 1000);
  const semAssinatura = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: c.client_email, scope: ESCOPO, aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
  })}`;
  const pem = c.private_key.replace(/-----[^-]+-----|\s/g, '');
  const chave = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(semAssinatura));
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${semAssinatura}.${b64url(new Uint8Array(assinatura))}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Autenticação Google recusada (${resp.status})`);
  const t = await resp.json();
  tokenCache = { valor: t.access_token, ate: Date.now() + 50 * 60 * 1000 };
  return tokenCache.valor;
}

export async function sheets(planilha: string, caminho: string, corpo?: unknown, metodo = 'POST') {
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(planilha)}${caminho}`, {
    method: corpo === undefined ? 'GET' : metodo,
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    const detalhe = (await resp.text()).slice(0, 300);
    throw new Error(`Planilha indisponível (${resp.status}): ${detalhe}`);
  }
  return resp.json();
}

export function coluna(indice: number): string {
  let nome = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) nome = String.fromCharCode(65 + ((n - 1) % 26)) + nome;
  return nome;
}

export function normalizarCabecalho(h: unknown): string {
  return String(h ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[:*]/g, '').replace(/[-_](?!lead|visita)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export type Aba = 'LEADS' | 'VISITAS';

export const MAPAS: Record<Aba, Record<string, string[]>> = {
  VISITAS: {
    'nome': ['nome'],
    'telefone': ['telefone'],
    'data visita': ['data visita', 'data da visita'],
    'fonte': ['fonte'],
    'horario': ['horario'],
    'imovel': ['imovel'],
    'local': ['local'],
    'bairro': ['bairro'],
    'corretor': ['corretor'],
    'status': ['status'],
    'data venda': ['data venda', 'data da venda'],
    'follow up lucas': ['follow up lucas'],
    'follow up no show': ['follow up no show'],
    'ultima tentativa': ['ultima tentativa'],
    'id_visita': ['id_visita'],
  },
  LEADS: {
    'nome': ['nome', 'nome do lead', 'cliente', 'lead', 'nome do cliente'],
    'telefone': ['telefone', 'whatsapp', 'celular', 'fone', 'contato', 'numero', 'telefone whatsapp'],
    'empreendimento': ['empreendimento', 'imovel', 'produto', 'empreendimento de interesse'],
    'fonte': ['fonte', 'origem', 'canal'],
    'status': ['status', 'status atendimento', 'status do atendimento', 'situacao'],
    'responsavel': ['responsavel', 'sdr', 'atendente', 'responsavel sdr'],
    'entrada': ['entrada', 'data entrada', 'data de entrada', 'data', 'data cadastro', 'data do cadastro'],
    'proxima visita': ['proxima visita'],
    'observacao': ['observacao', 'observacoes', 'obs', 'anotacoes'],
    'email': ['email', 'e mail'],
    'id_lead': ['id_lead'],
  },
};

// Colunas ocultas J (9) e L (11) da aba VISITAS: nunca são lidas nem escritas.
export const PROTEGIDAS: Record<Aba, number[]> = { VISITAS: [9, 11], LEADS: [] };
export const COLUNA_ID: Record<Aba, string> = { VISITAS: 'id_visita', LEADS: 'id_lead' };

export interface Estrutura {
  aba: Aba;
  sheetId: number;
  linhas: number;
  colunas: number;
  cabecalhos: string[];
  mapa: Record<string, number>;
  naoMapeadas: string[];
  locale: string;
}

export async function estrutura(planilha: string, aba: Aba, garantirId = true): Promise<Estrutura> {
  const meta = await sheets(planilha, '?fields=properties.locale,sheets.properties');
  const props = meta.sheets?.find((s: { properties: { title: string } }) => s.properties.title === aba)?.properties;
  if (!props) throw new Error(`Aba ${aba} não encontrada na planilha`);
  let colunas = props.gridProperties.columnCount as number;
  const linhas = props.gridProperties.rowCount as number;
  const cab = await sheets(planilha, `/values/${encodeURIComponent(`'${aba}'!A1:${coluna(colunas - 1)}1`)}`);
  const cabecalhos: string[] = (cab.values?.[0] ?? []).map((h: unknown) => String(h ?? ''));

  const usados = new Set<number>();
  const mapa: Record<string, number> = {};
  for (const [campo, sinonimos] of Object.entries(MAPAS[aba])) {
    const idx = cabecalhos.findIndex((h, i) =>
      !usados.has(i) && !PROTEGIDAS[aba].includes(i) && sinonimos.includes(normalizarCabecalho(h)));
    if (idx >= 0) {
      mapa[campo] = idx;
      usados.add(idx);
    }
  }

  const campoId = COLUNA_ID[aba];
  if (mapa[campoId] === undefined && garantirId) {
    let destino = cabecalhos.length;
    while (PROTEGIDAS[aba].includes(destino)) destino += 1;
    if (destino >= colunas) {
      await sheets(planilha, ':batchUpdate', {
        requests: [{ appendDimension: { sheetId: props.sheetId, dimension: 'COLUMNS', length: destino - colunas + 1 } }],
      });
      colunas = destino + 1;
    }
    await sheets(planilha, '/values:batchUpdate', {
      valueInputOption: 'RAW',
      data: [{ range: `'${aba}'!${coluna(destino)}1`, values: [[campoId]] }],
    });
    cabecalhos[destino] = campoId;
    mapa[campoId] = destino;
  }

  const naoMapeadas = cabecalhos
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h.trim() && !usados.has(i) && mapa[campoId] !== i && !PROTEGIDAS[aba].includes(i))
    .map(({ h, i }) => `${coluna(i)}: ${h}`);

  return { aba, sheetId: props.sheetId, linhas, colunas, cabecalhos, mapa, naoMapeadas, locale: meta.properties?.locale ?? '' };
}

export async function lerAba(planilha: string, e: Estrutura): Promise<string[][]> {
  const r = await sheets(planilha,
    `/values/${encodeURIComponent(`'${e.aba}'!A1:${coluna(e.colunas - 1)}${e.linhas}`)}?valueRenderOption=FORMATTED_VALUE`);
  return (r.values ?? []).map((linha: unknown[]) => linha.map((c) => String(c ?? '')));
}

// Impede fórmulas vindas de dados digitados (=, +, -, @) quando o valor é interpretado pela planilha.
export function valorSeguro(v: unknown, interpretado: boolean): string {
  const s = v === null || v === undefined ? '' : String(v);
  return interpretado && /^[=+\-@]/.test(s) ? `'${s}` : s;
}
