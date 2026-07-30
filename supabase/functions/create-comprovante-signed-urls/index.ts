import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

interface SignedUrlItem {
  vendaId?: string | null;
  path?: string;
}

interface SignedUrlRequest {
  items?: SignedUrlItem[];
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function isSafePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 500
    && !value.startsWith('/')
    && !value.includes('..')
    && !value.includes('\\')
    && !/^https?:/i.test(value);
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const access = await authorize(req, 'authenticated');
  if (access instanceof Response) return access;

  try {
    const { items } = await readJson<SignedUrlRequest>(req, 32 * 1024);
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return jsonResponse(req, {
        error: 'Informe de 1 a 100 comprovantes',
      }, 400);
    }
    if (items.some((item) =>
      !isSafePath(item.path)
      || (item.vendaId != null && !isValidUuid(item.vendaId))
    )) {
      return jsonResponse(req, { error: 'Comprovante inválido' }, 400);
    }

    const { data: isAdmin, error: roleError } = await access.supabase.rpc(
      'has_role',
      { _user_id: access.userId, _role: 'admin' },
    );
    if (roleError) throw roleError;

    let allowedItems = items as Array<{ vendaId?: string | null; path: string }>;
    if (!isAdmin) {
      if (allowedItems.some((item) => !isValidUuid(item.vendaId))) {
        return jsonResponse(req, {
          error: 'A venda é obrigatória para consultar o comprovante',
        }, 403);
      }

      const { data: profile, error: profileError } = await access.supabase
        .from('profiles')
        .select('id')
        .eq('user_id', access.userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return jsonResponse(req, { error: 'Acesso negado' }, 403);

      const { data: corretor, error: corretorError } = await access.supabase
        .from('corretores')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (corretorError) throw corretorError;
      if (!corretor) return jsonResponse(req, { error: 'Acesso negado' }, 403);

      const requestedVendaIds = [
        ...new Set(allowedItems.map((item) => item.vendaId as string)),
      ];
      const { data: allowedVendas, error: vendasError } = await access.supabase
        .from('vendas')
        .select('id, comprovantes')
        .eq('corretor_id', corretor.id)
        .in('id', requestedVendaIds);
      if (vendasError) throw vendasError;

      const allowedPairs = new Set(
        (allowedVendas || []).flatMap((venda) =>
          (venda.comprovantes || []).map((path: string) => `${venda.id}:${path}`)
        ),
      );
      allowedItems = allowedItems.filter((item) =>
        allowedPairs.has(`${item.vendaId}:${item.path}`)
      );
      if (allowedItems.length !== items.length) {
        return jsonResponse(req, { error: 'Acesso negado a um comprovante' }, 403);
      }
    }

    const uniquePaths = [...new Set(allowedItems.map((item) => item.path))];
    const { data, error } = await access.supabase.storage
      .from('comprovantes')
      .createSignedUrls(uniquePaths, 5 * 60);
    if (error) throw error;

    const urls = Object.fromEntries(
      (data || [])
        .filter((item) => item.signedUrl)
        .map((item) => [item.path, item.signedUrl]),
    );
    return jsonResponse(req, { urls, expires_in: 300 });
  } catch (error) {
    const message = safeError(error);
    console.error('Falha ao assinar comprovantes:', message);
    const status = message.includes('inválido')
      || message.includes('limite')
      || message.includes('JSON')
      ? 400
      : 500;
    return jsonResponse(req, {
      error: status === 500 ? 'Falha interna ao abrir comprovantes' : message,
    }, status);
  }
});
