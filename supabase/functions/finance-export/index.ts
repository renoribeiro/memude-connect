import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const PAGE_SIZE = 500
const selects = {
  corretores: 'id,profile_id,creci,cpf,status,whatsapp,email,telefone,observacoes,deleted_at,updated_at,profiles(first_name,last_name)',
  empreendimentos: 'id,nome,endereco,descricao,ativo,tipo_imovel,updated_at',
  leads: 'id,nome,telefone,email,empreendimento_id,corretor_designado_id,observacoes,origem,status,deleted_at,updated_at',
  vendas: 'id,lead_id,empreendimento_id,corretor_id,valor_imovel,comissao_percentual,imposto_percentual,valor_comissao_bruta,valor_imposto,valor_comissao_liquida,valor_corretor,valor_memude,is_venda_direta,status,data_venda,data_pagamento,observacoes,comprovantes,updated_at',
} as const

type Resource = keyof typeof selects

Deno.serve(async request => {
  if (request.method !== 'POST')
    return Response.json({ error: 'Método não permitido.' }, { status: 405 })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const raw = await request.text()
  if (raw.length > 4096) return Response.json({ error: 'Requisição inválida.' }, { status: 400 })
  const timestamp = request.headers.get('x-memude-timestamp') || ''
  const signature = (request.headers.get('x-memude-signature') || '').replace(/^sha256=/, '')
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  const { data: config, error: configError } = await supabase.rpc('get_finance_webhook_config')
  if (configError || !config?.secret) return Response.json({ error: 'Integração indisponível.' }, { status: 503 })
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const bytes = Uint8Array.from(signature.match(/.{2}/g)!, v => parseInt(v, 16))
  if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${timestamp}.${raw}`)))
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  let body: { resource?: string; offset?: number }
  try { body = JSON.parse(raw) } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }) }
  if (!body || !body.resource || !Object.prototype.hasOwnProperty.call(selects, body.resource))
    return Response.json({ error: 'Recurso inválido.' }, { status: 400 })
  const resource = body.resource as Resource
  const offset = body.offset ?? 0
  if (!Number.isSafeInteger(offset) || offset < 0) return Response.json({ error: 'Paginação inválida.' }, { status: 400 })
  const { data, error } = await supabase
    .from(resource)
    .select(selects[resource])
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1)

  if (error)
    return Response.json({ error: error.message }, { status: 502 })

  return Response.json({ data: data ?? [], nextOffset: (data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null })
})
