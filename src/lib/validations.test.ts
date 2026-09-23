import { describe, expect, it } from 'vitest';
import { corretorSchema } from './validations';

const validCorretor = {
  nome: 'Maria Corretora',
  cpf: '',
  telefone: '5585996227722',
  email: 'maria@example.com',
  creci: 'CRECI-12345',
  cidade: 'Fortaleza',
  estado: 'CE' as const,
  tipo_imovel: 'todos' as const,
  observacoes: '',
  status: 'ativo' as const,
  nota_media: 0,
  bairros: ['bairro-1'],
  construtoras: ['construtora-1'],
};

describe('corretorSchema', () => {
  it('aceita o telefone normalizado produzido pelo PhoneInput', () => {
    expect(corretorSchema.safeParse(validCorretor).success).toBe(true);
  });

  it('também aceita um celular brasileiro formatado', () => {
    expect(corretorSchema.safeParse({
      ...validCorretor,
      telefone: '(85) 99622-7722',
    }).success).toBe(true);
  });

  it('rejeita telefone incompleto e seleções obrigatórias vazias', () => {
    const result = corretorSchema.safeParse({
      ...validCorretor,
      telefone: '8599',
      bairros: [],
      construtoras: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toEqual(expect.arrayContaining([
        'telefone',
        'bairros',
        'construtoras',
      ]));
    }
  });
});
