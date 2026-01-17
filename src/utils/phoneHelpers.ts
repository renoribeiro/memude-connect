/**
 * Utilitários para normalização e validação de números de telefone brasileiros
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
  const digits = phone.replace(/\D/g, '');
  
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
 * Remove a formatação do número, mantendo apenas dígitos
 * 
 * @param phone - Número formatado
 * @returns Apenas dígitos
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}
