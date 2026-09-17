import {describe,it,expect} from 'vitest';
import {visitMessage,visitReceiptState,deliveryUncertain} from '../../supabase/functions/_shared/visit-message';
import {validateFields} from '../../supabase/functions/_shared/visit-intake-parser';
import {syncVisitSheet} from '../../supabase/functions/_shared/visit-sheets';
describe('visit transport contracts',()=>{
 it('unwraps native buttons and preserves reply reference',()=>expect(visitMessage({ephemeralMessage:{message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"VISITA:abc:sim"}'},contextInfo:{stanzaId:'quoted'}}}}})).toEqual({text:'VISITA:abc:sim',quoted:'quoted'}));
 it('does not invent malformed button content',()=>expect(visitMessage({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'bad'}}}).text).toBe(''));
 it('normalizes receipts and uncertain timeouts',()=>{expect(visitReceiptState('DELIVERY_ACK')).toBe('delivered');expect(visitReceiptState(3)).toBe('read');expect(deliveryUncertain(new Error('network timeout'))).toBe(true);expect(deliveryUncertain(new Error('WhatsApp recusou (429)'))).toBe(false);});
 it('rejects placeholder names and repeated phone digits',()=>{const issues=validateFields({client_name:'??',client_phone:'5511111111111',date:'2099-10-01',time:'10:00',address:'Stand'});expect(issues.some(i=>i.startsWith('Cliente:'))).toBe(true);expect(issues.some(i=>i.startsWith('Telefone'))).toBe(true);});
});
describe('sheet recovery',()=>{
 it('recovers an accepted append with a lost response without appending twice',async()=>{
  const headers=['id_visita','Notas livres'];const rows:any[][]=[];let appends=0;let updates=0;
  const request=async(_id:string,path:string,body?:any):Promise<any>=>{
   if(path==='?fields=sheets.properties')return {sheets:[{properties:{title:'VISITAS',sheetId:1,gridProperties:{columnCount:100,rowCount:100}}}]};
   if(!body&&path.startsWith('/values/')&&decodeURIComponent(path).includes('A1:'))return {values:[[...headers]]};
   if(path==='/values:batchUpdate') { if(body.data[0].range.endsWith('1'))headers.push(...body.data[0].values[0]);else {updates++;expect(body.data.every((d:any)=>!d.range.includes('!B2'))).toBe(true);}return {}; }
   if(path.includes(':append')){appends++;rows.push(body.values[0]);throw new Error('response lost after append');}
   return {values:rows.map(r=>[r[0]])};
  };
  const snapshot={visit:{id:'v1',data_visita:'2099-10-01',horario_visita:'10:00'},cycle:{outcome:'pending',revision:1,client_confirmed:null,broker_confirmed:null}};
  await expect(syncVisitSheet('test',snapshot,[],request)).rejects.toThrow('response lost');
  await syncVisitSheet('test',snapshot,[],request);expect(appends).toBe(1);expect(updates).toBe(1);
 });
});
