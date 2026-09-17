import { describe,it,expect } from 'vitest';
import { parseIntake,normalizeFields,validateFields,intakeCommand,candidateSimilarity,legacyPhoneCandidate } from '../../supabase/functions/_shared/visit-intake-parser';
describe('WhatsApp visit intake',()=>{
 it('suggests first names and legacy phones without treating them as exact identities',()=>{expect(candidateSimilarity('Reno Alencar','Reno')).toBe(0.9);expect(legacyPhoneCandidate('5585996227722','558596227722')).toBe(true);expect(legacyPhoneCandidate('5511996227722','558596227722')).toBe(false);});
 it('distinguishes the two Telefone labels',()=>{const f=normalizeFields(parseIntake('AGENDAR VISITA\nCliente: Emilly\nTelefone: 55 85 9449-0233\nData: 18/09/2099\nHorário: 16h\nCorretor: Reno\nTelefone: 55 85 9622-7722'));expect(f.client_phone).toBe('558594490233');expect(f.broker_phone).toBe('558596227722');expect(f.date).toBe('2099-09-18');expect(f.time).toBe('16:00');});
 it('rejects ambiguous duplicate labels',()=>expect(parseIntake('Cliente: A\nTelefone: 111\nTelefone: 222').client_phone).toBe(''));
 it('rejects invalid calendar dates and time',()=>expect(validateFields({client_name:'Teste',client_phone:'5585999990000',date:'2099-02-30',time:'25:00',address:'Stand'}).length).toBe(2));
 it('requires explicit protocol and revision for updates',()=>{expect(intakeCommand('sim')).toBeNull();expect(intakeCommand('RESOLVER AG-ABCDEF123456 V2\nCorretor: Reno')).toEqual({action:'correct',protocol:'ABCDEF123456',revision:2});});
 it('accepts formatting variations without silently adding phone digits',()=>{const f=normalizeFields(parseIntake('*AGENDAR VISITA*\n*Cliente*: Emilly\nTelefone do cliente: +55 (85) 9449-0233\nLocal (stand): Rua A'));expect(f.address).toBe('Rua A');expect(f.client_phone).toBe('558594490233');});
});
