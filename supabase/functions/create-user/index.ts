import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
} from '../_shared/security.ts';

type AppRole = 'admin' | 'sdr' | 'closer' | 'corretor' | 'cliente';

interface DadosCorretor {
  creci?: string;
  cpf?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  tipo_imovel?: string;
  observacoes?: string;
}

interface CreateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: AppRole;
  phone?: string;
  /** Quando false, cria a conta sem disparar email de convite. */
  send_invite?: boolean;
  /** Obrigatório quando role = corretor: gravado junto, na mesma operação. */
  corretor?: DadosCorretor;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set<AppRole>(['admin', 'sdr', 'closer', 'corretor', 'cliente']);

class ErroUsuario extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const soDigitos = (v: string) => v.replace(/\D/g, '');

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

    if (!firstName || !lastName) throw new ErroUsuario(400, 'Preencha nome e sobrenome.');
    if (!EMAIL_PATTERN.test(email)) throw new ErroUsuario(400, 'Confira o e-mail: ele parece incompleto.');
    if (!role || !ALLOWED_ROLES.has(role)) throw new ErroUsuario(400, 'Escolha a função do usuário.');

    // Dados do corretor validados ANTES de criar a conta (nada fica pela metade)
    const c = body.corretor ?? {};
    const creci = cleanText(c.creci, 30).toUpperCase();
    const whatsapp = soDigitos(cleanText(c.whatsapp, 30) || phone);
    if (role === 'corretor') {
      if (!creci) throw new ErroUsuario(400, 'Informe o CRECI do corretor.');
      if (whatsapp.length < 10) throw new ErroUsuario(400, 'Informe o WhatsApp do corretor com DDD.');
      const { data: dono } = await access.supabase.rpc('usuario_creci_em_uso', { p_creci: creci });
      if (dono) throw new ErroUsuario(409, `O CRECI ${creci} já está cadastrado para ${dono}.`);
    }

    // E-mail já usado: diz de quem é, para o admin editar a conta certa
    const { data: existente } = await access.supabase.rpc('usuario_por_email', { p_email: email });
    if (existente) {
      throw new ErroUsuario(409, `O e-mail ${email} já é de ${existente}. Use outro e-mail ou edite esse usuário na lista.`);
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

    const { data: perfil, error: profileError } = await access.supabase
      .from('profiles')
      .upsert({
        user_id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (profileError) throw profileError;

    const { error: clearRoleError } = await access.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', createdUserId);
    if (clearRoleError) throw clearRoleError;

    // Papel corretor: o banco cria a ficha do corretor (CRECI provisório); aqui ela é completada
    const { error: roleError } = await access.supabase
      .from('user_roles')
      .insert({
        user_id: createdUserId,
        role,
        created_by: access.userId,
      });
    if (roleError) throw roleError;

    if (role === 'corretor') {
      const ficha = {
        creci,
        cpf: soDigitos(cleanText(c.cpf, 20)) || null,
        whatsapp,
        telefone: phone || null,
        cidade: cleanText(c.cidade, 80) || null,
        estado: cleanText(c.estado, 2).toUpperCase() || 'CE',
        tipo_imovel: cleanText(c.tipo_imovel, 20) || 'todos',
        observacoes: cleanText(c.observacoes, 2000) || null,
        status: 'ativo',   // cadastrado pelo admin: já entra nas sugestões de visita
      };
      const { data: atualizado, error: corretorError } = await access.supabase
        .from('corretores').update(ficha).eq('profile_id', perfil.id).select('id');
      if (corretorError) throw corretorError;
      if (!atualizado?.length) {
        const { error: insertError } = await access.supabase
          .from('corretores').insert({ profile_id: perfil.id, nota_media: 5, total_visitas: 0, ...ficha });
        if (insertError) throw insertError;
      }
    }

    return jsonResponse(req, {
      success: true,
      invitation_sent: sendInvite,
      user: {
        id: createdUserId,
        email,
      },
    }, 201);
  } catch (error) {
    // Desfaz a conta criada: nada fica pela metade (perfil, papel e ficha do corretor caem junto)
    if (createdUserId) {
      await access.supabase.auth.admin.deleteUser(createdUserId);
    }
    if (error instanceof ErroUsuario) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    const message = safeError(error);
    console.error('Falha ao criar usuário:', message);
    const duplicate = /already|registered|exists/i.test(message);
    const rateLimited = /rate limit/i.test(message);
    const creciDuplicado = /creci/i.test(message) && /duplicate|unique/i.test(message);
    const enumInvalido = /invalid input value for enum/i.test(message);
    return jsonResponse(req, {
      error: duplicate
        ? 'Já existe uma conta com este e-mail. Use outro e-mail ou edite esse usuário na lista.'
        : creciDuplicado
          ? 'Este CRECI já está cadastrado para outro corretor.'
          : enumInvalido
            ? 'Confira o estado e o tipo de imóvel do corretor.'
            : rateLimited
              ? 'Limite de envio de e-mail atingido. Desmarque "Enviar convite por e-mail" para cadastrar agora sem disparar e-mail.'
              : 'Não foi possível criar o usuário. Tente de novo; se repetir, avise o suporte.',
    }, duplicate || creciDuplicado ? 409 : 400);
  }
});
