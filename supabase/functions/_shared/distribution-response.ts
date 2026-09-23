export interface DistributionResponse {
  type: 'accepted' | 'rejected' | 'unclear';
  confidence: number;
}

const ACCEPT_EXACT = new Set([
  '1', 's', 'sim', 'yes', 'y', 'ok', 'aceito', 'aceitar', 'confirmo',
  'confirmado', 'quero', 'topo', 'pode', 'pode agendar',
  'accept lead', 'accept visit', 'accept visita',
]);

const REJECT_EXACT = new Set([
  '2', 'n', 'nao', 'no', 'recuso', 'recusar', 'negativo', 'cancelar',
  'reject lead', 'reject visit', 'reject visita',
]);

function normalizeResponse(message: string): string {
  return message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function analyzeDistributionResponse(message: string): DistributionResponse {
  const text = normalizeResponse(message);
  if (!text) return { type: 'unclear', confidence: 0 };

  if (ACCEPT_EXACT.has(text)) return { type: 'accepted', confidence: 10 };
  if (REJECT_EXACT.has(text)) return { type: 'rejected', confidence: 10 };

  const words = new Set(text.split(' '));
  const negatives = ['nao', 'recuso', 'recusar', 'negativo', 'impossivel', 'ocupado', 'cancelar']
    .filter((word) => words.has(word));
  const positives = ['sim', 'aceito', 'aceitar', 'confirmo', 'confirmado', 'quero', 'topo']
    .filter((word) => words.has(word));

  // A negação explícita prevalece em frases naturais como "não posso".
  if (negatives.length > 0) return { type: 'rejected', confidence: negatives.length };
  if (positives.length > 0) return { type: 'accepted', confidence: positives.length };

  return { type: 'unclear', confidence: 0 };
}
