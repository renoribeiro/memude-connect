import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format values into Brazilian Reais (BRL)', () => {
      const value = 1500.5;
      const formatted = formatCurrency(value);
      
      // Use clean string compare or check content because of spaces differences in Intl (non-breaking spaces)
      expect(formatted).toContain('R$');
      expect(formatted).toContain('1.500,50');
    });

    it('should handle zero correctly', () => {
      const formatted = formatCurrency(0);
      expect(formatted).toContain('0,00');
    });
  });
});
