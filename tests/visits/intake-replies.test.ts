import { describe, it, expect, vi } from 'vitest';
import { visitMessage } from '../../supabase/functions/_shared/visit-message';
import { intakeCommand, legacyPhoneCandidate } from '../../supabase/functions/_shared/visit-intake-parser';
import { receiveVisitIntake, resolveCandidate } from '../../supabase/functions/_shared/visit-intake';

vi.mock('../../supabase/functions/_shared/visit-lifecycle.ts',()=>({
 checked:async(value:any)=>{const result=await value;if(result.error)throw result.error;return result.data;},
 visitConfig:async(db:any)=>(await db.from('visit_automation_config').select('*').single()).data,
 visitInstance:vi.fn(),
}));

const broker={id:'broker',name:'Reno Alencar',phone:'5585996227722',alternatePhone:''};
describe('reported WhatsApp intake regressions',()=>{
 it('recognizes a unique full name with the ninth mobile digit omitted',async()=>{
   const questions:string[]=[];
   expect((await resolveCandidate({},'broker','Reno Alencar','558596227722',[broker],[],questions)).row).toEqual(broker);
   expect(questions).toEqual([]);
 });
 it('requires a decision if the legacy number belongs to another broker',async()=>{
   const questions:string[]=[];
   const result=await resolveCandidate({},'broker','Reno Alencar','558596227722',[broker,{...broker,id:'other',phone:'558596227722'}],[],questions);
   expect(result.row).toBeUndefined();expect(questions.length).toBeGreaterThan(0);
 });
 it('does not equate landlines or arbitrary inserted digits',()=>{
   expect(legacyPhoneCandidate('5585932227722','558532227722')).toBe(false);
   expect(legacyPhoneCandidate('5585896227722','558596227722')).toBe(false);
   expect(legacyPhoneCandidate('5511996227722','558596227722')).toBe(false);
 });
 it('preserves Evolution quotes stored outside message.conversation',()=>{
   expect(visitMessage({message:{conversation:'1'},contextInfo:{stanzaId:'question'}})).toEqual({text:'1',quoted:'question'});
 });
 it('does not extract commands from the quoted message body',()=>{
   expect(visitMessage({message:{conversation:'ok'},contextInfo:{stanzaId:'q',quotedMessage:{conversation:'AGENDAR VISITA'}}}).text).toBe('ok');
 });
 it('routes the quoted digit to the broker option with its original revision',async()=>{
   const rpc=vi.fn().mockResolvedValue({data:'request',error:null});
   const results:any={visit_automation_config:{enabled:true,intake_enabled:true,instance_id:'instance',group_jid:'group@g.us'},visit_intake_outbox:{revision:3,intake:{protocol:'18092026-V1',group_jid:'group@g.us',instance_id:'instance',choices:{broker:[broker],property:[]}}},evolution_instances:{id:'instance',instance_name:'visits'}};
   const db={rpc,from:(table:string)=>{const chain:any={};for(const op of ['select','eq','limit'])chain[op]=()=>chain;chain.single=chain.maybeSingle=async()=>({data:results[table],error:null});return chain;}};
   const handled=await receiveVisitIntake(db,{instance:'visits',data:{key:{id:'reply',remoteJid:'group@g.us',participant:'author@lid',participantAlt:'558596227722@s.whatsapp.net'},message:{conversation:'1'},contextInfo:{stanzaId:'question'}}},'1');
   expect(handled).toBe(true);
   expect(rpc).toHaveBeenCalledWith('visit_intake_receive',expect.objectContaining({p_text:'Corretor: opção 1',p_protocol:'18092026-V1',p_revision:3,p_action:'correct'}));
 });
 it('separates the daily visit sequence from the correction revision',()=>{
   expect(intakeCommand('RESOLVER AG-18092026-V12 R3\nCorretor: opção 1')).toEqual({action:'correct',protocol:'18092026-V12',revision:3});
   expect(intakeCommand('RESOLVER AG-71D70C4BBBE9 V1')?.revision).toBe(1);
   expect(intakeCommand('RESOLVER AG-18092026-V12')).toBeNull();
 });
});
