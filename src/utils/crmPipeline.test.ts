import { describe, expect, it } from 'vitest';
import { sumEstimatedOpportunityValue } from './crmPipeline';

describe('sumEstimatedOpportunityValue', () => {
  it('soma os valores previstos de todas as oportunidades da etapa', () => {
    expect(sumEstimatedOpportunityValue([
      { valor_estimado: 350_000 },
      { valor_estimado: 499_900.5 },
      { valor_estimado: null },
    ])).toBe(849_900.5);
  });

  it('ignora valores ausentes ou inválidos sem produzir NaN', () => {
    expect(sumEstimatedOpportunityValue([
      { valor_estimado: undefined },
      { valor_estimado: '125000.25' },
      { valor_estimado: 'valor inválido' },
    ])).toBe(125_000.25);
  });
});
