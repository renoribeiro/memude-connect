import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { authorize, readJson } from "../_shared/security.ts";
import { emailMeMude, escapar } from "../_shared/email-modelo.ts";

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
      subject: "Bem-vindo ao MeMude Connect · crie sua senha",
      html: emailMeMude({
        previa: "Sua conta no MeMude Connect está pronta. Falta só criar sua senha.",
        selo: "Boas-vindas",
        titulo: `Olá, ${name || "corretor"}! Que bom ter você com a gente.`,
        paragrafos: [
          "Sua conta no <strong>MeMude Connect</strong> foi criada. É por ele que você recebe os clientes, conversa pelo WhatsApp e acompanha suas visitas e comissões.",
          "Para entrar, crie sua senha no botão abaixo.",
        ],
        destaque: `<strong>Seus dados de acesso</strong><br>E-mail: ${escapar(email)}${creci ? `<br>CRECI: ${escapar(creci)}` : ""}`,
        botao: { texto: "Criar minha senha", url: resetUrl },
        rodape: "Você também vai receber uma mensagem no WhatsApp com as próximas instruções.",
      }),
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
