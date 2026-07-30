# Relatório de implementação das correções

**Data:** 27 de julho de 2026
**Aplicação:** MeMude Connect
**Supabase:** `oxybasvtphosdmlmrfnb`
**Vercel:** `memude-connect`
**Produção:** https://core.memudecore.com.br

## Resultado executivo

Os riscos críticos e os erros funcionais identificados na auditoria foram
corrigidos no código, no banco de dados remoto, nas Edge Functions e no
ambiente de produção. A aplicação foi recompilada, testada, publicada e
validada no domínio oficial.

## Correções de segurança

- Criada uma camada comum de autenticação para Edge Functions, com validação
  de sessão, papel de administrador, chamadas internas e limites de payload.
- As funções que usam a chave de serviço deixaram de confiar em chamadas
  públicas sem autenticação.
- Webhooks Evolution e WAHA agora exigem segredo ou assinatura HMAC e não
  registram o conteúdo integral das mensagens.
- Dois webhooks legados que ainda aceitavam chamadas quando o segredo opcional
  não existia passaram a exigir obrigatoriamente o segredo central ou HMAC.
- O processador principal do agente de IA e o health check com auto-restart da
  Evolution agora aceitam somente chamadas internas ou administrativas.
- O endpoint legado `enhanced-whatsapp-sender`, antes capaz de enviar mensagens
  sem autenticação, foi substituído por um adaptador autenticado que encaminha
  ao transportador atual.
- O webhook de leads passou a comparar seu token em tempo constante e limitar o
  corpo recebido.
- URLs externas configuráveis são validadas e endereços locais ou privados são
  bloqueados, reduzindo o risco de SSRF.
- A credencial das instâncias Evolution deixou de ser consultável pelo
  navegador. Leitura e atualização passam por uma função administrativa que
  remove o token das respostas.
- As políticas RLS que confiavam em `profiles.role` foram substituídas por
  `user_roles` e `has_role`.
- Foi adicionada proteção contra alteração indevida do papel legado em
  `profiles`.
- A tabela `lid_phone_map` foi fechada para clientes e permanece acessível
  somente às rotinas de serviço.
- Inserções arbitrárias de notificações foram removidas.
- Funções `SECURITY DEFINER` receberam `search_path` determinístico e
  privilégios públicos implícitos foram revogados.
- Views sensíveis passaram a executar com as permissões do chamador.
- A extensão vetorial foi movida para o schema `extensions`, mantendo a busca
  semântica operacional.
- O bucket de comprovantes deixou de permitir listagem ampla; listagem e
  mutações agora são administrativas.
- O arquivo `.env` foi retirado do versionamento e foi criado
  `.env.example`.

## Banco de dados e automações

- Aplicadas quatro migrations de hardening no projeto remoto.
- Criado `target_sample_size` em `ab_experiments` e regenerados os tipos
  TypeScript a partir do banco remoto.
- Criados índices de cobertura para chaves estrangeiras sem índice e removidos
  quatro índices duplicados.
- Políticas RLS foram otimizadas para calcular o contexto de autenticação uma
  vez por consulta.
- As partições de logs foram fechadas para acesso direto.
- Jobs HTTP antigos, duplicados ou com segredos embutidos foram removidos.
- Dez jobs canônicos foram recriados.
- O segredo interno é gerado no Vault do banco e validado pelas Edge Functions
  sem ser salvo em tabela ou repositório.
- As execuções recentes de `pg_cron` concluíram e as respostas HTTP das versões
  publicadas foram verificadas.
- Os dois agendamentos legados que ainda montavam URLs dinamicamente foram
  removidos; depois da remoção não houve nova chamada duplicada com `401`.
- O verificador de follow-up ganhou um circuit breaker de 30 minutos para não
  martelar a Evolution API quando ela rejeitar a credencial configurada.

## Correções funcionais

- Corrigido o uso de `window.location` dentro da função Deno de convite por
  WhatsApp.
- Corrigidos os 20 erros de TypeScript encontrados na auditoria.
- Corrigido o cadastro e a edição de experimentos A/B.
- O gerenciador de templates deixou de confiar em `profiles.role`, passou a usar
  `user_roles`/`has_role`, bloqueia alterações em templates de outros usuários e
  aceita somente campos explicitamente permitidos.
- Corrigidos mapeamentos de métricas, auditoria e qualificação de leads.
- Corrigidos estados e tipos dos formulários de usuários e vendas.
- Corrigido o debounce de configurações.
- Corrigida a taxa de conversão para usar vendas concluídas por lead.
- Corrigido o funil de relatórios para distinguir visitas, visitas realizadas e
  vendas.
- Relatórios agendados agora calculam dados reais, enviam e-mail e atualizam a
  próxima execução.
- Consultas de contagem do dashboard deixaram de baixar linhas desnecessárias.
- O exportador Excel vulnerável foi substituído por um gerador OOXML próprio,
  com teste automatizado.

## Dependências, entrega e proteção web

- Removidos `xlsx` e `lovable-tagger`.
- Atualizados Vite, React Router, jsPDF, PostCSS e ferramentas relacionadas.
- A auditoria de produção não possui vulnerabilidade alta ou crítica aplicável.
  O único alerta alto permitido pelo verificador é exclusivo do modo RSC do
  React Router, que não existe nesta SPA Vite.
- Criado workflow de CI com instalação limpa, tipos, lint, testes, build e
  auditoria de dependências.
- Adicionados CSP, proteção contra framing, `nosniff`, política de referência,
  política de permissões e isolamento de origem.
- Assets versionados recebem cache imutável de um ano.
- O idioma raiz foi corrigido para `pt-BR`.
- A tela de configuração da Evolution agora identifica credencial rejeitada sem
  expor segredos, informa que os envios automáticos foram pausados e oferece o
  atalho “Cadastrar chave válida”.

## Evidências de validação

| Verificação | Resultado |
|---|---|
| TypeScript | aprovado, zero erros |
| ESLint bloqueante | aprovado, zero erros |
| Testes Vitest | 64 aprovados |
| Build Vite local | aprovado |
| Build Vercel | aprovado; produção `dpl_B5T9xsqJacbBsFGT3dvXFyRy5Asa` em estado `READY` |
| Auditoria de dependências de produção | aprovada |
| Busca semântica após mover `vector` | aprovada |
| Edge Functions sem credencial | retornam `401` |
| Todas as 40 funções com `verify_jwt=false` | autenticação própria verificada |
| Processador de IA com segredo interno | `200` em modo de diagnóstico |
| Jobs de cron | ativos e executando |
| Circuit breaker do follow-up | publicado na versão 8 |
| Rota profunda `/relatorios` | retorna SPA e redireciona para `/auth` |
| Tela de login em produção | renderizada em português, sem erro no console |
| Cabeçalhos de segurança | presentes em produção |
| Cache imutável de assets | presente em produção |
| Erros de runtime Vercel na última hora | nenhum |
| Alerta de credencial Evolution no artefato publicado | presente e validado |

## Alertas remanescentes deliberados

Os avisos restantes do advisor do Supabase não representam falhas abertas:

- tabelas utilizadas diretamente pelo frontend aparecem no schema GraphQL para
  usuários autenticados, mas o acesso efetivo continua limitado por RLS;
- sete funções de autorização ou operações controladas permanecem
  `SECURITY DEFINER` porque esse privilégio é necessário para evitar recursão
  de RLS ou executar operações validadas;
- índices recém-criados aparecem como “não utilizados” até acumularem
  estatísticas reais;
- políticas permissivas distintas representam os caminhos intencionais de
  administrador e corretor;
- a proteção contra senhas vazadas depende de uma opção do plano/painel do
  Supabase Auth e não pode ser alterada por migration.

O lint ainda registra avisos de tipagem explícita (`any`) em módulos legados.
Eles não bloqueiam TypeScript, testes, build ou CI e não correspondem aos erros
funcionais corrigidos. A substituição completa exige uma refatoração tipada por
domínio, recomendada como trabalho evolutivo para evitar conversões automáticas
que reduzam a segurança.

### Dependência operacional externa

A credencial legada da Evolution API armazenada em `system_settings` está sendo
rejeitada pelo próprio provedor com HTTP `401 Unauthorized`. Ela não contém
espaços acidentais, não existe uma instância nova em `evolution_instances` e não
há uma credencial Evolution alternativa no Vault. O último envio registrado
com sucesso ocorreu em 29/05/2026 e a rejeição começou em 02/06/2026.

Esse valor não pode ser regenerado pelo código, Supabase ou Vercel: ele precisa
ser emitido pela instalação Evolution API administrada pela MeMude. Enquanto
uma chave válida não for cadastrada, o circuit breaker mantém o cron saudável e
evita centenas de tentativas inúteis. Após a atualização da chave, o envio volta
a ser testado automaticamente ao fim da janela de 30 minutos.

Na verificação final, a última tentativa rejeitada ocorreu em
`27/07/2026 22:15:01 UTC`; não houve nova tentativa nos mais de 30 minutos
seguintes, confirmando que o circuit breaker interrompeu o ciclo de chamadas.

## Situação final

A versão corrigida está ativa em produção no projeto e domínio oficiais. Os
riscos P0 e os erros P1 diretamente corrigíveis foram implementados. A única
pendência que impede declarar o canal WhatsApp integralmente operacional é a
substituição da credencial Evolution expirada/revogada; os demais próximos
passos são evolutivos: ampliar testes autenticados de papéis, decompor módulos
legados e melhorar a tipagem dos fluxos de integração.
