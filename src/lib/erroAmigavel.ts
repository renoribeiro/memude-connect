import { supabase } from '@/integrations/supabase/client';

/**
 * Transforma o erro de uma Edge Function ou do banco numa frase que o admin entende.
 * O supabase-js devolve "Edge Function returned a non-2xx status code" e guarda a resposta real em `context`.
 */
export async function erroAmigavel(erro: unknown, padrao = 'Não foi possível concluir. Tente de novo.'): Promise<string> {
  const e = erro as { context?: Response; message?: string; code?: string; details?: string } | null;
  if (e?.context && typeof e.context.json === 'function') {
    try {
      const corpo = await e.context.clone().json() as { error?: string; erro?: string };
      if (corpo?.error || corpo?.erro) return String(corpo.error ?? corpo.erro);
    } catch { /* corpo não é JSON */ }
  }
  const msg = `${e?.message ?? ''} ${e?.details ?? ''}`;
  if (e?.code === '23505' || /duplicate key/i.test(msg)) {
    if (/creci/i.test(msg)) return 'Este CRECI já está cadastrado para outro corretor.';
    if (/email/i.test(msg)) return 'Este e-mail já está em uso por outro corretor.';
    return 'Já existe um cadastro com esses dados.';
  }
  if (e?.code === '23514' && /email/i.test(msg)) return 'Confira o e-mail: ele não parece válido.';
  if (/non-2xx|failed to fetch|network/i.test(msg)) return padrao;
  return e?.message?.trim() || padrao;
}

/** Chama uma Edge Function e lança um Error com a mensagem real do servidor. */
export async function chamarFuncao<T = Record<string, unknown>>(nome: string, corpo: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) throw new Error(await erroAmigavel(error));
  const d = data as { error?: string; success?: boolean } | null;
  if (d?.error) throw new Error(d.error);
  return data as T;
}
