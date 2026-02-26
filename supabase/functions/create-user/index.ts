import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // SECURITY: Verify caller is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Get the user from the JWT token
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Check if caller has admin role
    const { data: callerRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !callerRoles) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const { email, password, first_name, last_name, role, phone } = await req.json();

    console.log('Creating user with email:', email);

    // Create user in auth
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role
      }
    });

    if (createUserError) {
      console.error('Auth error:', createUserError);
      throw createUserError;
    }

    console.log('User created in auth:', authData.user?.id);

    // Check for orphaned profile and delete if exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user!.id)
      .maybeSingle();

    if (existingProfile) {
      console.log('Found orphaned profile, deleting...');
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', authData.user!.id);
    }

    // Create profile (without role - using user_roles table now)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user!.id,
        first_name,
        last_name,
        phone: phone || null
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user!.id);
      throw profileError;
    }

    console.log('Profile created successfully');

    // Create user role in user_roles table
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user!.id,
        role: role,
        created_by: callerUser.id
      });

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError);
      // If role creation fails, delete the auth user and profile
      await supabaseAdmin.auth.admin.deleteUser(authData.user!.id);
      throw roleInsertError;
    }

    console.log('User role assigned successfully');

    // Attempt to send Welcome Email with Credentials
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const loginUrl = Deno.env.get("APP_URL") || "https://sistema.memudecore.com.br";

        const roleNames = {
          'admin': 'Administrador',
          'corretor': 'Corretor',
          'cliente': 'Cliente'
        };
        const displayRole = roleNames[role as keyof typeof roleNames] || role;

        console.log(`Sending welcome email to: ${email}`);
        await resend.emails.send({
          from: "MeMude Connect <noreply@memude.com>",
          to: [email],
          subject: "Sua conta foi criada no MeMude Connect",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; font-size: 28px; margin-bottom: 10px;">Bem-vindo ao MeMude Connect!</h1>
                <p style="color: #64748b; font-size: 16px;">Sistema de Gestão Imobiliária</p>
              </div>
              
              <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                <h2 style="color: #1e293b; font-size: 22px; margin-bottom: 20px;">Olá, ${first_name}!</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Sua conta de <strong>${displayRole}</strong> foi criada com sucesso pelo nosso administrador. 
                  Você já pode acessar o sistema usando as credenciais abaixo:
                </p>
                
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
                  <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 15px;">Suas Credenciais:</h3>
                  <p style="color: #64748b; margin-bottom: 8px;"><strong>Email:</strong> ${email}</p>
                  <p style="color: #64748b; margin-bottom: 8px;"><strong>Senha Padrão:</strong> ${password}</p>
                </div>
                
                <p style="color: #ef4444; font-size: 14px; margin-bottom: 30px;">
                  <em>Recomendamos que você altere sua senha após o primeiro login por motivos de segurança.</em>
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" 
                     style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Acessar o Sistema
                  </a>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px;">
                  MeMude Connect - Todos os direitos reservados.<br>
                  Este é um email automático, por favor não responda.
                </p>
              </div>
            </div>
          `,
        });
        console.log('Welcome email sent successfully');
      } else {
        console.warn('RESEND_API_KEY is not configured. Skipping welcome email.');
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // We don't fail the user creation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user!.id,
          email: authData.user!.email
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in create-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});