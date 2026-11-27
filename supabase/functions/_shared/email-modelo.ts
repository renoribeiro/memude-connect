// Modelo único dos e-mails da MeMude (identidade visual: roxo #422F91, rosa #E92662, fundo lilás claro).
// Feito com tabelas e estilos em linha para funcionar no Gmail, Outlook e celular.

export const COR = { roxo: '#422F91', rosa: '#E92662', lilas: '#F1EFFA', texto: '#1E1640', suave: '#6B6585', borda: '#ECE9F5' };
export const LOGO = 'https://www.memude.com.br/wp-content/themes/memudev2/assets/images/Logo-1.png';
const F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export const escapar = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface EmailMeMude {
  /** Texto curto que aparece ao lado do assunto na caixa de entrada */
  previa: string;
  /** Selo acima do título (ex.: "BOAS-VINDAS", "RELATÓRIO") */
  selo?: string;
  titulo: string;
  /** Parágrafos em HTML já seguro (use escapar() em dados de fora) */
  paragrafos: string[];
  botao?: { texto: string; url: string };
  /** Bloco destacado (lilás) depois dos parágrafos, em HTML já seguro */
  destaque?: string;
  /** Linha final, abaixo do link de reserva */
  rodape?: string;
}

/** Monta o HTML completo do e-mail com a identidade da MeMude. */
export function emailMeMude(e: EmailMeMude): string {
  const botao = e.botao ? `
    <tr><td align="center" style="padding:24px 40px 4px;">
      <a href="${escapar(e.botao.url)}" target="_blank" style="display:inline-block;background:${COR.rosa};color:#ffffff;${F}font-size:16px;font-weight:700;text-decoration:none;padding:15px 34px;border-radius:999px;">${escapar(e.botao.texto)}</a>
    </td></tr>
    <tr><td style="padding:18px 40px 0;${F}font-size:12px;line-height:18px;color:${COR.suave};">
      Se o botão não abrir, copie e cole este endereço no navegador:<br>
      <a href="${escapar(e.botao.url)}" style="color:${COR.roxo};word-break:break-all;">${escapar(e.botao.url)}</a>
    </td></tr>` : '';
  const destaque = e.destaque ? `
    <tr><td style="padding:20px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:${COR.lilas};border-radius:14px;padding:16px 18px;${F}font-size:14px;line-height:21px;color:${COR.texto};">${e.destaque}</td></tr>
    </table></td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapar(e.titulo)}</title></head>
<body style="margin:0;padding:0;background:${COR.lilas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(e.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.lilas};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;">
    <tr><td style="height:6px;background:${COR.roxo};background-image:linear-gradient(90deg,${COR.roxo},${COR.rosa});font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:30px 40px 8px;">
      <img src="${LOGO}" alt="MeMude" height="36" style="height:36px;display:block;border:0;">
    </td></tr>
    <tr><td style="padding:18px 40px 0;${F}">
      ${e.selo ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COR.rosa};">${escapar(e.selo)}</p>` : ''}
      <h1 style="margin:0 0 14px;font-size:24px;line-height:30px;font-weight:800;color:${COR.texto};">${escapar(e.titulo)}</h1>
      ${e.paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:23px;color:${COR.texto};">${p}</p>`).join('')}
    </td></tr>
    ${destaque}
    ${botao}
    <tr><td style="padding:30px 40px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${COR.borda};padding-top:18px;${F}font-size:12px;line-height:18px;color:${COR.suave};text-align:center;">
        ${e.rodape ? `${e.rodape}<br>` : ''}
        <strong style="color:${COR.roxo};">Portal MeMude</strong> · <a href="https://www.memude.com.br" style="color:${COR.suave};">memude.com.br</a><br>
        E-mail automático. Não precisa responder.
      </td></tr></table>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
