import { sheetVisitRow } from './visit-workflow.ts';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const env = (key:string) => (globalThis as unknown as {Deno?:{env:{get:(key:string)=>string|undefined}}}).Deno?.env.get(key);
let cachedToken: { value: string; until: number } | undefined;
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export function sheetsConfigured() { return Boolean(env('VISIT_GOOGLE_SERVICE_ACCOUNT')); }

async function googleToken() {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const credentials = JSON.parse(env('VISIT_GOOGLE_SERVICE_ACCOUNT') || '{}');
  if (!credentials.client_email || !credentials.private_key) throw new Error('Configure VISIT_GOOGLE_SERVICE_ACCOUNT no servidor');
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: GOOGLE_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const pem = credentials.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(new Uint8Array(signature))}` }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Autenticação Google recusada (${response.status})`);
  const token = await response.json();
  cachedToken = { value: token.access_token, until: Date.now() + 3000_000 };
  return cachedToken.value;
}

async function sheetsRequest(id: string, path: string, body?: unknown, method = 'POST') {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Planilha indisponível (${response.status})`);
  return response.json();
}

function column(index: number) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

async function visitSheetStructure(id: string, request= sheetsRequest) {
  const metadata = await request(id, '?fields=sheets.properties');
  const tab = metadata.sheets.find((s: any) => s.properties.title === 'VISITAS')?.properties;
  if (!tab) throw new Error('Aba VISITAS não encontrada');
  const sheet = await request(id, '/values/' + encodeURIComponent(`'VISITAS'!A1:${column(tab.gridProperties.columnCount - 1)}1`));
  const headers: string[] = sheet.values?.[0] || [];
  if (!headers.includes('id_visita')) throw new Error('A aba VISITAS precisa da coluna id_visita');
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error('Cabeçalhos duplicados na aba VISITAS; revisão manual necessária');
  return { headers, tab };
}

export async function inspectVisitSheet(id: string) { return (await visitSheetStructure(id)).headers; }

export async function verifyVisitSheetWrite(id: string) {
  const { headers } = await visitSheetStructure(id);
  // Write back only the existing identifier header, preserving every visit row.
  await sheetsRequest(id, '/values:batchUpdate', { valueInputOption: 'RAW', data: [{ range: `'VISITAS'!${column(headers.indexOf('id_visita'))}1`, values: [['id_visita']] }] });
}

export async function syncVisitSheet(id: string, snapshot: any, reminders: any[], request=sheetsRequest) {
  const { headers, tab } = await visitSheetStructure(id,request);
  const values = sheetVisitRow(snapshot);
  values.sync_revision=snapshot.cycle.revision;
  values.sync_at=new Date().toISOString();
  for (const kind of ['eve', 'h2']) {
    const sent = reminders.filter(p => p.kind === kind && p.revision === snapshot.cycle.revision && p.sent_at);
    values[kind === 'eve' ? 'lembrete_vespera_enviado' : 'lembrete_h2_enviado'] = sent.length ? sent.map(p => `${p.audience}: ${p.sent_at}`).join('; ') : '';
  }
  // Add only missing workflow columns; never replace the user's header or notes.
  const added = Object.keys(values).filter(h => !headers.includes(h));
  if (added.length) {
    if (tab.gridProperties.columnCount < headers.length + added.length) await request(id, ':batchUpdate', { requests: [{ appendDimension: { sheetId: tab.sheetId, dimension: 'COLUMNS', length: headers.length + added.length - tab.gridProperties.columnCount } }] });
    await request(id, '/values:batchUpdate', { valueInputOption: 'RAW', data: [{ range: `'VISITAS'!${column(headers.length)}1`, values: [added] }] });
    headers.push(...added);
  }
  const idColumn = column(headers.indexOf('id_visita'));
  if (tab.gridProperties.rowCount > 100000) throw new Error('Planilha excede o limite de 100.000 linhas; amplie a leitura paginada antes de sincronizar');
  const ids = tab.gridProperties.rowCount < 2 ? { values: [] } : await request(id, '/values/' + encodeURIComponent(`'VISITAS'!${idColumn}2:${idColumn}${tab.gridProperties.rowCount}`));
  const matches = (ids.values || []).flatMap((r: any[], i: number) => r[0] === snapshot.visit.id ? [i + 2] : []);
  if (matches.length > 1) throw new Error('id_visita duplicado na planilha; revisão manual necessária');
  if (matches.length) {
    await request(id, '/values:batchUpdate', { valueInputOption: 'RAW', data: Object.entries(values).map(([header, value]) => ({ range: `'VISITAS'!${column(headers.indexOf(header))}${matches[0]}`, values: [[value]] })) });
  } else {
    await request(id, '/values/' + encodeURIComponent("'VISITAS'!A1") + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { values: [headers.map(h => values[h] ?? '')] });
  }
}
