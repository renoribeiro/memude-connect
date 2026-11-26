// MeMude Conversas — foto de perfil do WhatsApp dos clientes.
// O pg_cron chama a cada 10 min só quando há conversa sem foto (ou com foto de mais de 7 dias).
// O link do WhatsApp expira em poucos dias: a imagem é copiada para o armazenamento (avatares/clientes/<conversa>.jpg).
// Cliente sem foto pública no WhatsApp fica com o bonequinho ilustrado.
import { autorizar, json, preflight, responderErro } from '../_shared/fase1-http.ts';
import { evo, evolution } from '../_shared/conversas.ts';

const BASE = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
const LIMITE_BYTES = 1_500_000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { servico: db } = await autorizar(req, 'interno');
    const { data, error } = await db.rpc('conv_fotos_pendentes', { p_limite: 15 });
    if (error) throw error;
    const fila = (data ?? []) as { conversa_id: string; instancia: string; telefone: string }[];
    if (!fila.length) return json(req, { ok: true, fotos: 0 });
    const e = await evolution(db);
    let fotos = 0;
    let sem = 0;
    for (const c of fila) {
      try {
        if (!/^conversas-[a-z0-9-]{2,40}$/.test(c.instancia)) continue; // só números da plataforma
        const r = await evo<{ profilePictureUrl?: string | null }>(e, `/chat/fetchProfilePictureUrl/${c.instancia}`, {
          body: { number: c.telefone.replace(/\D/g, '') }, timeoutMs: 15_000,
        });
        const url = r?.profilePictureUrl;
        if (!url || !/^https:\/\//.test(url)) { await db.rpc('conv_foto_gravar', { p_conversa: c.conversa_id, p_url: null }); sem += 1; continue; }
        const img = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        const tipo = img.headers.get('content-type') ?? '';
        if (!img.ok || !tipo.startsWith('image/')) { sem += 1; continue; }
        const bytes = new Uint8Array(await img.arrayBuffer());
        if (bytes.length > LIMITE_BYTES) { sem += 1; continue; }
        const caminho = `clientes/${c.conversa_id}.jpg`;
        const { error: eUp } = await db.storage.from('avatares').upload(caminho, bytes, { contentType: 'image/jpeg', upsert: true });
        if (eUp) throw eUp;
        // ?v= força o aparelho a buscar a foto nova quando ela muda
        await db.rpc('conv_foto_gravar', { p_conversa: c.conversa_id, p_url: `${BASE}/storage/v1/object/public/avatares/${caminho}?v=${Date.now()}` });
        fotos += 1;
      } catch (err) {
        console.warn('foto não obtida', c.conversa_id, (err as Error).message);
      }
    }
    return json(req, { ok: true, fotos, sem_foto: sem, fila: fila.length });
  } catch (err) {
    return responderErro(req, err);
  }
});
