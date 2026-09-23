import { expect, test, type Page } from '@playwright/test';

const pipelineId = '10000000-0000-4000-8000-000000000001';
const openId = '20000000-0000-4000-8000-000000000001';
const wonId = '20000000-0000-4000-8000-000000000002';
const leadId = '30000000-0000-4000-8000-000000000001';
const propertyId = '40000000-0000-4000-8000-000000000001';
const brokerId = '50000000-0000-4000-8000-000000000001';
const saleId = '60000000-0000-4000-8000-000000000001';

async function mockCrm(page: Page, options: { count?: number; failSale?: boolean } = {}) {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'crm@example.test', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() };
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-oxybasvtphosdmlmrfnb-auth-token', JSON.stringify({ access_token: 'mock-access', refresh_token: 'mock-refresh', expires_at: 9999999999, token_type: 'bearer', user }));
  }, { user });
  const lead = { id: leadId, nome: 'Cliente CRM Teste', telefone: '85999990000', empreendimento_id: propertyId, corretor_designado_id: brokerId, empreendimentos: { nome: 'Residencial Teste' }, corretores: { profiles: { first_name: 'Corretor', last_name: 'Teste' } } };
  const pipeline = { id: pipelineId, nome: 'Funil Teste', is_default: true, auto_add_visits: false, completed_stage_id: wonId };
  let stages = [{ id: openId, pipeline_id: pipelineId, nome: 'Negociação', posicao: 0, cor: '#059669', is_final: false }, { id: wonId, pipeline_id: pipelineId, nome: 'Venda Realizada', posicao: 1, cor: '#0891b2', is_final: false }];
  const cards = Array.from({ length: options.count ?? 1 }, (_, i) => ({ id: `card-${String(i).padStart(4, '0')}`, lead_id: leadId, pipeline_id: pipelineId, stage_id: openId, posicao: i, valor_estimado: 1000.25, empreendimento_id: propertyId, venda_id: null as string | null, completed_at: null, archived_at: null, vendas: null as null | { valor_imovel: number; status: string }, moved_at: new Date().toISOString(), created_at: new Date().toISOString(), leads: lead, empreendimentos: { id: propertyId, nome: 'Residencial Teste' } }));
  const calls: { name: string; body: any }[] = [];
  await page.route('https://oxybasvtphosdmlmrfnb.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').pop()!;
    let data: unknown = [];
    if (url.pathname.includes('/auth/')) data = user;
    else if (name === 'profiles') data = { id: user.id, user_id: user.id, first_name: 'Admin', last_name: 'Teste' };
    else if (name === 'user_roles') data = { role: 'admin' };
    else if (name === 'crm_pipelines') data = [pipeline];
    else if (name === 'crm_stages') data = stages;
    else if (name === 'crm_leads') {
      data = url.searchParams.get('archived_at') === 'not.is.null' ? [] : cards.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 500));
    } else if (name === 'leads') data = [lead];
    else if (name === 'empreendimentos') data = [{ id: propertyId, nome: 'Residencial Teste', ativo: true }];
    else if (name === 'corretores') data = [{ id: brokerId, profiles: { first_name: 'Corretor', last_name: 'Teste' } }];
    else if (name === 'system_settings') data = [];
    else if (name === 'complete_crm_sale') {
      const body = request.postDataJSON(); calls.push({ name, body });
      if (options.failSale) return route.fulfill({ status: 400, json: { message: 'Venda não registrada: teste de falha' } });
      cards[0].venda_id = saleId; cards[0].stage_id = wonId;
      cards[0].vendas = { valor_imovel: body.p_sale.valor_imovel, status: 'pendente' };
      data = saleId;
    } else if (name === 'save_crm_pipeline_settings') {
      const body = request.postDataJSON(); calls.push({ name, body });
      stages = body.p_stages; pipeline.completed_stage_id = body.p_completed_stage_id;
      data = null;
    } else if (name === 'vendas') data = [];
    await route.fulfill({ status: 200, json: data });
  });
  return calls;
}

test('VENDIDO preenche a venda, preserva cliente e atualiza cartão e VGV', async ({ page }) => {
  const calls = await mockCrm(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/crm');
  await expect(page.getByRole('button', { name: 'VENDIDO', exact: true })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Cliente CRM Teste', exact: true }).click();
  await page.getByRole('dialog', { name: 'Cliente CRM Teste', exact: true }).screenshot({ path: 'test-results/crm-lead-modal.png' });
  await page.getByRole('dialog', { name: 'Cliente CRM Teste', exact: true }).getByRole('button', { name: 'VENDIDO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar venda do lead' })).toBeVisible();
  await expect(page.getByLabel('Cliente *')).toBeDisabled();
  await expect(page.getByLabel('Valor do Imóvel (R$) *')).toHaveValue('1000.25');
  await page.getByLabel('Valor do Imóvel (R$) *').fill('450000.75');
  await page.getByRole('button', { name: 'Registrar Venda', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar venda do lead' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver venda', exact: true })).toHaveCount(0);
  await expect(page.getByText('VGV R$ 450.000,75', { exact: true })).toBeVisible();
  expect(calls.filter(c => c.name === 'complete_crm_sale')).toHaveLength(1);
  expect(calls[0].body.p_sale.lead_id).toBe(leadId);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/crm-sales.png', fullPage: true });
  await page.getByRole('heading', { name: 'Cliente CRM Teste', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cliente CRM Teste', exact: true }).getByRole('button', { name: 'Ver venda', exact: true })).toBeVisible();
});

test('falha da venda mantém formulário e cartão sem venda', async ({ page }) => {
  await mockCrm(page, { failSale: true }); await page.goto('/crm');
  await expect(page.getByRole('button', { name: 'VENDIDO', exact: true })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Cliente CRM Teste', exact: true }).click();
  await page.getByRole('dialog', { name: 'Cliente CRM Teste', exact: true }).getByRole('button', { name: 'VENDIDO', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar Venda', exact: true }).click();
  await expect(page.getByText('Venda não registrada: teste de falha', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Confirmar venda do lead' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver venda', exact: true })).toHaveCount(0);
});

test('configuração envia destino por ID e arquivados não oferecem nova venda', async ({ page }) => {
  const calls = await mockCrm(page); await page.goto('/crm');
  await page.getByRole('button', { name: 'Configurar', exact: true }).click();
  await expect(page.getByLabel('Coluna de vendas concluídas')).toContainText('Venda Realizada');
  await page.getByLabel('Coluna de vendas concluídas').click();
  await page.getByRole('option', { name: 'Negociação', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações do Pipeline' })).toHaveCount(0);
  expect(calls.find(c => c.name === 'save_crm_pipeline_settings')?.body.p_completed_stage_id).toBe(openId);
  await page.getByRole('tab', { name: 'Arquivados', exact: true }).click();
  await expect(page.getByRole('button', { name: 'VENDIDO', exact: true })).toHaveCount(0);
});

test('VGV inclui oportunidades além do antigo limite de 500', async ({ page }) => {
  await mockCrm(page, { count: 501 }); await page.goto('/crm');
  await expect(page.getByText('VGV R$ 501.125,25', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cliente CRM Teste', exact: true })).toHaveCount(501);
  await expect(page.getByRole('button', { name: 'VENDIDO', exact: true })).toHaveCount(0);
});
