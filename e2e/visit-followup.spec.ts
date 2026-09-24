import { test, expect } from '@playwright/test';

const userId = '10000000-0000-4000-8000-000000000001';
const visitId = '20000000-0000-4000-8000-000000000001';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    const token = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ sub: userId, exp: 2208988800, role: 'authenticated' }))}.synthetic`;
    const storageKey = 'sb-oxybasvtphosdmlmrfnb-auth-token';
    if (!localStorage.getItem(storageKey))
      localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: 'synthetic', expires_at: 2208988800, expires_in: 3600, token_type: 'bearer', user: { id: userId, aud: 'authenticated', email: 'synthetic@example.invalid', last_sign_in_at: '2026-09-24T10:00:00.000Z', user_metadata: {} } }));
  }, { userId });
});

test('Closer dismisses the warning until the next login', async ({ page }) => {
  let signInAt = '2026-09-24T10:00:00.000Z';
  await page.route('https://oxybasvtphosdmlmrfnb.supabase.co/**', async route => {
    const url = route.request().url();
    let data: any = [];
    if (url.includes('/profiles?')) data = { id: userId, user_id: userId, first_name: 'Closer', last_name: 'Teste' };
    else if (url.includes('/user_roles?')) data = { role: 'admin' };
    else if (url.includes('/auth/v1/user')) data = { id: userId, aud: 'authenticated', last_sign_in_at: signInAt };
    else if (url.includes('/functions/v1/visit-lifecycle')) {
      const body = route.request().postDataJSON();
      if (body.action === 'dashboard') data = { enabled: true, count: 1, failures: 2, cycles: [] };
      if (body.action === 'intake_list') data = { enabled: true, count: 0, failures: [], requests: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.goto('/visitas');
  await expect(page.getByRole('button', { name: 'Dispensar' })).toBeVisible();
  await page.getByRole('button', { name: 'Dispensar' }).click();
  await expect(page.getByText('Atenção, Closer:', { exact: false })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Atenção, Closer:', { exact: false })).toHaveCount(0);

  signInAt = '2026-09-24T11:00:00.000Z';
  await page.evaluate(() => {
    const storageKey = 'sb-oxybasvtphosdmlmrfnb-auth-token';
    const session = JSON.parse(localStorage.getItem(storageKey)!);
    session.user.last_sign_in_at = '2026-09-24T11:00:00.000Z';
    localStorage.setItem(storageKey, JSON.stringify(session));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Dispensar' })).toBeVisible();
});

test('intake conflict stays pending until the Closer explicitly approves', async ({page})=>{
  let approved=false;const actions:any[]=[];
  await page.route('https://oxybasvtphosdmlmrfnb.supabase.co/**',async route=>{
    const url=route.request().url();let data:any=[];
    if(url.includes('/profiles?'))data={id:userId,user_id:userId,first_name:'Closer',last_name:'Teste'};
    else if(url.includes('/user_roles?'))data={role:'admin'};
    else if(url.includes('/auth/v1/user'))data={id:userId,aud:'authenticated'};
    else if(url.includes('/functions/v1/visit-lifecycle')){
      const body=route.request().postDataJSON();actions.push(body);
      if(body.action==='dashboard')data={cycles:[],count:0,failures:0,enabled:true,intake_pending:approved?0:1};
      if(body.action==='intake_list')data={enabled:true,count:1,failures:[],requests:[{id:visitId,protocol:'ABCDEF123456',revision:2,status:approved?'queued':'needs_closer',fields:{client_name:'Cliente sintético',address:'Stand de teste'},conflict_ids:['existing'],resolution_note:'Conflito na agenda do corretor'}]};
      if(body.action==='intake_resolve'){approved=true;data={success:true};}
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/visitas');await page.getByRole('button',{name:'Resolver',exact:true}).click();
  await expect(page.getByText('Há 1 visita(s) conflitantes.',{exact:false})).toBeVisible();
  await page.keyboard.press('Escape');expect(actions.filter(a=>a.action==='intake_resolve')).toHaveLength(0);
  await page.getByRole('button',{name:'Resolver',exact:true}).click();
  await page.getByRole('button',{name:'Liberar conflito e cadastrar'}).click();
  await expect(page.getByText('Aguardando processamento',{exact:false})).toBeVisible();
  expect(actions.find(a=>a.action==='intake_resolve')).toMatchObject({id:visitId,revision:2,resolution:'approve'});
});

test('recovery stays visible after reading and closes only after linked rescheduling', async ({ page }) => {
  let recovered = false;
  const calls: any[] = [];
  await page.route('https://oxybasvtphosdmlmrfnb.supabase.co/**', async route => {
    const request = route.request();
    const url = request.url();
    let data: any = [];
    if (url.includes('/profiles?')) data = { id: userId, user_id: userId, first_name: 'Closer', last_name: 'Teste' };
    else if (url.includes('/user_roles?')) data = { role: 'admin' };
    else if (url.includes('/auth/v1/user')) data = { id: userId, aud: 'authenticated' };
    else if (url.includes('/functions/v1/visit-lifecycle')) {
      const body = request.postDataJSON(); calls.push(body);
      if (body.action === 'dashboard') data = { enabled: true, count: recovered ? 0 : 1, failures: 0, cycles: recovered ? [] : [{ visita_id: visitId, outcome: 'not_held', scheduled_at: '2026-09-15T13:00:00Z', recovery_open: true, attendance_overdue: false, confirmation_overdue: false, client_confirmed: true, broker_confirmed: true, rating: null, reason: 'Imprevisto', visita: { id: visitId, lead: { nome: 'Cliente sintético' } } }] };
      if (body.action === 'history') data = { events: [], deliveries: [] };
      if (body.action === 'reschedule') { recovered = true; data = { success: true, visita_id: 'new-visit' }; }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/visitas');
  await expect(page.getByText('Reagendamento ou desistência pendente')).toBeVisible();
  await page.getByRole('button', { name: 'Acompanhar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Reagendamento ou desistência pendente')).toBeVisible();
  expect(calls.filter(c => ['withdraw','reschedule'].includes(c.action))).toHaveLength(0);
  await page.getByRole('button', { name: 'Acompanhar', exact: true }).click();
  await page.getByLabel('Nova data').fill('2027-01-15');
  await page.getByLabel('Novo horário').fill('14:00');
  await page.getByRole('button', { name: 'Cadastrar nova visita e reiniciar ciclo' }).click();
  await expect(page.getByText('Nenhuma visita nesta lista.')).toBeVisible();
  expect(calls.find(c => c.action === 'reschedule')).toMatchObject({ visita_id: visitId, data: { date: '2027-01-15', time: '14:00' } });
});


test('Closer starts a new consultation after Match exhaustion', async ({page})=>{
  const calls:any[]=[];
  await page.route('https://oxybasvtphosdmlmrfnb.supabase.co/**',async route=>{
    const url=route.request().url();let data:any=[];
    if(url.includes('/profiles?'))data={id:userId,user_id:userId,first_name:'Closer',last_name:'Teste'};
    else if(url.includes('/user_roles?'))data={role:'admin'};
    else if(url.includes('/auth/v1/user'))data={id:userId,aud:'authenticated'};
    else if(url.includes('/functions/v1/visit-lifecycle')){
      const body=route.request().postDataJSON();calls.push(body);
      if(body.action==='dashboard')data={enabled:true,count:1,failures:0,cycles:[{visita_id:visitId,outcome:'pending',match_status:'exhausted',scheduled_at:'2099-01-01T16:00:00Z',recovery_open:true,rating:null,client_confirmed:null,broker_confirmed:null,visita:{id:visitId,corretor_id:null,lead:{nome:'Cliente Match'}}}]};
      if(body.action==='history')data={events:[],deliveries:[]};
      if(body.action==='brokers')data={brokers:[{id:'broker-test',profiles:{first_name:'Corretor',last_name:'Teste'}}]};
      if(body.action==='intake_list')data={requests:[],count:0,failures:[],enabled:true};
      if(body.action==='match_manual')data={success:true};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/visitas');await expect(page.getByText('Nenhum corretor aceitou: indicar outro corretor')).toBeVisible();
  await page.getByRole('button',{name:'Acompanhar',exact:true}).click();
  await page.getByLabel('Novo corretor',{exact:true}).selectOption('broker-test');
  await page.getByRole('button',{name:'Consultar corretor indicado pelo Closer'}).click();
  await expect.poll(()=>calls.find(c=>c.action==='match_manual')).toMatchObject({visita_id:visitId,data:{broker_id:'broker-test'}});
});
