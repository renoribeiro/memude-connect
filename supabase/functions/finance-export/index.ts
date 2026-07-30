import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAGE_SIZE = 500
const selects = {
  corretores: 'id,profile_id,creci,cpf,status,whatsapp,email,telefone,observacoes,deleted_at,updated_at,profiles(first_name,last_name)',
  empreendimentos: 'id,nome,endereco,descricao,ativo,tipo_imovel,updated_at',
  leads: 'id,nome,telefone,email,empreendimento_id,corretor_designado_id,observacoes,origem,status,deleted_at,updated_at',
  vendas: 'id,lead_id,empreendimento_id,corretor_id,valor_imovel,comissao_percentual,valor_comissao_bruta,valor_corretor,valor_memude,status,data_venda,data_pagamento,observacoes,updated_at',
} as const

type Resource = keyof typeof selects

Deno.serve(async request => {
  const configuredSecret = Deno.env.get('CORE_FINANCE_EXPORT_SECRET')
  const suppliedSecret = request.headers.get('x-finance-export-secret')
  if (!configuredSecret || !suppliedSecret || suppliedSecret !== configuredSecret)
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })

  if (request.method !== 'POST')
    return Response.json({ error: 'Método não permitido.' }, { status: 405 })

  const body = await request.json().catch(() => ({})) as { resource?: string; offset?: number }
  if (!body.resource || !(body.resource in selects))
    return Response.json({ error: 'Recurso inválido.' }, { status: 400 })

  const resource = body.resource as Resource
  const offset = Math.max(0, Number(body.offset) || 0)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await supabase
    .from(resource)
    .select(selects[resource])
    .range(offset, offset + PAGE_SIZE - 1)

  if (error)
    return Response.json({ error: error.message }, { status: 502 })

  return Response.json({ data: data ?? [], nextOffset: (data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null })
})
