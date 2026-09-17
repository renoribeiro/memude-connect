import { describe, expect, it } from 'vitest';
import { parseVisitReply, visitPhone, sheetVisitRow, visitPromptText } from '../../supabase/functions/_shared/visit-workflow';

const id = 'ef596481-64e8-415e-9317-100000000000';
describe('visit response isolation', () => {
  it('never interprets a bare yes/no or number as a visit answer', () => {
    for (const value of ['sim', 'não', '0', '10', 'não posso amanhã', 'bom dia']) expect(parseVisitReply(value)).toBeNull();
  });
  it('parses the specific visit prompt reference and preserves a reason', () => {
    expect(parseVisitReply(`VISITA:${id}:não`)).toEqual({ promptId: id, answer: 'nao' });
    expect(parseVisitReply(`VISITA:${id}: Cliente não compareceu`)).toEqual({ promptId: id, answer: 'Cliente não compareceu' });
  });
  it('buttons and fallback share the same explicit context', () => {
    const prompt = visitPromptText('attendance', 'broker', id, 'Contexto');
    expect(prompt.buttons?.every(b => parseVisitReply(b.id)?.promptId === id)).toBe(true);
    expect(prompt.text).toContain(`VISITA:${id}:sim`);
  });
  it('normalizes Brazilian numbers without changing international numbers', () => {
    expect(visitPhone('(85) 99999-9999')).toBe('5585999999999');
    expect(visitPhone('+31630337955')).toBe('31630337955');
  });
});

describe('spreadsheet projection', () => {
  it('preserves zero ratings and avoids writing over human follow-up columns', () => {
    const row = sheetVisitRow({ visit: { id, data_visita: '2026-10-01', horario_visita: '10:00', lead: { nome: 'Teste' } }, cycle: { outcome: 'held', rating: 0, client_confirmed: null, broker_confirmed: true } });
    expect(row.nota_corretor_0_10).toBe(0);
    expect(row.id_visita).toBe(id);
    expect(row).not.toHaveProperty('Follow Up Lucas');
    expect(row).not.toHaveProperty('Data Venda');
  });
});
