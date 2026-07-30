import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

type AppRole = 'admin' | 'corretor' | 'cliente';

interface CreateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: AppRole;
  phone?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set<AppRole>(['admin', 'corretor', 'cliente']);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
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

  let createdUserId: string | null = null;
  try {
    const body = await readJson<CreateUserRequest>(req, 8 * 1024);
    const email = cleanText(body.email, 320).toLowerCase();
    const firstName = cleanText(body.first_name, 80);
    const lastName = cleanText(body.last_name, 120);
    const phone = cleanText(body.phone, 30);
    const role = body.role;

    if (
      !EMAIL_PATTERN.test(email)
      || !firstName
      || !lastName
      || !role
      || !ALLOWED_ROLES.has(role)
    ) {
      return jsonResponse(req, { error: 'Dados do usuário inválidos' }, 400);
    }

    const configuredAppUrl = Deno.env.get('APP_URL')?.trim()
      || 'https://core.memudecore.com.br';
    const appUrl = new URL(configuredAppUrl);
    if (
      appUrl.protocol !== 'https:'
      || (
        appUrl.hostname !== 'memudecore.com.br'
        && !appUrl.hostname.endsWith('.memudecore.com.br')
        && !appUrl.hostname.endsWith('.vercel.app')
      )
    ) {
      throw new Error('APP_URL inválida');
    }

    // O Supabase envia um convite de uso único. Nenhuma senha temporária é
    // criada, exibida na interface ou transmitida por email/WhatsApp.
    const { data: inviteData, error: inviteError } =
      await access.supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: new URL('/reset-password', appUrl).toString(),
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      });
    if (inviteError || !inviteData.user) {
      throw inviteError || new Error('Falha ao criar convite');
    }
    createdUserId = inviteData.user.id;

    const { error: profileError } = await access.supabase
      .from('profiles')
      .upsert({
        user_id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const { error: clearRoleError } = await access.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', createdUserId);
    if (clearRoleError) throw clearRoleError;

    const { error: roleError } = await access.supabase
      .from('user_roles')
      .insert({
        user_id: createdUserId,
        role,
        created_by: access.userId,
      });
    if (roleError) throw roleError;

    return jsonResponse(req, {
      success: true,
      invitation_sent: true,
      user: {
        id: createdUserId,
        email,
      },
    }, 201);
  } catch (error) {
    if (createdUserId) {
      await access.supabase.auth.admin.deleteUser(createdUserId);
    }
    const message = safeError(error);
    console.error('Falha ao convidar usuário:', message);
    const duplicate = /already|registered|exists/i.test(message);
    return jsonResponse(req, {
      error: duplicate
        ? 'Já existe uma conta com este email'
        : 'Não foi possível criar o convite de usuário',
    }, duplicate ? 409 : 400);
  }
});
