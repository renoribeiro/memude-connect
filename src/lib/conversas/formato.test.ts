import { describe, expect, it } from 'vitest';
import {
  duracao, haQuanto, iniciais, minutosEsperando, nivelEspera, quandoNaLista, semAssinatura, separadorDia, tamanhoArquivo, telefoneLegivel, trechos,
} from './formato';

const agora = new Date('2026-11-25T15:00:00-03:00');

describe('datas da conversa', () => {
  it('mostra hora para hoje, "Ontem" e data antiga', () => {
    expect(quandoNaLista('2026-11-25T09:05:00-03:00', agora)).toBe('09:05');
    expect(quandoNaLista('2026-11-24T22:00:00-03:00', agora)).toBe('Ontem');
    expect(quandoNaLista('2026-10-01T10:00:00-03:00', agora)).toBe('01/10/26');
  });
  it('usa o fuso de Fortaleza na virada do dia', () => {
    // 01:30 UTC do dia 26 ainda é dia 25 em Fortaleza
    expect(quandoNaLista('2026-11-26T01:30:00Z', new Date('2026-11-26T02:00:00Z'))).toBe('22:30');
  });
  it('separa os dias no chat', () => {
    expect(separadorDia('2026-11-25T08:00:00-03:00', agora)).toBe('Hoje');
    expect(separadorDia('2026-11-24T08:00:00-03:00', agora)).toBe('Ontem');
    expect(separadorDia('2026-11-20T08:00:00-03:00', agora)).toMatch(/20 de novembro/);
  });
  it('conta o tempo de espera e o semáforo', () => {
    expect(haQuanto('2026-11-25T14:48:00-03:00', agora.getTime())).toBe('há 12 min');
    expect(minutosEsperando('2026-11-25T14:40:00-03:00', agora.getTime())).toBe(20);
    expect(nivelEspera(3)).toBe('ok');
    expect(nivelEspera(12)).toBe('atencao');
    expect(nivelEspera(16)).toBe('atrasado');
    expect(nivelEspera(null)).toBeNull();
  });
});

describe('texto do WhatsApp', () => {
  it('quebra links e formatação sem gerar HTML', () => {
    expect(trechos('Veja *aqui*: https://memude.com.br/x. _ok_')).toEqual([
      { tipo: 'texto', valor: 'Veja ' },
      { tipo: 'negrito', valor: 'aqui' },
      { tipo: 'texto', valor: ': ' },
      { tipo: 'link', valor: 'https://memude.com.br/x' },
      { tipo: 'texto', valor: '. ' },
      { tipo: 'italico', valor: 'ok' },
    ]);
  });
  it('não trata <script> como nada além de texto', () => {
    expect(trechos('<script>alert(1)</script>')).toEqual([{ tipo: 'texto', valor: '<script>alert(1)</script>' }]);
  });
  it('tira a assinatura automática', () => {
    expect(semAssinatura('*Ramon · Atendimento*\nOlá!')).toBe('Olá!');
    expect(semAssinatura('Olá *tudo* bem')).toBe('Olá *tudo* bem');
  });
});

describe('miudezas', () => {
  it('formata tamanho, duração, telefone e iniciais', () => {
    expect(tamanhoArquivo(2_500_000)).toBe('2,4 MB');
    expect(tamanhoArquivo(3000)).toBe('3 KB');
    expect(duracao(75)).toBe('1:15');
    expect(telefoneLegivel('5585999991234')).toBe('(85) 99999-1234');
    expect(iniciais('maria da silva')).toBe('MD');
    expect(iniciais(null)).toBe('?');
  });
});
