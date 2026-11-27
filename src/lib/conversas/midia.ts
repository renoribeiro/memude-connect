import { supabase } from '@/integrations/supabase/client';

/** Link temporário (1 h) para ver a mídia de uma conversa visível ao usuário. */
export async function linkAssinado(path: string) {
  const { data, error } = await supabase.storage.from('conversas').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Fotos e áudios ficam guardados no aparelho: cada arquivo é baixado uma vez só (antes, cada abertura do app
// gerava um link novo e baixava tudo de novo, gastando o tráfego do Supabase). O cache é apagado ao sair da conta.
const CACHE_MIDIA = 'memude-midia-v1';
const MAX_GUARDAR = 8 * 1024 * 1024;
const MAX_ITENS = 400;
const emMemoria = new Map<string, string>();

export async function midiaGuardada(path: string): Promise<string> {
  const ja = emMemoria.get(path);
  if (ja) return ja;
  if (typeof caches === 'undefined') return linkAssinado(path);
  const chave = `${location.origin}/__midia/${encodeURIComponent(path)}`;
  let cache: Cache;
  try { cache = await caches.open(CACHE_MIDIA); } catch { return linkAssinado(path); }
  let resp = await cache.match(chave);
  if (!resp) {
    const baixada = await fetch(await linkAssinado(path));
    if (!baixada.ok) throw new Error('Não foi possível baixar a mídia');
    const blob = await baixada.blob();
    if (blob.size <= MAX_GUARDAR) {
      await cache.put(chave, new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } })).catch(() => undefined);
      // Mantém o cache enxuto: sai o que foi guardado primeiro
      void cache.keys().then((ks) => (ks.length > MAX_ITENS ? Promise.all(ks.slice(0, ks.length - MAX_ITENS).map((k) => cache.delete(k))) : null));
    }
    resp = new Response(blob);
  }
  const url = URL.createObjectURL(await resp.blob());
  emMemoria.set(path, url);
  return url;
}

/** Apaga as mídias guardadas no aparelho (ao sair da conta ou trocar de pessoa). */
export async function limparMidiaGuardada() {
  emMemoria.forEach((u) => URL.revokeObjectURL(u));
  emMemoria.clear();
  if (typeof caches !== 'undefined') await caches.delete(CACHE_MIDIA).catch(() => undefined);
}
