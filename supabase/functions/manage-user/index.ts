import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

type AppRole = 'admin' | 'sdr' | 'closer' | 'corretor' | 'cliente';
type ManageAction = 'update' | 'delete' | 'toggle_active' | 'list';

interface ManageUserRequest {
  action?: ManageAction;
  user_id?: string;
  data?: {
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    email?: string;
    role?: AppRole;
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set<AppRole>(['admin', 'sdr', 'closer', 'corretor', 'cliente']);
const ROTULO_HISTORICO: Record<string, string> = {
  visitas: 'visita(s)', vendas: 'venda(s)', convites: 'chamado(s) de visita', leads: 'lead(s) sob responsabilidade', conversas: 'conversa(s)',
};

class ErroUsuario extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : undefined;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método não permitido' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const access = await authorize(req, 'admin');
  if (access instanceof Response) return access;

  try {
    const body = await readJson<ManageUserRequest>(req, 16 * 1024);
    const action = body.action;
    if (!action || !['list', 'update', 'toggle_active', 'delete'].includes(action)) {
      return jsonResponse(req, { error: 'Ação inválida' }, 400);
    }

    if (action === 'list') {
      const { data: authData, error: authError } =
        await access.supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authError) throw authError;

      const [{ data: profiles, error: profilesError }, {
        data: roles,
        error: rolesError,
      }] = await Promise.all([
        access.supabase
          .from('profiles')
          .select('id, user_id, first_name, last_name, phone, is_active, created_at'),
        access.supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const authById = new Map(authData.users.map((user) => [user.id, user]));
      const roleByUserId = new Map(
        (roles || []).map((role) => [role.user_id, role.role]),
      );
      const users = (profiles || []).map((profile) => {
        const authUser = authById.get(profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone || '',
          is_active: profile.is_active ?? true,
          created_at: profile.created_at,
          email: authUser?.email || '',
          last_sign_in_at: authUser?.last_sign_in_at || null,
          role: roleByUserId.get(profile.user_id) || 'cliente',
        };
      });
      return jsonResponse(req, { success: true, users });
    }

    if (!isUuid(body.user_id)) {
      return jsonResponse(req, { error: 'Usuário inválido' }, 400);
    }
    const userId = body.user_id;

    if (action === 'update') {
      const data = body.data;
      if (!data) return jsonResponse(req, { error: 'Dados obrigatórios' }, 400);

      const firstName = data.first_name === undefined
        ? undefined
        : cleanText(data.first_name, 80);
      const lastName = data.last_name === undefined
        ? undefined
        : cleanText(data.last_name, 120);
      const phone = data.phone === null
        ? null
        : cleanText(data.phone, 30);
      const email = data.email === undefined
        ? undefined
        : cleanText(data.email, 320)?.toLowerCase();
      const role = data.role;

      if (
        (data.first_name !== undefined && !firstName)
        || (data.last_name !== undefined && !lastName)
        || (email !== undefined && !EMAIL_PATTERN.test(email))
        || (role !== undefined && !ALLOWED_ROLES.has(role))
      ) {
        return jsonResponse(req, { error: 'Confira nome, sobrenome, e-mail e função.' }, 400);
      }
      if (email) {
        const { data: atual } = await access.supabase.auth.admin.getUserById(userId);
        if (atual?.user?.email?.toLowerCase() !== email) {
          const { data: dono } = await access.supabase.rpc('usuario_por_email', { p_email: email });
          if (dono) throw new ErroUsuario(409, `O e-mail ${email} já é de ${dono}.`);
        }
      }
      if (userId === access.userId && role && role !== 'admin') {
        return jsonResponse(req, {
          error: 'Você não pode remover seu próprio papel de administrador',
        }, 409);
      }

      const profileUpdate: Record<string, unknown> = {};
      if (firstName !== undefined) profileUpdate.first_name = firstName;
      if (lastName !== undefined) profileUpdate.last_name = lastName;
      if (data.phone !== undefined) profileUpdate.phone = phone || null;
      if (Object.keys(profileUpdate).length > 0) {
        const { error } = await access.supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('user_id', userId);
        if (error) throw error;
      }

      if (role) {
        const { error } = await access.supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role,
            created_by: access.userId,
          }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      const authUpdate: Record<string, unknown> = {};
      const metadata: Record<string, string> = {};
      if (firstName) metadata.first_name = firstName;
      if (lastName) metadata.last_name = lastName;
      if (Object.keys(metadata).length > 0) authUpdate.user_metadata = metadata;
      if (email) {
        authUpdate.email = email;
        authUpdate.email_confirm = true;
      }
      if (Object.keys(authUpdate).length > 0) {
        const { error } = await access.supabase.auth.admin.updateUserById(
          userId,
          authUpdate,
        );
        if (error) throw error;
      }

      return jsonResponse(req, { success: true });
    }

    if (userId === access.userId) {
      return jsonResponse(req, {
        error: action === 'delete'
          ? 'Você não pode excluir sua própria conta'
          : 'Você não pode desativar sua própria conta',
      }, 409);
    }

    if (action === 'toggle_active') {
      const { data: profile, error: fetchError } = await access.supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!profile) return jsonResponse(req, { error: 'Usuário não encontrado' }, 404);

      const isActive = !(profile.is_active ?? true);
      const { error: updateError } = await access.supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);
      if (updateError) throw updateError;

      const { error: authError } =
        await access.supabase.auth.admin.updateUserById(userId, {
          ban_duration: isActive ? 'none' : '876000h',
        });
      if (authError) {
        await access.supabase
          .from('profiles')
          .update({ is_active: !isActive })
          .eq('user_id', userId);
        throw authError;
      }
      return jsonResponse(req, { success: true, is_active: isActive });
    }

    // Excluir apagaria (ou deixaria órfão) o histórico de visitas, vendas e leads: nesses casos, só desativar
    const { data: historico, error: histError } = await access.supabase.rpc('usuario_historico', { p_user: userId });
    if (histError) throw histError;
    const itens = Object.entries((historico ?? {}) as Record<string, number>).filter(([, n]) => n > 0);
    if (itens.length) {
      const lista = itens.map(([k, n]) => `${n} ${ROTULO_HISTORICO[k] ?? k}`).join(', ');
      throw new ErroUsuario(409, `Este usuário tem histórico (${lista}). Para não perder esse histórico, use Desativar: ele perde o acesso e sai das sugestões, sem apagar nada.`);
    }
    const { error: deleteError } =
      await access.supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      if (/database error/i.test(deleteError.message ?? '')) {
        throw new ErroUsuario(409, 'Este usuário tem registros ligados a ele no sistema. Use Desativar: ele perde o acesso sem apagar nada.');
      }
      throw deleteError;
    }
    return jsonResponse(req, { success: true });
  } catch (error) {
    if (error instanceof ErroUsuario) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    const message = safeError(error);
    console.error('Falha ao gerenciar usuário:', message);
    return jsonResponse(req, {
      error: /already|registered|exists/i.test(message)
        ? 'Este e-mail já é de outro usuário.'
        : 'Não foi possível concluir. Tente de novo; se repetir, avise o suporte.',
    }, /already|registered|exists/i.test(message) ? 409 : 500);
  }
});
