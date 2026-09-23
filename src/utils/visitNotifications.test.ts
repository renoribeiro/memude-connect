import { describe, it, expect } from 'vitest';
import { canSendVisitGroupConfirmation, visitGroupConfirmation } from '../../supabase/functions/_shared/visit-notifications';

const snapshot = {
  cycle: { revision: 2, match_status: 'accepted', outcome: 'pending' },
  visit: { id: 'visit', visit_code: 'AG-24092026-V1', corretor_id: 'broker', deleted_at: null,
    data_visita: '2026-09-24', horario_visita: '16:30:00', meeting_address: 'Rua do Encontro, 10',
    customer_profile: 'Busca apartamento', lead: { nome: 'Cliente Teste', telefone: '5585999990001' },
    broker: { whatsapp: '5585999990002', creci: '12345', profiles: { first_name: 'Corretor', last_name: 'Teste' } },
    property: { nome: 'Residencial Teste', endereco: 'Outro endereço', bairro: { nome: 'Centro' } } },
};
const event = { kind: 'match_accepted', payload: { broker_id: 'broker' } };
describe('visit group notification policy', () => {
  it('permits only current accepted assignments', () => {
    expect(canSendVisitGroupConfirmation({ revision: 2 }, event, snapshot)).toBe(true);
    for (const kind of ['scheduled', 'prompt_sent', 'client_confirmed', 'post_visit_summary']) {
      expect(canSendVisitGroupConfirmation({ revision: 2 }, { ...event, kind }, snapshot)).toBe(false);
    }
    expect(canSendVisitGroupConfirmation({ revision: 1 }, event, snapshot)).toBe(false);
    expect(canSendVisitGroupConfirmation({ revision: 2 }, { ...event, payload: { broker_id: 'old' } }, snapshot)).toBe(false);
    for (const patch of [{ outcome: 'cancelled' }, { outcome: 'held' }, { match_status: 'searching' }]) {
      expect(canSendVisitGroupConfirmation({ revision: 2 }, event, { ...snapshot, cycle: { ...snapshot.cycle, ...patch } })).toBe(false);
    }
    expect(canSendVisitGroupConfirmation({ revision: 2 }, event, { ...snapshot, visit: { ...snapshot.visit, deleted_at: '2026-09-23' } })).toBe(false);
  });
  it('includes complete appointment and contact information', () => {
    const text = visitGroupConfirmation(snapshot);
    for (const value of ['VISITA CONFIRMADA', 'AG-24092026-V1', 'Cliente Teste', '5585999990001',
      'Residencial Teste', '24/09/2026 às 16:30', 'Rua do Encontro, 10', 'Centro', 'Corretor Teste',
      '5585999990002', '12345', 'Busca apartamento']) expect(text).toContain(value);
    expect(text).not.toContain('Outro endereço');
  });
});
