export type IntakeFields = Partial<Record<'client_name'|'client_phone'|'broker_name'|'broker_phone'|'date'|'time'|'property_name'|'address'|'neighborhood'|'profile'|'source'|'url', string>>;
export const fieldKeys = ['client_name','client_phone','broker_name','broker_phone','date','time','property_name','address','neighborhood','profile','source','url'] as const;
export const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function intakePhone(s: string) {
  const digits = s.replace(/\D/g,'');
  return !s.trim().startsWith('+') && [10,11].includes(digits.length) ? '55'+digits : digits;
}
export function parseIntake(text: string): IntakeFields {
  const fields: IntakeFields = {}; let context = ''; const duplicate = new Set<string>();
  const aliases: Record<string,keyof IntakeFields> = {cliente:'client_name','nome do cliente':'client_name','telefone do cliente':'client_phone',corretor:'broker_name','telefone do corretor':'broker_phone',data:'date','data da visita':'date',horario:'time',hora:'time','horario da visita':'time',empreendimento:'property_name','local stand':'address','local de encontro':'address',local:'address',bairro:'neighborhood','bairro do encontro':'neighborhood','perfil do cliente':'profile',perfil:'profile','origem do lead':'source',origem:'source','link do empreendimento':'url',link:'url'};
  for (const line of text.split(/\r?\n/)) {
    const m = line.replace(/\*/g,'').match(/^\s*([^:]+):\s*(.*)$/); if (!m) continue;
    const label=norm(m[1]); let key:keyof IntakeFields|undefined=aliases[label];
    if(label==='cliente'||label==='nome do cliente') context='client';
    if(label==='corretor') context='broker';
    if(label==='telefone') key=context==='client'?'client_phone':context==='broker'?'broker_phone':undefined;
    if(!key) continue;
    if(fields[key]!==undefined) duplicate.add(key);
    fields[key]=m[2].trim().slice(0,1500);
  }
  for(const key of duplicate) fields[key as keyof IntakeFields]=''; // Never guess between conflicting duplicate fields.
  return fields;
}
export function normalizeFields(input: IntakeFields): IntakeFields {
  const f={...input};
  for(const key of ['client_phone','broker_phone'] as const) if(f[key]) f[key]=intakePhone(f[key]!);
  if(f.date) { const m=f.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m) f.date=`${m[3]}-${m[2]}-${m[1]}`; }
  if(f.time) { const m=f.time.match(/^(\d{1,2})(?::|h)?(\d{2})?$/i); if(m) f.time=`${m[1].padStart(2,'0')}:${m[2]||'00'}`; }
  if(f.url) { const m=f.url.match(/https:\/\/[^\s\])]+/); if(m) f.url=m[0]; }
  return f;
}
export function validateFields(f: IntakeFields, now=Date.now()) {
  const issues:string[]=[];
  if(!f.client_name || f.client_name.trim().length<2 || !/\p{L}{2}/u.test(f.client_name)) issues.push('Cliente: informe o nome.');
  const phone=f.client_phone||'';
  if(!/^[1-9]\d{9,14}$/.test(phone)||/(\d)\1{7}$/.test(phone)||(phone.startsWith('55')&&!/^55[1-9][1-9]\d{8,9}$/.test(phone))) issues.push('Telefone do cliente: informe DDI, DDD e número válido.');
  const dateOK=/^\d{4}-\d{2}-\d{2}$/.test(f.date||'') && !Number.isNaN(Date.parse(f.date!)) && new Date(f.date!).toISOString().slice(0,10)===f.date;
  const timeOK=/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time||'');
  if(!dateOK) issues.push('Data: informe uma data válida, no formato DD/MM/AAAA.');
  if(!timeOK) issues.push('Horário: informe HH:MM.');
  if(dateOK&&timeOK&&Date.parse(`${f.date}T${f.time}:00-03:00`)<=now) issues.push('Data e horário: a visita precisa estar no futuro (Brasília).');
  if(!f.address) issues.push('Local de encontro: informe o endereço do stand ou encontro.');
  return issues;
}
export function similarity(a:string,b:string) {
  a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
  return 1-row[b.length]/Math.max(a.length,b.length);
}
export function intakeCommand(text:string) {
  if(/^\s*\*?AGENDAR VISITA\*?\s*(?:\r?\n|$)/i.test(text)) return {action:'create',protocol:null,revision:null};
  const m=text.match(/^\s*(RESOLVER|LIBERAR|CANCELAR)\s+AG-(\d{8}-V[1-9]\d*)\s+R([1-9]\d*)(?:\s|$)/i) || text.match(/^\s*(RESOLVER|LIBERAR|CANCELAR)\s+AG-([A-F0-9]{12})\s+V(\d+)(?:\s|$)/i);
  return m?{action:({RESOLVER:'correct',LIBERAR:'approve',CANCELAR:'cancel'} as Record<string,string>)[m[1].toUpperCase()],protocol:m[2].toUpperCase(),revision:Number(m[3])}:null;
}
export function candidateSimilarity(name:string,input:string) {
  const terms=norm(input).split(' ').filter(Boolean),words=norm(name).split(' ');
  return terms.length&&terms.every(t=>words.includes(t))?0.9:similarity(name,input);
}
export function legacyPhoneCandidate(stored:string,input:string) {
  // Only the ninth digit immediately after DDD may differ. Identity also requires a unique full name.
  const [long,short]=stored.length>input.length?[stored,input]:[input,stored];
  return /^55[1-9][1-9]9[6-9]\d{7}$/.test(long)&&/^55[1-9][1-9][6-9]\d{7}$/.test(short)&&long.slice(0,4)+long.slice(5)===short;
}
