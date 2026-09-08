/**
 * Utilitários para normalização e validação de números de telefone
 * Garante compatibilidade com Evolution API V2
 *
 * Números brasileiros são guardados só em dígitos (5585996227722). Números do
 * exterior são guardados em E.164, com o "+" na frente (+351912345678): é o "+"
 * que marca o número como estrangeiro e impede que o DDI 55 seja injetado nele.
 */

/**
 * Diz se o número é do exterior — veio com "+" e DDI diferente de 55.
 */
export function isInternationalPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return phone.trim().startsWith('+') && !phone.replace(/\D/g, '').startsWith('55');
}

/**
 * Normaliza número de telefone brasileiro para formato Evolution API
 * Aceita: (85) 99622-7722, 85996227722, 85 99622-7722, +55 85 99622-7722, etc
 * Retorna: 5585996227722
 * 
 * @param phone - Número em qualquer formato
 * @returns Número normalizado no formato 55DDXXXXXXXXX
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');

  // Número do exterior: preserva o DDI que veio. Sem esta saída, um +351 vira
  // 55351... e o contato fica inalcançável.
  if (isInternationalPhone(phone)) {
    return `+${digits}`;
  }
  
  // Se já tem 13 dígitos e começa com 55, retorna
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits;
  }
  
  // Se tem 12 dígitos (sem o 55), adiciona DDI 55
  if (digits.length === 12) {
    return `55${digits}`;
  }
  
  // Se tem 11 dígitos (DDXXXXXXXXX), adiciona DDI 55
  if (digits.length === 11) {
    return `55${digits}`;
  }
  
  // Se tem 10 dígitos (XXXXXXXXXX), assume DDD 85 e adiciona DDI 55
  if (digits.length === 10) {
    return `5585${digits}`;
  }
  
  // Se tem 9 dígitos (XXXXXXXXX), assume DDD 85 e adiciona DDI 55
  if (digits.length === 9) {
    return `5585${digits}`;
  }
  
  // Para números menores, assume DDD 85 e adiciona DDI 55
  if (digits.length < 9) {
    return `5585${digits}`;
  }
  
  // Caso contrário, retorna como está com DDI
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * Formata número para exibição com máscara
 * 5585996227722 -> (85) 99622-7722
 * 
 * @param phone - Número normalizado ou qualquer formato
 * @returns Número formatado para exibição
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const normalized = normalizePhoneNumber(phone);

  // Do exterior não dá para aplicar máscara: o formato muda por país.
  // Exibe em E.164 mesmo, que é inequívoco.
  if (normalized.startsWith('+')) return normalized;

  // Se não tem 13 dígitos, retorna original
  if (normalized.length !== 13) return phone;
  
  // Extrai partes: 55 + DDD (2) + XXXXX (5) + XXXX (4)
  const ddd = normalized.substring(2, 4);
  const part1 = normalized.substring(4, 9);
  const part2 = normalized.substring(9, 13);
  
  return `(${ddd}) ${part1}-${part2}`;
}

/**
 * Valida se é um número de celular brasileiro válido
 * 
 * @param phone - Número em qualquer formato
 * @returns true se válido, false caso contrário
 */
export function isValidBrazilianPhone(phone: string): boolean {
  if (!phone) return false;
  
  const normalized = normalizePhoneNumber(phone);
  
  // Deve ter 13 dígitos (55 + DDD + número)
  if (normalized.length !== 13) return false;
  
  // Deve começar com 55
  if (!normalized.startsWith('55')) return false;
  
  // DDD válido (11-99)
  const ddd = parseInt(normalized.substring(2, 4));
  if (ddd < 11 || ddd > 99) return false;
  
  // Primeiro dígito do celular deve ser 9
  if (normalized[4] !== '9') return false;
  
  return true;
}

/**
 * Valida um número do exterior em E.164: DDI que não começa em zero e de 8 a
 * 15 dígitos no total. Não valida regra de operadora — isso varia por país.
 */
export function isValidInternationalPhone(phone: string): boolean {
  if (!isInternationalPhone(phone)) return false;
  return /^[1-9]\d{7,14}$/.test(phone.replace(/\D/g, ''));
}

/**
 * Valida celular brasileiro OU número do exterior.
 */
export function isValidPhone(phone: string): boolean {
  return isValidBrazilianPhone(phone) || isValidInternationalPhone(phone);
}

/**
 * Remove a formatação do número, mantendo apenas dígitos
 * 
 * @param phone - Número formatado
 * @returns Apenas dígitos
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}
