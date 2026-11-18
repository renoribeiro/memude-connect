// Mesma regra de public.normalize_phone_canonical / normalize_phone_key (banco).
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

export function chaveTelefone(bruto: string | null | undefined): string | null {
  const c = telefoneCanonico(bruto);
  if (!c) return null;
  if ((c.length === 12 || c.length === 13) && c.startsWith('55')) {
    const nacional = c.slice(2);
    return `${nacional.slice(0, 2)}-${nacional.slice(2).slice(-8)}`;
  }
  return `INT-${c}`;
}
