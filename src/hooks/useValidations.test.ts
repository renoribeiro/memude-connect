import { describe, it, expect, vi } from 'vitest';

// Mock UI toast dependency to prevent loading errors in Node
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import {
  leadValidationSchema,
  corretorValidationSchema,
  distributionSettingsSchema,
  whatsappMessageSchema,
} from './useValidations';

describe('useValidations Zod Schemas', () => {
  describe('leadValidationSchema', () => {
    it('should validate complete and correct lead data', () => {
      const validLead = {
        nome: 'João Silva',
        telefone: '85996227722',
        email: 'joao@exemplo.com',
        data_visita_solicitada: new Date(Date.now() + 86400000), // tomorrow
        horario_visita_solicitada: '14:30',
        empreendimento_id: 'd8c47b56-749e-4efc-8b89-a29243a41144'
      };

      const result = leadValidationSchema.safeParse(validLead);
      expect(result.success).toBe(true);
    });

    it('should fail if nome is too short', () => {
      const invalidLead = {
        nome: 'J',
        telefone: '85996227722',
        data_visita_solicitada: new Date(Date.now() + 86400000), // future date to isolate failure
        horario_visita_solicitada: '14:30',
        empreendimento_id: 'd8c47b56-749e-4efc-8b89-a29243a41144'
      };

      const result = leadValidationSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Nome deve ter pelo menos 2 caracteres');
      }
    });

    it('should fail on invalid email pattern', () => {
      const invalidLead = {
        nome: 'João Silva',
        telefone: '85996227722',
        email: 'joao-invalido',
        data_visita_solicitada: new Date(Date.now() + 86400000),
        horario_visita_solicitada: '14:30',
        empreendimento_id: 'd8c47b56-749e-4efc-8b89-a29243a41144'
      };

      const result = leadValidationSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
    });
  });

  describe('corretorValidationSchema', () => {
    const baseCorretor = {
      profile_id: 'e6a82ba9-3642-45e3-85bb-23cc81a243bb',
      whatsapp: '85996227722',
      creci: '12345-F'
    };

    it('should validate broker profile with correct mathematical CPF', () => {
      // Mathematically valid test CPF calculated by loop
      const result = corretorValidationSchema.safeParse({
        ...baseCorretor,
        cpf: '10000000019'
      });
      expect(result.success).toBe(true);
    });

    it('should fail broker profile with mathematically invalid CPF digits', () => {
      const result = corretorValidationSchema.safeParse({
        ...baseCorretor,
        cpf: '11111111111' // Repeating sequence is invalid in CPF math rules
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Os dígitos verificadores do CPF são matematicamente inválidos');
      }
    });

    it('should pass empty CPF string since it is optional', () => {
      const result = corretorValidationSchema.safeParse({
        ...baseCorretor,
        cpf: ''
      });
      expect(result.success).toBe(true);
    });
  });

  describe('distributionSettingsSchema', () => {
    it('should validate correct distribution params', () => {
      const valid = {
        timeout_minutes: 15,
        max_attempts: 3,
        auto_distribution_enabled: true,
        fallback_to_admin: true
      };
      expect(distributionSettingsSchema.safeParse(valid).success).toBe(true);
    });

    it('should fail if timeout exceeds limits', () => {
      const invalid = {
        timeout_minutes: 120, // max 60
        max_attempts: 3,
        auto_distribution_enabled: true,
        fallback_to_admin: true
      };
      const result = distributionSettingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('whatsappMessageSchema', () => {
    it('should validate message data correctly', () => {
      const valid = {
        phone_number: '5585996227722',
        message: 'Olá, cliente!'
      };
      expect(whatsappMessageSchema.safeParse(valid).success).toBe(true);
    });

    it('should fail on empty messages', () => {
      const invalid = {
        phone_number: '5585996227722',
        message: ''
      };
      expect(whatsappMessageSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
