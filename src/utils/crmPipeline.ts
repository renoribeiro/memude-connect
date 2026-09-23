export interface EstimatedOpportunity {
  valor_estimado: number | string | null | undefined;
}

export function sumEstimatedOpportunityValue(
  opportunities: EstimatedOpportunity[],
): number {
  return opportunities.reduce((total, opportunity) => {
    const value = Number(opportunity.valor_estimado ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}
