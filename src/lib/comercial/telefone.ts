// Mesma regra de public.normalize_phone_* no banco (validada com os 4 formatos do documento).
export function telefoneCanonico(bruto: string | null | undefined): string | null {
  let texto = (bruto ?? '').trim();
  let digitos = texto.replace(/\D/g, '');
  if (!digitos) return null;
  if (texto.startsWith('00')) {
    digitos = digitos.slice(2);
    texto = `+${digitos}`;
  }
  if (texto.startsWith('+') && !digitos.startsWith('55')) return digitos;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return digitos;
  const ddd = digitos.slice(0, 2);
  let assinante = digitos.slice(2);
  if (assinante.length === 8 && /^[6-9]/.test(assinante)) assinante = `9${assinante}`;
  return `55${ddd}${assinante}`;
}

const brasileiro = (c: string) => (c.length === 12 || c.length === 13) && c.startsWith('55');

export function chaveTelefone(bruto: string | null | undefined): string | null {
  const c = telefoneCanonico(bruto);
  if (!c) return null;
  if (!brasileiro(c)) return `INT-${c}`;
  const nacional = c.slice(2);
  return `${nacional.slice(0, 2)}-${nacional.slice(2).slice(-8)}`;
}

export function telefoneExibicao(bruto: string | null | undefined): string {
  const c = telefoneCanonico(bruto);
  if (!c) return '';
  if (!brasileiro(c)) return `+${c}`;
  const assinante = c.slice(4);
  return `55 ${c.slice(2, 4)} ${assinante.slice(0, -4)}-${assinante.slice(-4)}`;
}

export function telefoneValido(bruto: string | null | undefined): boolean {
  const d = (bruto ?? '').replace(/\D/g, '');
  return d.length >= 10 && chaveTelefone(bruto) !== null;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const c = telefoneCanonico(telefone);
  if (!c) return null;
  return `https://wa.me/${c}?text=${encodeURIComponent(texto)}`;
}
