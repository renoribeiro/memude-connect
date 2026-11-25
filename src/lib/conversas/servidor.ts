import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** Chama uma Edge Function e devolve a mensagem de erro em português que ela mandou. */
export async function chamarFuncao<T>(nome: string, corpo?: Record<string, unknown>, metodo: 'POST' | 'GET' = 'POST'): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo, method: metodo });
  if (error) {
    let msg = 'Não foi possível concluir. Tente de novo.';
    if (error instanceof FunctionsHttpError) {
      try {
        const j = await error.context.json() as { erro?: string };
        if (j?.erro) msg = j.erro;
      } catch { /* resposta sem JSON */ }
    } else if (error.message?.includes('Failed to send')) {
      msg = 'Sem conexão. Confira a internet e tente de novo.';
    }
    throw new Error(msg);
  }
  return data as T;
}

export function mensagemErro(e: unknown): string {
  return (e as { message?: string })?.message || 'Não foi possível concluir. Tente de novo.';
}

const MAX_BYTES = 25 * 1024 * 1024;

/** Reduz fotos grandes antes de enviar (WhatsApp recomprime de qualquer jeito; economiza dados do corretor). */
async function comprimirImagem(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 1.5 * 1024 * 1024) return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return arquivo;
  }
}

export interface ArquivoEnviado { path: string; mime: string; nome: string; bytes: number }

/** Sobe o anexo para a pasta do próprio usuário; o servidor move para a conversa ao enviar. */
export async function subirAnexo(arquivo: File, userId: string): Promise<ArquivoEnviado> {
  const final = await comprimirImagem(arquivo);
  if (final.size > MAX_BYTES) throw new Error('O arquivo passa de 25 MB. Envie um menor.');
  const ext = (final.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? final.type.split('/')[1] ?? 'bin').toLowerCase();
  const path = `saida/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('conversas').upload(path, final, { contentType: final.type || 'application/octet-stream' });
  if (error) throw new Error('Não foi possível anexar o arquivo. Tente de novo.');
  return { path, mime: final.type || 'application/octet-stream', nome: final.name, bytes: final.size };
}

export function tipoDoArquivo(mime: string): 'imagem' | 'video' | 'audio' | 'documento' {
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'documento';
}
