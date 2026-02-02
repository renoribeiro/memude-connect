/**
 * Utilitários para normalização e validação de números de telefone brasileiros
 * Versão Deno para Edge Functions
 * Garante compatibilidade com Evolution API V2
 */

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
  let digits = phone.replace(/\D/g, '');

  // 1. Garantir DDI 55
  // Se tem 13 ou 12 dígitos e começa com 55, ok.
  // Se tem menos, adiciona.
  // Caso especial: 12 dígitos começando com 55 (sem 9 dígito) -> ok, trata abaixo.
  // Caso especial: 10 ou 11 dígitos (sem 55) -> adiciona.

  if (!digits.startsWith('55')) {
    digits = `55${digits}`;
  }

  // Agora digits deve ter 55 (2 chars) + DDD (2 chars) + Numero (8 ou 9 chars).
  // Total esperado: 12 ou 13 chars.

  // Caso: 12 dígitos (55 + DDD + 8 digitos). Ex: 558596227722
  // Falta o nono dígito.
  if (digits.length === 12) {
    const ddi = digits.substring(0, 2); // 55
    const ddd = digits.substring(2, 4); // 85
    const num = digits.substring(4);    // 96227722 (8 chars)

    // Inserir o 9
    return `${ddi}${ddd}9${num}`;
  }

  // Caso: 13 dígitos (55 + DDD + 9 digitos). Ex: 5585996227722
  if (digits.length === 13) {
    return digits;
  }

  // Casos estranhos (ex: só número local 8 digitos sem DDD), assume DDD 85 (CE) como fallback legado do sistema
  if (digits.length === 8) {
    return `55859${digits}`; // Adiciona 55 + 85 + 9
  }
  if (digits.length === 9) {
    return `5585${digits}`; // Adiciona 55 + 85
  }

  return digits;
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
