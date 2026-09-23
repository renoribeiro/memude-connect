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
  /** Quando false, cria a conta sem disparar email de convite. */
  send_invite?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set<AppRole>(['admin', 'corretor', 'cliente']);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * Senha aleatória para contas criadas sem convite. Não é retornada, exibida
 * nem transmitida: serve só para a conta existir. A pessoa define a dela pelo
 * fluxo de "esqueci minha senha" quando o acesso for liberado.
 */
function throwawayPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `Mc-${btoa(String.fromCharCode(...bytes)).slice(0, 40)}`;
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
    // Convite é o padrão: só não envia quando o admin desmarca explicitamente.
    const sendInvite = body.send_invite !== false;

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

    if (sendInvite) {
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
    } else {
      // Conta criada em silêncio, sem email: contorna o limite de envio do
      // SMTP e serve para cadastro em lote. A senha é descartável e ninguém
      // a conhece — o acesso se dá depois, por "esqueci minha senha".
      const { data: userData, error: userError } =
        await access.supabase.auth.admin.createUser({
          email,
          password: throwawayPassword(),
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });
      if (userError || !userData.user) {
        throw userError || new Error('Falha ao criar usuário');
      }
      createdUserId = userData.user.id;
    }

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
      invitation_sent: sendInvite,
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
    console.error('Falha ao criar usuário:', message);
    const duplicate = /already|registered|exists/i.test(message);
    const rateLimited = /rate limit/i.test(message);
    return jsonResponse(req, {
      error: duplicate
        ? 'Já existe uma conta com este email'
        : rateLimited
          ? 'Limite de envio de email do Supabase atingido. Desmarque "Enviar convite por email" para cadastrar agora sem disparar email.'
          : 'Não foi possível criar o convite de usuário',
    }, duplicate ? 409 : 400);
  }
});
