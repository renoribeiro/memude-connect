import { describe, expect, it } from 'vitest';
import { crmCardValue, crmColumnVgv } from './crmSales';

describe('VGV do CRM', () => {
  it('usa venda real em vez da estimativa e não soma ambos', () => {
    expect(crmCardValue({ valor_estimado: 200, vendas: { valor_imovel: 350, status: 'pendente' } })).toBe(350);
  });
  it('soma valores em centavos, inclusive mais de 500 oportunidades', () => {
    expect(crmColumnVgv(Array.from({ length: 501 }, () => ({ valor_estimado: 0.1 })))).toBe(50.1);
    expect(crmColumnVgv([{ valor_estimado: 0.1 }, { valor_estimado: 0.2 }])).toBe(0.3);
  });
  it('não contabiliza valores ausentes, inválidos, negativos ou vendas canceladas', () => {
    expect(crmColumnVgv([{ valor_estimado: null }, { valor_estimado: NaN }, { valor_estimado: -20 },
      { valor_estimado: 50, vendas: { valor_imovel: 100, status: 'cancelada' } }])).toBe(0);
    expect(crmColumnVgv([])).toBe(0);
  });
});
