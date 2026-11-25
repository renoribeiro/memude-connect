// MeMude Conversas — notificações push (Web Push, RFC 8030/8291/8292) sem dependências externas.
//   GET  (JWT do usuário)            → { chave }  chave pública VAPID para o app se inscrever
//   POST (x-internal-secret, banco)  → { users[], titulo, corpo, url, tag }  envia para os aparelhos dessas pessoas
// As chaves VAPID são geradas uma única vez e ficam no Vault (nunca saem do servidor).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, clienteServico, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { segredo } from '../_shared/conversas.ts';

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s: string) => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const juntar = (...partes: Uint8Array[]) => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
};

interface Vapid { publica: string; jwk: JsonWebKey }

async function vapid(db: SupabaseClient): Promise<Vapid> {
  const bruto = await segredo(db, 'conversas_vapid', async () => {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const publica = b64url(await crypto.subtle.exportKey('raw', par.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
    return JSON.stringify({ publica, jwk });
  });
  return JSON.parse(bruto!) as Vapid;
}

async function jwtVapid(v: Vapid, endpoint: string) {
  const aud = new URL(endpoint).origin;
  const cab = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://core.memudecore.com.br' })));
  const chave = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, enc.encode(`${cab}.${corpo}`));
  return `${cab}.${corpo}.${b64url(assinatura)}`;
}

async function hmac(chave: Uint8Array, dados: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}

/** Criptografa a mensagem para o aparelho (aes128gcm, RFC 8291). */
async function cifrar(p256dh: string, auth: string, texto: string) {
  const uaPublica = deB64url(p256dh);
  const segredoAuth = deB64url(auth);
  const efemera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', efemera.publicKey));
  const chaveUa = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: chaveUa }, efemera.privateKey, 256));

  const prkChave = await hmac(segredoAuth, ecdh);
  const ikm = await hmac(prkChave, juntar(enc.encode('WebPush: info\0'), uaPublica, asPublica, new Uint8Array([1])));
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, juntar(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, juntar(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, juntar(enc.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

interface Inscricao { id: string; endpoint: string; p256dh: string; auth: string }

async function enviarUm(v: Vapid, i: Inscricao, carga: string, tag: string) {
  const corpo = await cifrar(i.p256dh, i.auth, carga);
  const r = await fetch(i.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await jwtVapid(v, i.endpoint)}, k=${v.publica}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
      Topic: tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'memude',
    },
    body: corpo,
    signal: AbortSignal.timeout(10_000),
  });
  await r.body?.cancel();
  return r.status;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method === 'GET') {
      // Qualquer pessoa logada (corretor incluso) pode pegar a chave pública
      const db = clienteServico();
      const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
      const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
      if (!user) throw new ErroHttp(401, 'Faça login');
      return json(req, { chave: (await vapid(db)).publica });
    }
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido');
    const { servico: db } = await autorizar(req, 'interno');
    const b = await lerJson<{ users?: string[]; titulo?: string; corpo?: string; url?: string; tag?: string }>(req, 16 * 1024);
    const users = (b.users ?? []).filter((u) => /^[0-9a-f-]{36}$/i.test(u)).slice(0, 50);
    if (!users.length) return json(req, { enviados: 0 });
    const { data: insc } = await db.from('push_inscricoes').select('id, endpoint, p256dh, auth').in('user_id', users);
    if (!insc?.length) return json(req, { enviados: 0 });

    const v = await vapid(db);
    const url = typeof b.url === 'string' && b.url.startsWith('/') ? b.url : '/';
    const tag = String(b.tag ?? 'memude').slice(0, 64);
    const carga = JSON.stringify({ titulo: String(b.titulo ?? 'MeMude').slice(0, 80), corpo: String(b.corpo ?? '').slice(0, 180), url, tag });
    let enviados = 0;
    const mortas: string[] = [];
    await Promise.all((insc as Inscricao[]).map(async (i) => {
      try {
        const st = await enviarUm(v, i, carga, tag);
        if (st === 404 || st === 410) mortas.push(i.id);
        else if (st < 300) enviados += 1;
        else console.warn('push recusado', st, new URL(i.endpoint).host);
      } catch (err) {
        console.warn('push falhou', (err as Error).message);
      }
    }));
    if (mortas.length) await db.from('push_inscricoes').delete().in('id', mortas);
    if (enviados) {
      await db.from('push_inscricoes').update({ ultimo_uso_em: new Date().toISOString() })
        .in('id', (insc as Inscricao[]).map((i) => i.id).filter((id) => !mortas.includes(id)));
    }
    return json(req, { enviados, removidas: mortas.length });
  } catch (err) {
    return responderErro(req, err);
  }
});
