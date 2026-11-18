import { describe, expect, it } from 'vitest';
import { chaveTelefone, linkWhatsApp, telefoneCanonico, telefoneExibicao, telefoneValido } from './telefone';

describe('chave do telefone (regra do documento)', () => {
  it('os 4 formatos obrigatórios geram a mesma chave', () => {
    for (const formato of ['(85) 9 9999-9999', '+55 85 99999-9999', '8599999999', '5585 9999-9999']) {
      expect(chaveTelefone(formato)).toBe('85-99999999');
      expect(telefoneExibicao(formato)).toBe('55 85 99999-9999');
    }
  });

  it('fixo não ganha o 9', () => {
    expect(telefoneCanonico('85 3222-1234')).toBe('558532221234');
    expect(chaveTelefone('85 3222-1234')).toBe('85-32221234');
    expect(telefoneExibicao('(85) 3222-1234')).toBe('55 85 3222-1234');
  });

  it('número estrangeiro mantém o DDI e tem chave própria', () => {
    expect(chaveTelefone('+1 415 555 0100')).toBe('INT-14155550100');
    expect(chaveTelefone('0044 20 7946 0958')).toBe('INT-442079460958');
    expect(telefoneExibicao('+1 415 555 0100')).toBe('+14155550100');
  });

  it('vazio ou curto é inválido', () => {
    expect(chaveTelefone('')).toBeNull();
    expect(telefoneValido('8599')).toBe(false);
    expect(telefoneValido('85 99999-9999')).toBe(true);
  });

  it('link do WhatsApp usa o número canônico e codifica o texto', () => {
    expect(linkWhatsApp('(85) 9 9999-9999', 'Olá *teste*\nlinha 2')).toBe(
      'https://wa.me/5585999999999?text=Ol%C3%A1%20*teste*%0Alinha%202',
    );
    expect(linkWhatsApp('', 'x')).toBeNull();
  });
});
