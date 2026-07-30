import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { authorize, readJson } from "../_shared/security.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://core.memudecore.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  creci: string;
  resetUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const access = await authorize(req, "admin-or-internal");
    if (access instanceof Response) return access;

    const { email, name, creci, resetUrl }: WelcomeEmailRequest = await readJson(req, 1024 * 1024);

    console.log("Sending welcome email");

    const emailResponse = await resend.emails.send({
      from: "MeMude Connect <noreply@memude.com>",
      to: [email],
      subject: "Bem-vindo ao MeMude Connect - Configure sua Senha",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; font-size: 28px; margin-bottom: 10px;">Bem-vindo ao MeMude Connect!</h1>
            <p style="color: #64748b; font-size: 16px;">Sistema de Gestão Imobiliária</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; font-size: 22px; margin-bottom: 20px;">Olá, ${name}!</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Sua conta foi criada com sucesso no MeMude Connect. Você agora faz parte da nossa equipe de corretores!
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 15px;">Seus dados de acesso:</h3>
              <p style="color: #64748b; margin-bottom: 8px;"><strong>Email:</strong> ${email}</p>
              <p style="color: #64748b; margin-bottom: 8px;"><strong>CRECI:</strong> ${creci}</p>
            </div>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Para começar a usar o sistema, você precisa definir sua senha. Clique no botão abaixo:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Definir Senha
              </a>
            </div>
          </div>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #92400e; font-size: 16px; margin-bottom: 10px;">📱 WhatsApp</h3>
            <p style="color: #92400e; font-size: 14px;">
              Você também receberá uma mensagem no WhatsApp com instruções adicionais.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">
              Se você não conseguir clicar no botão, copie e cole este link no seu navegador:
            </p>
            <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetUrl}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px;">
              MeMude Connect - Sistema de Gestão Imobiliária<br>
              Este é um email automático, não responda a esta mensagem.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Welcome email sent successfully");

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
