export interface CrmValue {
  valor_estimado: number | null;
  vendas?: { valor_imovel: number; status: string } | null;
}

export function crmCardValue(card: CrmValue): number {
  const raw = card.vendas
    ? (card.vendas.status === 'cancelada' ? 0 : card.vendas.valor_imovel)
    : card.valor_estimado;
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function crmColumnVgv(cards: CrmValue[]): number {
  return cards.reduce((cents, card) => cents + Math.round(crmCardValue(card) * 100), 0) / 100;
}
