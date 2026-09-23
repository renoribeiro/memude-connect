# Checklist de certificação de produção — MeMude Connect

**Data-base:** 13 de agosto de 2026
**Inventário:** 25 rotas; extraído estaticamente dos componentes alcançáveis por cada página.
**Regra de execução:** um item só recebe aprovação após teste com evidência. Ao falhar: registrar achado → diagnosticar causa → definir plano → implementar → revisar → retestar → somente então avançar.

## Legenda

- [ ] Não testado
- [x] Aprovado com evidência no relatório
- **BLOQUEADO**: depende de credencial, serviço externo ou decisão do responsável
- **FALHOU**: comportamento divergente; deve passar pelo ciclo de correção

## Gates globais

- [ ] Repositório e produção apontam para o mesmo commit.
- [x] Typecheck, lint e scanner de segredos aprovados (evidência: REL-001).
- [x] Testes unitários e de build/rotas aprovados (evidência: REL-002).
- [x] Build de produção e auditoria de dependências aprovados (evidência: REL-003).
- [x] Migrações locais e remotas reconciliadas e as três correções desta auditoria aplicadas (evidência: DB-001).
- [x] Todas as 83 tabelas públicas estão com RLS; grants dos novos RPCs restritos ao service_role (evidência: SEC-001).
- [x] As oito Edge Functions alteradas foram testadas negativamente e retornaram HTTP 401 sem credencial (evidência: SEC-002).
- [x] Filas de distribuição sem órfãos ou itens ativos antigos após reparo; crons recentes sem falha (evidência: OPS-001).
- [ ] Backup, restauração e rollback ensaiados em ambiente não produtivo.
- [ ] Testes E2E autenticados aprovados com contas sintéticas de admin, corretor e cliente.
- [ ] Navegadores Chrome/Edge/Safari e viewport móvel cobertos.
- [ ] Observabilidade, alertas e runbooks operacionais ativos.

## 1. /auth — AuthPage

- Acesso esperado: **público**
- Arquivo de entrada: `src/components/auth/AuthPage.tsx`
- Dependências identificadas: Tabelas: `profiles`, `user_roles`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 1.1 | submissão de formulário | form na linha 126 | src/components/auth/AuthPage.tsx:126 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 1.2 | entrada/seleção | seu@email.com | src/components/auth/AuthPage.tsx:134 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 1.3 | entrada/seleção | Sua senha | src/components/auth/AuthPage.tsx:154 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 1.4 | ação/botão | showPassword ? 'Ocultar senha' : 'Mostrar senha' | src/components/auth/AuthPage.tsx:162 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 1.5 | ação/botão | {isResetting ? 'Enviando instruções...' : 'Esqueci minha senha'} | src/components/auth/AuthPage.tsx:179 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 1.6 | ação/botão | {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar no Sistema | src/components/auth/AuthPage.tsx:189 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 2. /reset-password — ResetPasswordPage

- Acesso esperado: **público**
- Arquivo de entrada: `src/components/auth/ResetPasswordPage.tsx`
- Dependências identificadas: nenhuma dependência de dados direta
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 2.1 | ação/botão | Voltar ao login | src/components/auth/ResetPasswordPage.tsx:123 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 2.2 | submissão de formulário | form na linha 128 | src/components/auth/ResetPasswordPage.tsx:128 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 2.3 | entrada/seleção | password | src/components/auth/ResetPasswordPage.tsx:132 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 2.4 | ação/botão | showPassword ? 'Ocultar senha' : 'Mostrar senha' | src/components/auth/ResetPasswordPage.tsx:143 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 2.5 | entrada/seleção | confirmation | src/components/auth/ResetPasswordPage.tsx:157 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 2.6 | ação/botão | {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Atualizar senha | src/components/auth/ResetPasswordPage.tsx:168 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 3. /unauthorized — Unauthorized

- Acesso esperado: **público**
- Arquivo de entrada: `src/pages/Unauthorized.tsx`
- Dependências identificadas: Tabelas: `profiles`, `user_roles`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 3.1 | ação/botão | Ir para Início | src/pages/Unauthorized.tsx:73 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 3.2 | ação/botão | Voltar | src/pages/Unauthorized.tsx:80 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 3.3 | ação/botão | Fazer Login | src/pages/Unauthorized.tsx:90 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 3.4 | ação/botão | Sair da Conta | src/pages/Unauthorized.tsx:100 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 4. / — Index

- Acesso esperado: **autenticado**
- Arquivo de entrada: `src/pages/Index.tsx`
- Dependências identificadas: Tabelas: `bairros`, `construtoras`, `corretor_bairros`, `corretor_construtoras`, `corretores`, `empreendimentos`, `leads`, `notifications`, `profiles`, `user_roles`, `vendas`, `visitas`
Edge Functions: `create-notification`, `create-user`, `distribute-lead`, `distribute-visit`, `manage-user`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 4.1 | ação/botão | {isLeadModalOpen ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Users className="mr-2 h-4 w-4" /> )} Adicionar Lead Manualmente | src/components/dashboard/AdminDashboard.tsx:196 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.2 | ação/botão | {isCorretorModalOpen ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <UserCheck className="mr-2 h-4 w-4" /> )} Cadastrar Novo Corretor | src/components/dashboard/AdminDashboard.tsx:217 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.3 | ação/botão | {isEmpreendimentoModalOpen ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Building2 className="mr-2 h-4 w-4" /> )} Adicionar Empreendimento | src/components/dashboard/AdminDashboard.tsx:238 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.4 | ação/botão | Aprovar Corretores Pendentes | src/components/dashboard/AdminDashboard.tsx:259 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.5 | ação/botão | Configurar Meu Perfil Agora | src/components/dashboard/CorretorDashboard.tsx:182 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.6 | ação/botão | Ver Histórico de Visitas | src/components/dashboard/CorretorDashboard.tsx:342 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.7 | ação/botão | Button na linha 160 | src/components/dashboard/VisitsChart.tsx:160 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.8 | submissão de formulário | form na linha 595 | src/components/forms/CorretorForm.tsx:595 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 4.9 | ação/botão | Criar Novo Usuário | src/components/forms/CorretorForm.tsx:609 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.10 | ação/botão | Vincular a Usuário Existente | src/components/forms/CorretorForm.tsx:624 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.11 | entrada/seleção | selectedProfileId | src/components/forms/CorretorForm.tsx:647 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.12 | entrada/seleção | SelectTrigger na linha 656 | src/components/forms/CorretorForm.tsx:656 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.13 | entrada/seleção | Nome do usuário selecionado | src/components/forms/CorretorForm.tsx:676 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.14 | entrada/seleção | 000.000.000-00 | src/components/forms/CorretorForm.tsx:706 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.15 | entrada/seleção | corretor@email.com | src/components/forms/CorretorForm.tsx:730 | Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta. |
| [ ] 4.16 | entrada/seleção | Nome completo do corretor | src/components/forms/CorretorForm.tsx:745 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.17 | entrada/seleção | 000.000.000-00 | src/components/forms/CorretorForm.tsx:758 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.18 | entrada/seleção | corretor@email.com | src/components/forms/CorretorForm.tsx:800 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.19 | entrada/seleção | Número do CRECI | src/components/forms/CorretorForm.tsx:825 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.20 | entrada/seleção | Nome da cidade | src/components/forms/CorretorForm.tsx:837 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.21 | entrada/seleção | form.watch("estado") | src/components/forms/CorretorForm.tsx:849 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.22 | entrada/seleção | SelectTrigger na linha 850 | src/components/forms/CorretorForm.tsx:850 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.23 | entrada/seleção | form.watch("tipo_imovel") | src/components/forms/CorretorForm.tsx:870 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.24 | entrada/seleção | SelectTrigger na linha 871 | src/components/forms/CorretorForm.tsx:871 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.25 | entrada/seleção | form.watch("status") | src/components/forms/CorretorForm.tsx:889 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.26 | entrada/seleção | SelectTrigger na linha 890 | src/components/forms/CorretorForm.tsx:890 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.27 | entrada/seleção | Informações adicionais sobre o corretor... | src/components/forms/CorretorForm.tsx:946 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.28 | entrada/seleção | Buscar bairro... | src/components/forms/CorretorForm.tsx:970 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.29 | entrada/seleção | Checkbox na linha 981 | src/components/forms/CorretorForm.tsx:981 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.30 | entrada/seleção | Buscar construtora... | src/components/forms/CorretorForm.tsx:1030 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.31 | entrada/seleção | Checkbox na linha 1041 | src/components/forms/CorretorForm.tsx:1041 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.32 | entrada/seleção | Checkbox na linha 1053 | src/components/forms/CorretorForm.tsx:1053 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.33 | ação/botão | Cancelar | src/components/forms/CorretorForm.tsx:1094 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.34 | ação/botão | {(createCorretorMutation.isPending \|\| updateCorretorMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Cadastrar"} Corr | src/components/forms/CorretorForm.tsx:1097 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.35 | submissão de formulário | form na linha 152 | src/components/forms/EmpreendimentoForm.tsx:152 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 4.36 | entrada/seleção | Nome do empreendimento | src/components/forms/EmpreendimentoForm.tsx:164 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.37 | entrada/seleção | Select na linha 177 | src/components/forms/EmpreendimentoForm.tsx:177 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.38 | entrada/seleção | SelectTrigger na linha 181 | src/components/forms/EmpreendimentoForm.tsx:181 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.39 | entrada/seleção | Select na linha 199 | src/components/forms/EmpreendimentoForm.tsx:199 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.40 | entrada/seleção | SelectTrigger na linha 203 | src/components/forms/EmpreendimentoForm.tsx:203 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.41 | entrada/seleção | Endereço completo do empreendimento | src/components/forms/EmpreendimentoForm.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.42 | entrada/seleção | Descrição detalhada do empreendimento... | src/components/forms/EmpreendimentoForm.tsx:231 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.43 | entrada/seleção | 0 | src/components/forms/EmpreendimentoForm.tsx:253 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.44 | entrada/seleção | 0 | src/components/forms/EmpreendimentoForm.tsx:264 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.45 | entrada/seleção | Switch na linha 283 | src/components/forms/EmpreendimentoForm.tsx:283 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.46 | ação/botão | Cancelar | src/components/forms/EmpreendimentoForm.tsx:294 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.47 | ação/botão | {(createEmpreendimentoMutation.isPending \|\| updateEmpreendimentoMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Cria | src/components/forms/EmpreendimentoForm.tsx:297 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.48 | submissão de formulário | {!initialData?.id && ( <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-2"> <Switch id="cadastrar_sem_visita" checked={watch("cadas | src/components/forms/LeadForm.tsx:301 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 4.49 | entrada/seleção | Nome completo do lead | src/components/forms/LeadForm.tsx:305 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.50 | entrada/seleção | email@exemplo.com | src/components/forms/LeadForm.tsx:332 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.51 | entrada/seleção | watch("empreendimento_id") \|\| undefined | src/components/forms/LeadForm.tsx:345 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.52 | entrada/seleção | SelectTrigger na linha 349 | src/components/forms/LeadForm.tsx:349 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.53 | entrada/seleção | Switch na linha 369 | src/components/forms/LeadForm.tsx:369 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.54 | ação/botão | {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"} | src/components/forms/LeadForm.tsx:398 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.55 | entrada/seleção | watch("horario_visita_solicitada") \|\| "" | src/components/forms/LeadForm.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.56 | entrada/seleção | SelectTrigger na linha 433 | src/components/forms/LeadForm.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.57 | entrada/seleção | Select na linha 454 | src/components/forms/LeadForm.tsx:454 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.58 | entrada/seleção | SelectTrigger na linha 455 | src/components/forms/LeadForm.tsx:455 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.59 | entrada/seleção | Select na linha 473 | src/components/forms/LeadForm.tsx:473 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.60 | entrada/seleção | SelectTrigger na linha 474 | src/components/forms/LeadForm.tsx:474 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.61 | entrada/seleção | Informações adicionais sobre o lead... | src/components/forms/LeadForm.tsx:490 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 4.62 | ação/botão | Cancelar | src/components/forms/LeadForm.tsx:499 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.63 | ação/botão | {(createLeadMutation.isPending \|\| updateLeadMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Criar"} Lead | src/components/forms/LeadForm.tsx:502 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.64 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.65 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 4.66 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.67 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 4.68 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.69 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.70 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 4.71 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.72 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 4.73 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 5. /admin/users — UserManagement

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/UserManagement.tsx`
- Dependências identificadas: Tabelas: `corretores`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`, `create-user`, `manage-user`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 5.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 5.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 5.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 5.8 | submissão de formulário | {formData.role === 'corretor' && ( <div className="space-y-4 pt-4 border-t border-gray-100"> <div className="flex items-center gap-2 text-primary font-semibold text-sm"> <Award cla | src/components/modals/CreateUserModal.tsx:188 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 5.9 | entrada/seleção | Nome | src/components/modals/CreateUserModal.tsx:194 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.10 | entrada/seleção | Sobrenome | src/components/modals/CreateUserModal.tsx:206 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.11 | entrada/seleção | email@exemplo.com | src/components/modals/CreateUserModal.tsx:220 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.12 | entrada/seleção | (85) 99999-9999 | src/components/modals/CreateUserModal.tsx:234 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.13 | entrada/seleção | formData.role | src/components/modals/CreateUserModal.tsx:244 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.14 | entrada/seleção | SelectTrigger na linha 245 | src/components/modals/CreateUserModal.tsx:245 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.15 | entrada/seleção | Ex: 12345-F | src/components/modals/CreateUserModal.tsx:265 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.16 | entrada/seleção | Ex: 000.000.000-00 | src/components/modals/CreateUserModal.tsx:275 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.17 | entrada/seleção | Ex: (85) 99999-9999 | src/components/modals/CreateUserModal.tsx:286 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.18 | entrada/seleção | Ex: Fortaleza | src/components/modals/CreateUserModal.tsx:296 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.19 | entrada/seleção | corretorData.estado | src/components/modals/CreateUserModal.tsx:307 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.20 | entrada/seleção | SelectTrigger na linha 308 | src/components/modals/CreateUserModal.tsx:308 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.21 | entrada/seleção | corretorData.tipo_imovel | src/components/modals/CreateUserModal.tsx:344 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.22 | entrada/seleção | SelectTrigger na linha 345 | src/components/modals/CreateUserModal.tsx:345 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.23 | entrada/seleção | Informações adicionais do corretor... | src/components/modals/CreateUserModal.tsx:359 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.24 | ação/botão | Cancelar | src/components/modals/CreateUserModal.tsx:371 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.25 | ação/botão | {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'} | src/components/modals/CreateUserModal.tsx:378 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.26 | submissão de formulário | form na linha 238 | src/components/modals/EditUserModal.tsx:238 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 5.27 | entrada/seleção | Nome | src/components/modals/EditUserModal.tsx:245 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.28 | entrada/seleção | Sobrenome | src/components/modals/EditUserModal.tsx:257 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.29 | entrada/seleção | exemplo@email.com | src/components/modals/EditUserModal.tsx:269 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.30 | entrada/seleção | (85) 99999-9999 | src/components/modals/EditUserModal.tsx:283 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.31 | entrada/seleção | formData.role | src/components/modals/EditUserModal.tsx:295 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.32 | entrada/seleção | SelectTrigger na linha 296 | src/components/modals/EditUserModal.tsx:296 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.33 | entrada/seleção | Ex: 12345-F | src/components/modals/EditUserModal.tsx:316 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.34 | entrada/seleção | Ex: 000.000.000-00 | src/components/modals/EditUserModal.tsx:326 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.35 | entrada/seleção | Ex: (85) 99999-9999 | src/components/modals/EditUserModal.tsx:337 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.36 | entrada/seleção | Ex: Fortaleza | src/components/modals/EditUserModal.tsx:347 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.37 | entrada/seleção | corretorData.estado | src/components/modals/EditUserModal.tsx:358 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.38 | entrada/seleção | SelectTrigger na linha 359 | src/components/modals/EditUserModal.tsx:359 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.39 | entrada/seleção | corretorData.tipo_imovel | src/components/modals/EditUserModal.tsx:395 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.40 | entrada/seleção | SelectTrigger na linha 396 | src/components/modals/EditUserModal.tsx:396 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.41 | entrada/seleção | Informações adicionais do corretor... | src/components/modals/EditUserModal.tsx:410 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.42 | ação/botão | Cancelar | src/components/modals/EditUserModal.tsx:423 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.43 | ação/botão | {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'} | src/components/modals/EditUserModal.tsx:430 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.44 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.45 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.46 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.47 | ação/botão | Novo Usuário | src/pages/admin/UserManagement.tsx:166 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.48 | entrada/seleção | Buscar por nome, email ou função... | src/pages/admin/UserManagement.tsx:240 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 5.49 | ação/botão | Editar | src/pages/admin/UserManagement.tsx:313 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.50 | ação/botão | user.is_active === false ? 'Ativar' : 'Desativar' | src/pages/admin/UserManagement.tsx:324 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 5.51 | ação/botão | Excluir | src/pages/admin/UserManagement.tsx:337 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 6. /leads — Leads

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Leads.tsx`
- Dependências identificadas: Tabelas: `corretores`, `empreendimentos`, `leads`, `notifications`, `profiles`, `user_roles`, `visitas`
Edge Functions: `create-notification`, `distribute-lead`, `distribute-visit`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 6.1 | ação/botão | Button na linha 120 | src/components/actions/LeadActions.tsx:120 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.2 | ação/botão | Button na linha 138 | src/components/actions/LeadActions.tsx:138 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.3 | ação/botão | Cancelar | src/components/actions/LeadActions.tsx:162 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.4 | ação/botão | Excluir Definitivamente | src/components/actions/LeadActions.tsx:163 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.5 | ação/botão | Button na linha 178 | src/components/actions/LeadActions.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.6 | ação/botão | Cancelar | src/components/actions/LeadActions.tsx:203 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.7 | ação/botão | Mover para Lixeira | src/components/actions/LeadActions.tsx:204 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.8 | ação/botão | {updateStatusMutation.isPending ? ( <Loader2 className="w-3 h-3 animate-spin" /> ) : ( <> Alterar Status <ChevronDown className="w-3 h-3 ml-1" /> </> )} | src/components/actions/LeadStatusActions.tsx:134 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.9 | ação/botão | {config?.label \|\| status} | src/components/actions/LeadStatusActions.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.10 | submissão de formulário | {!initialData?.id && ( <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-2"> <Switch id="cadastrar_sem_visita" checked={watch("cadas | src/components/forms/LeadForm.tsx:301 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 6.11 | entrada/seleção | Nome completo do lead | src/components/forms/LeadForm.tsx:305 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.12 | entrada/seleção | email@exemplo.com | src/components/forms/LeadForm.tsx:332 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.13 | entrada/seleção | watch("empreendimento_id") \|\| undefined | src/components/forms/LeadForm.tsx:345 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.14 | entrada/seleção | SelectTrigger na linha 349 | src/components/forms/LeadForm.tsx:349 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.15 | entrada/seleção | Switch na linha 369 | src/components/forms/LeadForm.tsx:369 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.16 | ação/botão | {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"} | src/components/forms/LeadForm.tsx:398 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.17 | entrada/seleção | watch("horario_visita_solicitada") \|\| "" | src/components/forms/LeadForm.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.18 | entrada/seleção | SelectTrigger na linha 433 | src/components/forms/LeadForm.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.19 | entrada/seleção | Select na linha 454 | src/components/forms/LeadForm.tsx:454 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.20 | entrada/seleção | SelectTrigger na linha 455 | src/components/forms/LeadForm.tsx:455 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.21 | entrada/seleção | Select na linha 473 | src/components/forms/LeadForm.tsx:473 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.22 | entrada/seleção | SelectTrigger na linha 474 | src/components/forms/LeadForm.tsx:474 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.23 | entrada/seleção | Informações adicionais sobre o lead... | src/components/forms/LeadForm.tsx:490 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.24 | ação/botão | Cancelar | src/components/forms/LeadForm.tsx:499 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.25 | ação/botão | {(createLeadMutation.isPending \|\| updateLeadMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Criar"} Lead | src/components/forms/LeadForm.tsx:502 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.26 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.27 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 6.28 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.29 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 6.30 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.31 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.32 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 6.33 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.34 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.35 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.36 | ação/botão | Tentar Novamente | src/pages/admin/Leads.tsx:187 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.37 | ação/botão | {viewMode === 'active' ? ( <> <Trash2 className="w-4 h-4 mr-2" /> Ver Lixeira </> ) : ( <> <RotateCcw className="w-4 h-4 mr-2" /> Ver Ativos </> )} | src/pages/admin/Leads.tsx:212 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.38 | ação/botão | Novo Lead | src/pages/admin/Leads.tsx:229 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.39 | entrada/seleção | viewMode === 'active' ? "Buscar leads ativos..." : "Buscar leads na lixeira..." | src/pages/admin/Leads.tsx:303 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 6.40 | ação/botão | Button na linha 408 | src/pages/admin/Leads.tsx:408 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 6.41 | ação/botão | Button na linha 415 | src/pages/admin/Leads.tsx:415 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 7. /crm — CRM

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/CRM.tsx`
- Dependências identificadas: Tabelas: `crm_automations`, `crm_leads`, `crm_pipelines`, `crm_stages`, `leads`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`
RPCs: `save_crm_pipeline_configuration`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 7.1 | entrada/seleção | Buscar leads por nome, telefone ou email... | src/components/crm/AddLeadToPipelineModal.tsx:108 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.2 | ação/botão | button na linha 129 | src/components/crm/AddLeadToPipelineModal.tsx:129 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.3 | entrada/seleção | selectedStageId | src/components/crm/AddLeadToPipelineModal.tsx:156 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.4 | entrada/seleção | SelectTrigger na linha 160 | src/components/crm/AddLeadToPipelineModal.tsx:160 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.5 | entrada/seleção | 0,00 | src/components/crm/AddLeadToPipelineModal.tsx:182 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.6 | ação/botão | Cancelar | src/components/crm/AddLeadToPipelineModal.tsx:192 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.7 | ação/botão | {isAdding ? 'Adicionando...' : 'Adicionar ao Funil'} | src/components/crm/AddLeadToPipelineModal.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.8 | entrada/seleção | Ex: Funil de Captação | src/components/crm/CreatePipelineModal.tsx:55 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.9 | entrada/seleção | Descreva o objetivo deste funil... | src/components/crm/CreatePipelineModal.tsx:65 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.10 | ação/botão | Cancelar | src/components/crm/CreatePipelineModal.tsx:75 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.11 | ação/botão | {isCreating ? 'Criando...' : 'Criar Funil'} | src/components/crm/CreatePipelineModal.tsx:78 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.12 | entrada/seleção | Switch na linha 141 | src/components/crm/CrmAutomationsModal.tsx:141 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.13 | ação/botão | Button na linha 145 | src/components/crm/CrmAutomationsModal.tsx:145 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.14 | entrada/seleção | Ex: Visita realizada → Proposta | src/components/crm/CrmAutomationsModal.tsx:171 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.15 | entrada/seleção | triggerType | src/components/crm/CrmAutomationsModal.tsx:180 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.16 | entrada/seleção | SelectTrigger na linha 181 | src/components/crm/CrmAutomationsModal.tsx:181 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.17 | entrada/seleção | triggerValue | src/components/crm/CrmAutomationsModal.tsx:197 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.18 | entrada/seleção | SelectTrigger na linha 198 | src/components/crm/CrmAutomationsModal.tsx:198 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.19 | entrada/seleção | targetStageId | src/components/crm/CrmAutomationsModal.tsx:214 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.20 | entrada/seleção | SelectTrigger na linha 215 | src/components/crm/CrmAutomationsModal.tsx:215 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.21 | ação/botão | Cancelar | src/components/crm/CrmAutomationsModal.tsx:235 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.22 | ação/botão | Salvar | src/components/crm/CrmAutomationsModal.tsx:238 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.23 | ação/botão | Nova Automação | src/components/crm/CrmAutomationsModal.tsx:249 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.24 | entrada/seleção | 0,00 | src/components/crm/CrmLeadDetailPanel.tsx:182 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.25 | entrada/seleção | https://drive.google.com/drive/folders/... | src/components/crm/CrmLeadDetailPanel.tsx:196 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.26 | ação/botão | Abrir no Google Drive | src/components/crm/CrmLeadDetailPanel.tsx:205 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.27 | entrada/seleção | Anotações sobre este lead no funil... | src/components/crm/CrmLeadDetailPanel.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.28 | ação/botão | {isSaving ? 'Salvando...' : 'Salvar Alterações'} | src/components/crm/CrmLeadDetailPanel.tsx:230 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.29 | ação/botão | button na linha 139 | src/components/crm/KanbanBoard.tsx:139 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.30 | ação/botão | `Mais opções para o lead ${lead?.nome \|\| "Desconhecido"}` | src/components/crm/KanbanCard.tsx:54 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.31 | ação/botão | Remover do funil | src/components/crm/KanbanCard.tsx:64 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.32 | entrada/seleção | Ex: Funil de Vendas | src/components/crm/PipelineSettingsModal.tsx:188 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.33 | entrada/seleção | Opcional | src/components/crm/PipelineSettingsModal.tsx:197 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.34 | entrada/seleção | Switch na linha 211 | src/components/crm/PipelineSettingsModal.tsx:211 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.35 | ação/botão | Adicionar | src/components/crm/PipelineSettingsModal.tsx:219 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.36 | ação/botão | `Mover ${stage.nome \|\| `etapa ${index + 1}`} para cima` | src/components/crm/PipelineSettingsModal.tsx:232 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.37 | ação/botão | `Escolher cor de ${stage.nome \|\| `etapa ${index + 1}`}` | src/components/crm/PipelineSettingsModal.tsx:244 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.38 | ação/botão | `Usar a cor ${color}` | src/components/crm/PipelineSettingsModal.tsx:258 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.39 | entrada/seleção | `Etapa ${index + 1}` | src/components/crm/PipelineSettingsModal.tsx:277 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 7.40 | ação/botão | `Remover ${stage.nome \|\| `etapa ${index + 1}`}` | src/components/crm/PipelineSettingsModal.tsx:284 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.41 | ação/botão | Excluir Funil | src/components/crm/PipelineSettingsModal.tsx:311 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.42 | ação/botão | Cancelar | src/components/crm/PipelineSettingsModal.tsx:325 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.43 | ação/botão | {isSaving ? 'Salvando...' : 'Salvar'} | src/components/crm/PipelineSettingsModal.tsx:328 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.44 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.45 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 7.46 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.47 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 7.48 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.49 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.50 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 7.51 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.52 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.53 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.54 | ação/botão | p.id | src/pages/admin/CRM.tsx:121 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.55 | ação/botão | Novo Funil | src/pages/admin/CRM.tsx:125 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.56 | ação/botão | Automações | src/pages/admin/CRM.tsx:139 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.57 | ação/botão | Configurar | src/pages/admin/CRM.tsx:149 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.58 | ação/botão | Adicionar Lead | src/pages/admin/CRM.tsx:159 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 7.59 | ação/botão | Configurar Pipeline | src/pages/admin/CRM.tsx:244 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 8. /corretores — Corretores

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Corretores.tsx`
- Dependências identificadas: Tabelas: `bairros`, `construtoras`, `corretor_bairros`, `corretor_construtoras`, `corretores`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`, `create-user`, `google-sheets-sync`, `manage-user`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 8.1 | ação/botão | {restoreMutation.isPending ? ( <Loader2 className="w-3 h-3 mr-1 animate-spin" /> ) : ( <RotateCcw className="w-3 h-3 mr-1" /> )} Restaurar | src/components/actions/CorretorActions.tsx:168 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.2 | ação/botão | {updateStatusMutation.isPending ? ( <Loader2 className="w-3 h-3 mr-1 animate-spin" /> ) : ( <CheckCircle className="w-3 h-3 mr-1" /> )} Aprovar | src/components/actions/CorretorActions.tsx:189 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.3 | ação/botão | Rejeitar | src/components/actions/CorretorActions.tsx:204 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.4 | ação/botão | Cancelar | src/components/actions/CorretorActions.tsx:227 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.5 | ação/botão | Aprovar Corretor | src/components/actions/CorretorActions.tsx:228 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.6 | ação/botão | Cancelar | src/components/actions/CorretorActions.tsx:246 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.7 | ação/botão | Rejeitar Corretor | src/components/actions/CorretorActions.tsx:247 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.8 | ação/botão | {updateStatusMutation.isPending ? ( <Loader2 className="w-3 h-3 mr-1 animate-spin" /> ) : ( <Ban className="w-3 h-3 mr-1" /> )} Suspender | src/components/actions/CorretorActions.tsx:261 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.9 | ação/botão | Excluir | src/components/actions/CorretorActions.tsx:276 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.10 | ação/botão | Cancelar | src/components/actions/CorretorActions.tsx:299 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.11 | ação/botão | Suspender Corretor | src/components/actions/CorretorActions.tsx:300 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.12 | ação/botão | Cancelar | src/components/actions/CorretorActions.tsx:318 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.13 | ação/botão | Excluir Corretor | src/components/actions/CorretorActions.tsx:319 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.14 | ação/botão | {updateStatusMutation.isPending ? ( <Loader2 className="w-3 h-3 mr-1 animate-spin" /> ) : ( <CheckCircle className="w-3 h-3 mr-1" /> )} Reativar | src/components/actions/CorretorActions.tsx:331 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.15 | submissão de formulário | form na linha 595 | src/components/forms/CorretorForm.tsx:595 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 8.16 | ação/botão | Criar Novo Usuário | src/components/forms/CorretorForm.tsx:609 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.17 | ação/botão | Vincular a Usuário Existente | src/components/forms/CorretorForm.tsx:624 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.18 | entrada/seleção | selectedProfileId | src/components/forms/CorretorForm.tsx:647 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.19 | entrada/seleção | SelectTrigger na linha 656 | src/components/forms/CorretorForm.tsx:656 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.20 | entrada/seleção | Nome do usuário selecionado | src/components/forms/CorretorForm.tsx:676 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.21 | entrada/seleção | 000.000.000-00 | src/components/forms/CorretorForm.tsx:706 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.22 | entrada/seleção | corretor@email.com | src/components/forms/CorretorForm.tsx:730 | Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta. |
| [ ] 8.23 | entrada/seleção | Nome completo do corretor | src/components/forms/CorretorForm.tsx:745 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.24 | entrada/seleção | 000.000.000-00 | src/components/forms/CorretorForm.tsx:758 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.25 | entrada/seleção | corretor@email.com | src/components/forms/CorretorForm.tsx:800 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.26 | entrada/seleção | Número do CRECI | src/components/forms/CorretorForm.tsx:825 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.27 | entrada/seleção | Nome da cidade | src/components/forms/CorretorForm.tsx:837 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.28 | entrada/seleção | form.watch("estado") | src/components/forms/CorretorForm.tsx:849 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.29 | entrada/seleção | SelectTrigger na linha 850 | src/components/forms/CorretorForm.tsx:850 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.30 | entrada/seleção | form.watch("tipo_imovel") | src/components/forms/CorretorForm.tsx:870 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.31 | entrada/seleção | SelectTrigger na linha 871 | src/components/forms/CorretorForm.tsx:871 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.32 | entrada/seleção | form.watch("status") | src/components/forms/CorretorForm.tsx:889 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.33 | entrada/seleção | SelectTrigger na linha 890 | src/components/forms/CorretorForm.tsx:890 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.34 | entrada/seleção | Informações adicionais sobre o corretor... | src/components/forms/CorretorForm.tsx:946 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.35 | entrada/seleção | Buscar bairro... | src/components/forms/CorretorForm.tsx:970 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.36 | entrada/seleção | Checkbox na linha 981 | src/components/forms/CorretorForm.tsx:981 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.37 | entrada/seleção | Buscar construtora... | src/components/forms/CorretorForm.tsx:1030 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.38 | entrada/seleção | Checkbox na linha 1041 | src/components/forms/CorretorForm.tsx:1041 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.39 | entrada/seleção | Checkbox na linha 1053 | src/components/forms/CorretorForm.tsx:1053 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.40 | ação/botão | Cancelar | src/components/forms/CorretorForm.tsx:1094 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.41 | ação/botão | {(createCorretorMutation.isPending \|\| updateCorretorMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Cadastrar"} Corr | src/components/forms/CorretorForm.tsx:1097 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.42 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.43 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 8.44 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.45 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 8.46 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.47 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.48 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 8.49 | submissão de formulário | form na linha 98 | src/components/modals/ImportExportModal.tsx:98 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 8.50 | entrada/seleção | https://docs.google.com/spreadsheets/d/1ABC123... ou 1ABC123... | src/components/modals/ImportExportModal.tsx:107 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.51 | entrada/seleção | Sheet1!A:Z | src/components/modals/ImportExportModal.tsx:122 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.52 | ação/botão | Cancelar | src/components/modals/ImportExportModal.tsx:238 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.53 | ação/botão | {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {type === 'import' ? 'Importar' : 'Exportar'} | src/components/modals/ImportExportModal.tsx:247 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.54 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.55 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.56 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.57 | ação/botão | {viewMode === 'active' ? 'Ver Lixeira' : 'Ver Ativos'} | src/pages/admin/Corretores.tsx:147 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.58 | ação/botão | Importar | src/pages/admin/Corretores.tsx:156 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.59 | ação/botão | Exportar | src/pages/admin/Corretores.tsx:160 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.60 | ação/botão | Novo Corretor | src/pages/admin/Corretores.tsx:164 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.61 | entrada/seleção | Buscar corretores... | src/pages/admin/Corretores.tsx:238 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 8.62 | ação/botão | Ver | src/pages/admin/Corretores.tsx:348 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 8.63 | ação/botão | Editar | src/pages/admin/Corretores.tsx:359 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 9. /empreendimentos — Empreendimentos

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Empreendimentos.tsx`
- Dependências identificadas: Tabelas: `bairros`, `construtoras`, `empreendimentos`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 9.1 | submissão de formulário | form na linha 152 | src/components/forms/EmpreendimentoForm.tsx:152 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 9.2 | entrada/seleção | Nome do empreendimento | src/components/forms/EmpreendimentoForm.tsx:164 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.3 | entrada/seleção | Select na linha 177 | src/components/forms/EmpreendimentoForm.tsx:177 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.4 | entrada/seleção | SelectTrigger na linha 181 | src/components/forms/EmpreendimentoForm.tsx:181 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.5 | entrada/seleção | Select na linha 199 | src/components/forms/EmpreendimentoForm.tsx:199 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.6 | entrada/seleção | SelectTrigger na linha 203 | src/components/forms/EmpreendimentoForm.tsx:203 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.7 | entrada/seleção | Endereço completo do empreendimento | src/components/forms/EmpreendimentoForm.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.8 | entrada/seleção | Descrição detalhada do empreendimento... | src/components/forms/EmpreendimentoForm.tsx:231 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.9 | entrada/seleção | 0 | src/components/forms/EmpreendimentoForm.tsx:253 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.10 | entrada/seleção | 0 | src/components/forms/EmpreendimentoForm.tsx:264 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.11 | entrada/seleção | Switch na linha 283 | src/components/forms/EmpreendimentoForm.tsx:283 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.12 | ação/botão | Cancelar | src/components/forms/EmpreendimentoForm.tsx:294 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.13 | ação/botão | {(createEmpreendimentoMutation.isPending \|\| updateEmpreendimentoMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Cria | src/components/forms/EmpreendimentoForm.tsx:297 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.14 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.15 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 9.16 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.17 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 9.18 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.19 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.20 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 9.21 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.22 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.23 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.24 | ação/botão | Novo Empreendimento | src/pages/admin/Empreendimentos.tsx:85 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.25 | entrada/seleção | Buscar empreendimentos... | src/pages/admin/Empreendimentos.tsx:160 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 9.26 | ação/botão | Visualizar | src/pages/admin/Empreendimentos.tsx:242 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.27 | ação/botão | Editar | src/pages/admin/Empreendimentos.tsx:249 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 9.28 | ação/botão | {empreendimento.ativo ? 'Desativar' : 'Ativar'} | src/pages/admin/Empreendimentos.tsx:256 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 10. /visitas — Visitas

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Visitas.tsx`
- Dependências identificadas: Tabelas: `corretores`, `empreendimentos`, `leads`, `notifications`, `profiles`, `user_roles`, `visit_distribution_attempts`, `visitas`
Edge Functions: `create-notification`, `distribute-lead`, `distribute-visit`, `send-lead-to-crm`, `send-visit-reminder`
RPCs: `hard_delete_visita`, `restore_visita`, `soft_delete_visita`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 10.1 | ação/botão | Restaurar | src/components/actions/VisitaActions.tsx:261 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.2 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:278 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.3 | ação/botão | {restoreMutation.isPending ? "Restaurando..." : "Restaurar"} | src/components/actions/VisitaActions.tsx:279 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.4 | ação/botão | Excluir Permanentemente | src/components/actions/VisitaActions.tsx:293 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.5 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:310 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.6 | ação/botão | {hardDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir Permanentemente"} | src/components/actions/VisitaActions.tsx:311 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.7 | ação/botão | Detalhes | src/components/actions/VisitaActions.tsx:324 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.8 | ação/botão | Confirmar | src/components/actions/VisitaActions.tsx:342 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.9 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:359 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.10 | ação/botão | {updateStatusMutation.isPending ? "Confirmando..." : "Confirmar"} | src/components/actions/VisitaActions.tsx:360 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.11 | ação/botão | DialogTrigger na linha 374 | src/components/actions/VisitaActions.tsx:374 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.12 | ação/botão | Marcar Realizada | src/components/actions/VisitaActions.tsx:375 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.13 | entrada/seleção | Comentários ou feedback do lead sobre a visita... | src/components/actions/VisitaActions.tsx:403 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.14 | entrada/seleção | Switch na linha 413 | src/components/actions/VisitaActions.tsx:413 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.15 | entrada/seleção | Adicione seu feedback sobre esta visita... | src/components/actions/VisitaActions.tsx:425 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.16 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:435 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.17 | ação/botão | {updateStatusMutation.isPending ? "Salvando..." : "Marcar Realizada"} | src/components/actions/VisitaActions.tsx:445 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.18 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:461 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.19 | ação/botão | Não | src/components/actions/VisitaActions.tsx:478 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.20 | ação/botão | {updateStatusMutation.isPending ? "Cancelando..." : "Sim, Cancelar"} | src/components/actions/VisitaActions.tsx:479 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.21 | ação/botão | Remarcar | src/components/actions/VisitaActions.tsx:493 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.22 | ação/botão | {sendReminderMutation.isPending ? "Enviando..." : "Lembrete"} | src/components/actions/VisitaActions.tsx:506 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.23 | ação/botão | Detalhes | src/components/actions/VisitaActions.tsx:519 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.24 | ação/botão | Editar | src/components/actions/VisitaActions.tsx:530 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.25 | ação/botão | Excluir | src/components/actions/VisitaActions.tsx:543 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.26 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:560 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.27 | ação/botão | {softDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir"} | src/components/actions/VisitaActions.tsx:561 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.28 | ação/botão | Button na linha 165 | src/components/calendar/VisitasCalendar.tsx:165 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.29 | navegação/link | {visita.lead.telefone} | src/components/calendar/VisitasCalendar.tsx:206 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 10.30 | navegação/link | {visita.corretor_whatsapp} | src/components/calendar/VisitasCalendar.tsx:227 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 10.31 | submissão de formulário | {!initialData?.id && ( <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-2"> <Switch id="cadastrar_sem_visita" checked={watch("cadas | src/components/forms/LeadForm.tsx:301 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 10.32 | entrada/seleção | Nome completo do lead | src/components/forms/LeadForm.tsx:305 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.33 | entrada/seleção | email@exemplo.com | src/components/forms/LeadForm.tsx:332 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.34 | entrada/seleção | watch("empreendimento_id") \|\| undefined | src/components/forms/LeadForm.tsx:345 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.35 | entrada/seleção | SelectTrigger na linha 349 | src/components/forms/LeadForm.tsx:349 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.36 | entrada/seleção | Switch na linha 369 | src/components/forms/LeadForm.tsx:369 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.37 | ação/botão | {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"} | src/components/forms/LeadForm.tsx:398 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.38 | entrada/seleção | watch("horario_visita_solicitada") \|\| "" | src/components/forms/LeadForm.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.39 | entrada/seleção | SelectTrigger na linha 433 | src/components/forms/LeadForm.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.40 | entrada/seleção | Select na linha 454 | src/components/forms/LeadForm.tsx:454 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.41 | entrada/seleção | SelectTrigger na linha 455 | src/components/forms/LeadForm.tsx:455 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.42 | entrada/seleção | Select na linha 473 | src/components/forms/LeadForm.tsx:473 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.43 | entrada/seleção | SelectTrigger na linha 474 | src/components/forms/LeadForm.tsx:474 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.44 | entrada/seleção | Informações adicionais sobre o lead... | src/components/forms/LeadForm.tsx:490 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.45 | ação/botão | Cancelar | src/components/forms/LeadForm.tsx:499 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.46 | ação/botão | {(createLeadMutation.isPending \|\| updateLeadMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Criar"} Lead | src/components/forms/LeadForm.tsx:502 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.47 | submissão de formulário | {status === 'realizada' && ( <div className="space-y-4"> <div className="space-y-2"> <Label>Avaliação do Lead</Label> <div className="flex items-center gap-2"> <div className="flex | src/components/forms/VisitaForm.tsx:164 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 10.48 | entrada/seleção | watch('lead_id') | src/components/forms/VisitaForm.tsx:170 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.49 | entrada/seleção | SelectTrigger na linha 175 | src/components/forms/VisitaForm.tsx:175 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.50 | ação/botão | Adicionar novo lead | src/components/forms/VisitaForm.tsx:187 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.51 | entrada/seleção | watch('corretor_id') | src/components/forms/VisitaForm.tsx:207 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.52 | entrada/seleção | SelectTrigger na linha 212 | src/components/forms/VisitaForm.tsx:212 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.53 | entrada/seleção | Checkbox na linha 229 | src/components/forms/VisitaForm.tsx:229 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.54 | entrada/seleção | watch('empreendimento_id') \|\| '' | src/components/forms/VisitaForm.tsx:258 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.55 | entrada/seleção | SelectTrigger na linha 263 | src/components/forms/VisitaForm.tsx:263 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.56 | entrada/seleção | watch('status') \|\| 'agendada' | src/components/forms/VisitaForm.tsx:279 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.57 | entrada/seleção | SelectTrigger na linha 284 | src/components/forms/VisitaForm.tsx:284 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.58 | ação/botão | {selectedDate ? ( format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) ) : ( "Selecione uma data" )} | src/components/forms/VisitaForm.tsx:302 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.59 | entrada/seleção | watch('horario_visita') \|\| '' | src/components/forms/VisitaForm.tsx:336 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.60 | entrada/seleção | SelectTrigger na linha 340 | src/components/forms/VisitaForm.tsx:340 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.61 | entrada/seleção | Comentários ou feedback do lead sobre a visita... | src/components/forms/VisitaForm.tsx:374 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.62 | entrada/seleção | Seu feedback sobre a visita... | src/components/forms/VisitaForm.tsx:383 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.63 | ação/botão | Limpar | src/components/forms/VisitaForm.tsx:393 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.64 | ação/botão | {isLoading ? "Salvando..." : "Salvar Visita"} | src/components/forms/VisitaForm.tsx:401 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.65 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.66 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 10.67 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.68 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 10.69 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.70 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.71 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 10.72 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.73 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.74 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.75 | ação/botão | Nova Visita | src/pages/admin/Visitas.tsx:169 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.76 | ação/botão | Visitas Ativas | src/pages/admin/Visitas.tsx:239 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.77 | ação/botão | Lixeira | src/pages/admin/Visitas.tsx:247 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.78 | entrada/seleção | Buscar visitas... | src/pages/admin/Visitas.tsx:262 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 10.79 | ação/botão | list | src/pages/admin/Visitas.tsx:288 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.80 | ação/botão | calendar | src/pages/admin/Visitas.tsx:292 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 10.81 | ação/botão | distribution | src/pages/admin/Visitas.tsx:296 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 11. /vendas — Vendas

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Vendas.tsx`
- Dependências identificadas: Tabelas: `comprovantes`, `corretores`, `empreendimentos`, `leads`, `notifications`, `profiles`, `system_settings`, `user_roles`, `vendas`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 11.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 11.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 11.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 11.8 | submissão de formulário | {parseFloat(valorImovel) > 0 && ( <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 space-y-3"> <h4 className="text-sm font-semibold text-gray-700 flex items- | src/components/modals/VendaModal.tsx:440 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 11.9 | entrada/seleção | leadId | src/components/modals/VendaModal.tsx:445 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.10 | entrada/seleção | SelectTrigger na linha 446 | src/components/modals/VendaModal.tsx:446 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.11 | entrada/seleção | empreendimentoId | src/components/modals/VendaModal.tsx:460 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.12 | entrada/seleção | SelectTrigger na linha 461 | src/components/modals/VendaModal.tsx:461 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.13 | entrada/seleção | corretorId | src/components/modals/VendaModal.tsx:479 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.14 | entrada/seleção | SelectTrigger na linha 484 | src/components/modals/VendaModal.tsx:484 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.15 | entrada/seleção | {vendaDireta && ( <Badge variant="secondary" className="text-xs">100% MeMude</Badge> )} | src/components/modals/VendaModal.tsx:497 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.16 | entrada/seleção | 500000.00 | src/components/modals/VendaModal.tsx:517 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.17 | entrada/seleção | comissaoPercentual | src/components/modals/VendaModal.tsx:527 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.18 | entrada/seleção | impostoPercentual | src/components/modals/VendaModal.tsx:536 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.19 | ação/botão | {format(dataVenda, 'dd/MM/yyyy', { locale: ptBR })} | src/components/modals/VendaModal.tsx:598 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.20 | ação/botão | {dataPagamento ? format(dataPagamento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'} | src/components/modals/VendaModal.tsx:617 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.21 | entrada/seleção | status | src/components/modals/VendaModal.tsx:636 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.22 | entrada/seleção | SelectTrigger na linha 637 | src/components/modals/VendaModal.tsx:637 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.23 | entrada/seleção | Observações adicionais sobre a venda... | src/components/modals/VendaModal.tsx:653 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.24 | navegação/link | fileName | src/components/modals/VendaModal.tsx:677 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 11.25 | ação/botão | `Remover ${fileName}` | src/components/modals/VendaModal.tsx:691 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.26 | ação/botão | {isUploading ? ( <> <Loader2 className="h-3 w-3 animate-spin" /> Enviando... </> ) : ( <> <Paperclip className="h-3 w-3" /> Anexar Comprovante </> )} | src/components/modals/VendaModal.tsx:714 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.27 | ação/botão | Cancelar | src/components/modals/VendaModal.tsx:738 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.28 | ação/botão | {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isEditing ? 'Salvar Alterações' : 'Registrar Venda'} | src/components/modals/VendaModal.tsx:741 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.29 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.30 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.31 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.32 | ação/botão | Nova Venda | src/pages/admin/Vendas.tsx:141 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 11.33 | entrada/seleção | Buscar por cliente, empreendimento ou corretor... | src/pages/admin/Vendas.tsx:195 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.34 | entrada/seleção | filterStatus | src/pages/admin/Vendas.tsx:202 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 11.35 | entrada/seleção | SelectTrigger na linha 203 | src/pages/admin/Vendas.tsx:203 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 12. /comunicacoes — Comunicacoes

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Comunicacoes.tsx`
- Dependências identificadas: Tabelas: `communication_log`, `corretores`, `leads`, `notifications`, `profiles`, `template_variables`, `user_roles`
Edge Functions: `create-notification`, `evolution-send-whatsapp-v2`, `template-manager`, `template-renderer`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 12.1 | submissão de formulário | {recipientType !== 'broadcast' && ( <div className="space-y-2"> <Label htmlFor="recipient_id"> {recipientType === 'lead' ? 'Selecionar Lead' : 'Selecionar Corretor'} </Label> <Sele | src/components/forms/CommunicationForm.tsx:101 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 12.2 | ação/botão | {getTypeIcon('whatsapp')} WhatsApp | src/components/forms/CommunicationForm.tsx:106 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.3 | ação/botão | Provedor de SMS não configurado | src/components/forms/CommunicationForm.tsx:110 | Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta. |
| [ ] 12.4 | ação/botão | Envio avulso de e-mail não configurado | src/components/forms/CommunicationForm.tsx:113 | Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta. |
| [ ] 12.5 | ação/botão | Lead | src/components/forms/CommunicationForm.tsx:126 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.6 | ação/botão | Corretor | src/components/forms/CommunicationForm.tsx:135 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.7 | ação/botão | Broadcast | src/components/forms/CommunicationForm.tsx:144 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.8 | entrada/seleção | Select na linha 162 | src/components/forms/CommunicationForm.tsx:162 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.9 | entrada/seleção | SelectTrigger na linha 163 | src/components/forms/CommunicationForm.tsx:163 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.10 | entrada/seleção | +55 85 99999-9999 | src/components/forms/CommunicationForm.tsx:193 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.11 | ação/botão | {template.name} | src/components/forms/CommunicationForm.tsx:212 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.12 | entrada/seleção | Digite sua mensagem aqui... | src/components/forms/CommunicationForm.tsx:228 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.13 | ação/botão | Limpar | src/components/forms/CommunicationForm.tsx:242 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.14 | ação/botão | {isLoading ? "Enviando..." : "Enviar Comunicação"} | src/components/forms/CommunicationForm.tsx:250 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.15 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.16 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 12.17 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.18 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 12.19 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.20 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.21 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 12.22 | ação/botão | Button na linha 212 | src/components/modals/TemplateModal.tsx:212 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.23 | submissão de formulário | {formData.type === 'email' && ( <div className="space-y-2"> <Label htmlFor="subject">Assunto do E-mail</Label> <Input id="subject" value={formData.subject} onChange={(e) => setForm | src/components/modals/TemplateModal.tsx:232 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 12.24 | entrada/seleção | Ex: Distribuição de Lead - Bairro | src/components/modals/TemplateModal.tsx:237 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.25 | entrada/seleção | Switch na linha 250 | src/components/modals/TemplateModal.tsx:250 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.26 | entrada/seleção | formData.category | src/components/modals/TemplateModal.tsx:264 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.27 | entrada/seleção | SelectTrigger na linha 265 | src/components/modals/TemplateModal.tsx:265 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.28 | entrada/seleção | formData.type | src/components/modals/TemplateModal.tsx:279 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.29 | entrada/seleção | SelectTrigger na linha 280 | src/components/modals/TemplateModal.tsx:280 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.30 | entrada/seleção | Ex: Confirmação de Visita - {nome_empreendimento} | src/components/modals/TemplateModal.tsx:296 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.31 | ação/botão | text | src/components/modals/TemplateModal.tsx:309 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.32 | ação/botão | buttons | src/components/modals/TemplateModal.tsx:310 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.33 | ação/botão | media | src/components/modals/TemplateModal.tsx:311 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.34 | ação/botão | list | src/components/modals/TemplateModal.tsx:312 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.35 | ação/botão | Inserir Variável | src/components/modals/TemplateModal.tsx:319 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.36 | entrada/seleção | Use {variavel} para inserir variáveis dinâmicas | src/components/modals/TemplateModal.tsx:329 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.37 | entrada/seleção | Texto da mensagem | src/components/modals/TemplateModal.tsx:343 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.38 | ação/botão | Adicionar Botão | src/components/modals/TemplateModal.tsx:354 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.39 | entrada/seleção | ID do botão | src/components/modals/TemplateModal.tsx:362 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.40 | entrada/seleção | Texto do botão | src/components/modals/TemplateModal.tsx:367 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.41 | ação/botão | Button na linha 372 | src/components/modals/TemplateModal.tsx:372 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.42 | entrada/seleção | mediaType | src/components/modals/TemplateModal.tsx:389 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.43 | entrada/seleção | SelectTrigger na linha 390 | src/components/modals/TemplateModal.tsx:390 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.44 | entrada/seleção | https://... | src/components/modals/TemplateModal.tsx:404 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.45 | entrada/seleção | Legenda da mídia | src/components/modals/TemplateModal.tsx:413 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.46 | entrada/seleção | Título principal | src/components/modals/TemplateModal.tsx:425 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.47 | entrada/seleção | listDescription | src/components/modals/TemplateModal.tsx:434 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.48 | entrada/seleção | Ver opções | src/components/modals/TemplateModal.tsx:443 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.49 | ação/botão | Adicionar Seção | src/components/modals/TemplateModal.tsx:453 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.50 | entrada/seleção | Título da seção | src/components/modals/TemplateModal.tsx:461 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.51 | ação/botão | Adicionar Item | src/components/modals/TemplateModal.tsx:470 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.52 | ação/botão | Inserir Variável | src/components/modals/TemplateModal.tsx:489 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.53 | entrada/seleção | Digite o conteúdo da mensagem. Use {variavel} para inserir dados dinâmicos. | src/components/modals/TemplateModal.tsx:499 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.54 | ação/botão | Button na linha 525 | src/components/modals/TemplateModal.tsx:525 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.55 | ação/botão | Cancelar | src/components/modals/TemplateModal.tsx:544 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.56 | ação/botão | {isLoading ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Template')} | src/components/modals/TemplateModal.tsx:547 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.57 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.58 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.59 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.60 | ação/botão | template.is_system ? "Editar template do sistema" : "Editar template" | src/components/templates/TemplateCard.tsx:93 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.61 | ação/botão | Button na linha 105 | src/components/templates/TemplateCard.tsx:105 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.62 | ação/botão | Visualizar | src/components/templates/TemplateCard.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.63 | ação/botão | Duplicar | src/components/templates/TemplateCard.tsx:114 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.64 | ação/botão | Excluir | src/components/templates/TemplateCard.tsx:119 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.65 | ação/botão | Cancelar | src/components/templates/TemplateCard.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.66 | ação/botão | Excluir | src/components/templates/TemplateCard.tsx:196 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.67 | ação/botão | Novo Template | src/components/templates/TemplateManager.tsx:65 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.68 | entrada/seleção | Buscar templates... | src/components/templates/TemplateManager.tsx:76 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.69 | entrada/seleção | categoryFilter | src/components/templates/TemplateManager.tsx:86 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.70 | entrada/seleção | SelectTrigger na linha 87 | src/components/templates/TemplateManager.tsx:87 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.71 | entrada/seleção | typeFilter | src/components/templates/TemplateManager.tsx:98 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.72 | entrada/seleção | SelectTrigger na linha 99 | src/components/templates/TemplateManager.tsx:99 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.73 | entrada/seleção | systemFilter | src/components/templates/TemplateManager.tsx:110 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.74 | entrada/seleção | SelectTrigger na linha 111 | src/components/templates/TemplateManager.tsx:111 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.75 | ação/botão | Limpar filtros | src/components/templates/TemplateManager.tsx:137 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.76 | ação/botão | Button na linha 75 | src/components/templates/TemplatePreview.tsx:75 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.77 | ação/botão | {renderTemplate.isPending ? 'Gerando...' : 'Gerar Preview'} | src/components/templates/TemplatePreview.tsx:124 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.78 | entrada/seleção | template.content | src/components/templates/TemplatePreview.tsx:135 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.79 | entrada/seleção | Buscar variáveis... | src/components/templates/VariableSelector.tsx:60 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.80 | ação/botão | Button na linha 99 | src/components/templates/VariableSelector.tsx:99 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.81 | ação/botão | Nova Comunicação | src/pages/admin/Comunicacoes.tsx:196 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.82 | ação/botão | comunicacoes | src/pages/admin/Comunicacoes.tsx:209 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.83 | ação/botão | templates | src/pages/admin/Comunicacoes.tsx:213 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.84 | entrada/seleção | Buscar comunicações... | src/pages/admin/Comunicacoes.tsx:280 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 12.85 | ação/botão | Detalhes | src/pages/admin/Comunicacoes.tsx:384 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 12.86 | ação/botão | Reenviar | src/pages/admin/Comunicacoes.tsx:395 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 13. /relatorios — Relatorios

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Relatorios.tsx`
- Dependências identificadas: Tabelas: `corretores`, `leads`, `notifications`, `profiles`, `report_templates`, `scheduled_reports`, `user_roles`, `vendas`, `visitas`
Edge Functions: `create-notification`, `export-reports`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 13.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 13.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 13.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 13.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.11 | ação/botão | Imprimir / PDF | src/components/reports/GeneratedReportDialog.tsx:218 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.12 | ação/botão | JSON | src/components/reports/GeneratedReportDialog.tsx:222 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.13 | ação/botão | CSV | src/components/reports/GeneratedReportDialog.tsx:226 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.14 | ação/botão | Fechar | src/components/reports/GeneratedReportDialog.tsx:495 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.15 | ação/botão | Salvar Template | src/components/reports/ReportBuilder.tsx:185 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.16 | ação/botão | Gerar Relatório | src/components/reports/ReportBuilder.tsx:189 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.17 | entrada/seleção | Ex: Relatório Mensal de Performance | src/components/reports/ReportBuilder.tsx:210 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.18 | entrada/seleção | Descreva o objetivo deste relatório... | src/components/reports/ReportBuilder.tsx:219 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.19 | entrada/seleção | config.period | src/components/reports/ReportBuilder.tsx:228 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.20 | entrada/seleção | SelectTrigger na linha 229 | src/components/reports/ReportBuilder.tsx:229 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.21 | entrada/seleção | config.filters?.date_range \|\| 'last_30_days' | src/components/reports/ReportBuilder.tsx:258 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.22 | entrada/seleção | SelectTrigger na linha 265 | src/components/reports/ReportBuilder.tsx:265 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.23 | entrada/seleção | config.filters?.status \|\| 'all' | src/components/reports/ReportBuilder.tsx:279 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.24 | entrada/seleção | SelectTrigger na linha 286 | src/components/reports/ReportBuilder.tsx:286 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.25 | entrada/seleção | Checkbox na linha 314 | src/components/reports/ReportBuilder.tsx:314 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.26 | entrada/seleção | Checkbox na linha 344 | src/components/reports/ReportBuilder.tsx:344 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.27 | ação/botão | Novo Template | src/components/reports/ReportTemplateManager.tsx:173 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.28 | entrada/seleção | Buscar templates... | src/components/reports/ReportTemplateManager.tsx:183 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.29 | ação/botão | Todos | src/components/reports/ReportTemplateManager.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.30 | ação/botão | {getCategoryIcon(category)} {getCategoryLabel(category)} | src/components/reports/ReportTemplateManager.tsx:199 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.31 | ação/botão | Button na linha 248 | src/components/reports/ReportTemplateManager.tsx:248 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.32 | ação/botão | `Editar template ${template.name}` | src/components/reports/ReportTemplateManager.tsx:255 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.33 | ação/botão | Button na linha 264 | src/components/reports/ReportTemplateManager.tsx:264 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.34 | submissão de formulário | {!template && ( <div className="space-y-2"> <Label htmlFor="template_id">Selecione o Relatório Template *</Label> <Select value={selectedTemplateId} onValueChange={setSelectedTempl | src/components/reports/ScheduleReportModal.tsx:217 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 13.35 | entrada/seleção | selectedTemplateId | src/components/reports/ScheduleReportModal.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.36 | entrada/seleção | SelectTrigger na linha 226 | src/components/reports/ScheduleReportModal.tsx:226 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.37 | entrada/seleção | formData.schedule_type | src/components/reports/ScheduleReportModal.tsx:246 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.38 | entrada/seleção | SelectTrigger na linha 252 | src/components/reports/ScheduleReportModal.tsx:252 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.39 | entrada/seleção | email@exemplo.com | src/components/reports/ScheduleReportModal.tsx:295 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.40 | ação/botão | Button na linha 304 | src/components/reports/ScheduleReportModal.tsx:304 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.41 | ação/botão | + Adicionar Destinatário | src/components/reports/ScheduleReportModal.tsx:316 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.42 | entrada/seleção | template ? `Relatório ${template.name}` : "Assunto do email" | src/components/reports/ScheduleReportModal.tsx:330 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.43 | entrada/seleção | Adicione uma mensagem personalizada para acompanhar o relatório... | src/components/reports/ScheduleReportModal.tsx:341 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 13.44 | ação/botão | Cancelar | src/components/reports/ScheduleReportModal.tsx:372 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.45 | ação/botão | {scheduleReportMutation.isPending ? 'Agendando...' : 'Agendar Relatório'} | src/components/reports/ScheduleReportModal.tsx:379 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.46 | ação/botão | Agendar Relatório | src/pages/admin/Relatorios.tsx:488 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.47 | ação/botão | Exportar Dados | src/pages/admin/Relatorios.tsx:496 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.48 | ação/botão | dashboard | src/pages/admin/Relatorios.tsx:509 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.49 | ação/botão | templates | src/pages/admin/Relatorios.tsx:513 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.50 | ação/botão | builder | src/pages/admin/Relatorios.tsx:517 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.51 | ação/botão | scheduled | src/pages/admin/Relatorios.tsx:521 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.52 | ação/botão | Cancelar Agendamento | src/pages/admin/Relatorios.tsx:738 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 13.53 | ação/botão | Agendar Primeiro Relatório | src/pages/admin/Relatorios.tsx:755 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 14. /sincronizacao-wordpress — SincronizacaoWordpress

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/SincronizacaoWordpress.tsx`
- Dependências identificadas: Tabelas: `notifications`, `profiles`, `system_settings`, `user_roles`, `wp_sync_log`, `wp_sync_performance`
Edge Functions: `create-notification`, `sync-wordpress-properties`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 14.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 14.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 14.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 14.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.11 | entrada/seleção | https://memude.com.br | src/components/wordpress/WordPressSettings.tsx:226 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 14.12 | ação/botão | Testar | src/components/wordpress/WordPressSettings.tsx:232 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.13 | entrada/seleção | config.sync_interval_hours | src/components/wordpress/WordPressSettings.tsx:253 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 14.14 | entrada/seleção | config.posts_per_batch | src/components/wordpress/WordPressSettings.tsx:268 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 14.15 | entrada/seleção | Switch na linha 291 | src/components/wordpress/WordPressSettings.tsx:291 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 14.16 | entrada/seleção | Switch na linha 305 | src/components/wordpress/WordPressSettings.tsx:305 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 14.17 | ação/botão | {isSaving ? ( <> <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Salvando... </> ) : ( 'Salvar Configurações' )} | src/components/wordpress/WordPressSettings.tsx:325 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.18 | ação/botão | Atualizar | src/pages/admin/SincronizacaoWordpress.tsx:287 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.19 | ação/botão | {isSyncing ? ( <> <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Testando... </> ) : ( <> <CheckCircle className="w-4 h-4 mr-2" /> Testar Conexão </> )} | src/pages/admin/SincronizacaoWordpress.tsx:296 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.20 | ação/botão | {isSyncing ? ( <> <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sincronizando... </> ) : ( <> <Play className="w-4 h-4 mr-2" /> Sincronização Completa </> )} | src/pages/admin/SincronizacaoWordpress.tsx:314 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.21 | ação/botão | logs | src/pages/admin/SincronizacaoWordpress.tsx:443 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.22 | ação/botão | performance | src/pages/admin/SincronizacaoWordpress.tsx:444 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 14.23 | ação/botão | settings | src/pages/admin/SincronizacaoWordpress.tsx:445 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 15. /configuracoes — Configuracoes

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Configuracoes.tsx`
- Dependências identificadas: Tabelas: `communication_log`, `corretores`, `distribution_attempts`, `distribution_metrics`, `distribution_queue`, `distribution_settings`, `evolution_instances`, `integration_logs`, `leads`, `notifications`, `profiles`, `system_settings`, `user_roles`, `visit_distribution_attempts`, `visit_distribution_queue`, `webhook_logs`
Edge Functions: `create-notification`, `distribute-lead`, `distribution-timeout-checker`, `evolution-manager`, `evolution-send-whatsapp-v2`, `test-webhook`, `waha-check-connection`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 15.1 | ação/botão | {format(options.startDate, "dd/MM/yyyy")} | src/components/automation/DistributionExporter.tsx:385 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.2 | ação/botão | {format(options.endDate, "dd/MM/yyyy")} | src/components/automation/DistributionExporter.tsx:406 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.3 | entrada/seleção | options.format | src/components/automation/DistributionExporter.tsx:427 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.4 | entrada/seleção | SelectTrigger na linha 433 | src/components/automation/DistributionExporter.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.5 | entrada/seleção | Checkbox na linha 448 | src/components/automation/DistributionExporter.tsx:448 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.6 | entrada/seleção | Checkbox na linha 459 | src/components/automation/DistributionExporter.tsx:459 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.7 | entrada/seleção | Checkbox na linha 470 | src/components/automation/DistributionExporter.tsx:470 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.8 | entrada/seleção | Checkbox na linha 481 | src/components/automation/DistributionExporter.tsx:481 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.9 | ação/botão | {isExporting ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando... </> ) : ( <> <FileText className="mr-2 h-4 w-4" /> Exportar Relatório </> )} | src/components/automation/DistributionExporter.tsx:494 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.10 | ação/botão | {format(startDate, "dd/MM/yyyy")} | src/components/automation/DistributionMonitor.tsx:227 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.11 | ação/botão | {format(endDate, "dd/MM/yyyy")} | src/components/automation/DistributionMonitor.tsx:248 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.12 | ação/botão | Atualizar | src/components/automation/DistributionMonitor.tsx:265 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.13 | ação/botão | overview | src/components/automation/DistributionMonitor.tsx:343 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.14 | ação/botão | queue | src/components/automation/DistributionMonitor.tsx:344 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.15 | ação/botão | history | src/components/automation/DistributionMonitor.tsx:345 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.16 | ação/botão | export | src/components/automation/DistributionMonitor.tsx:346 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.17 | ação/botão | test | src/components/automation/DistributionMonitor.tsx:347 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.18 | entrada/seleção | +5585999999999 ou 85999999999 | src/components/automation/DistributionTester.tsx:208 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.19 | entrada/seleção | Digite sua mensagem de teste... | src/components/automation/DistributionTester.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.20 | ação/botão | {isTestingWhatsApp ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando... </> ) : ( <> <Send className="mr-2 h-4 w-4" /> Enviar Teste WhatsApp </> )} | src/components/automation/DistributionTester.tsx:236 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.21 | entrada/seleção | selectedLeadId | src/components/automation/DistributionTester.tsx:270 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.22 | entrada/seleção | SelectTrigger na linha 275 | src/components/automation/DistributionTester.tsx:275 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.23 | ação/botão | {isTestingDistribution ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Distribuindo... </> ) : ( <> <Users className="mr-2 h-4 w-4" /> Iniciar Distribuição </> )} | src/components/automation/DistributionTester.tsx:312 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.24 | ação/botão | {isCheckingTimeouts ? ( <Loader2 className="h-4 w-4 animate-spin" /> ) : ( <AlertTriangle className="h-4 w-4" /> )} | src/components/automation/DistributionTester.tsx:346 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.25 | ação/botão | Button na linha 365 | src/components/automation/DistributionTester.tsx:365 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.26 | entrada/seleção | Switch na linha 222 | src/components/automation/LeadDistribution.tsx:222 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.27 | ação/botão | Distribuir Agora | src/components/automation/LeadDistribution.tsx:233 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.28 | ação/botão | Cancelar | src/components/automation/LeadDistribution.tsx:246 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.29 | ação/botão | {autoDistributeMutation.isPending ? "Distribuindo..." : "Confirmar"} | src/components/automation/LeadDistribution.tsx:247 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.30 | entrada/seleção | {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />} | src/components/automation/LeadDistribution.tsx:335 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.31 | entrada/seleção | {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />} | src/components/automation/LeadDistribution.tsx:348 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.32 | entrada/seleção | {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />} | src/components/automation/LeadDistribution.tsx:361 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.33 | entrada/seleção | {updateWeightsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin my-auto" />} | src/components/automation/LeadDistribution.tsx:374 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.34 | entrada/seleção | Switch na linha 118 | src/components/automation/VisitDistributionSettings.tsx:118 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.35 | entrada/seleção | formData.max_attempts | src/components/automation/VisitDistributionSettings.tsx:133 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.36 | entrada/seleção | formData.timeout_minutes | src/components/automation/VisitDistributionSettings.tsx:154 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.37 | entrada/seleção | Switch na linha 180 | src/components/automation/VisitDistributionSettings.tsx:180 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.38 | ação/botão | {updateMutation.isPending ? 'Salvando...' : 'Salvar Configurações'} | src/components/automation/VisitDistributionSettings.tsx:190 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.39 | ação/botão | {autoRefresh ? 'Pausar' : 'Ativar'} Auto-Refresh | src/components/automation/WebhookMonitor.tsx:185 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.40 | ação/botão | Button na linha 192 | src/components/automation/WebhookMonitor.tsx:192 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.41 | ação/botão | {expandedLog === log.id ? ( <ChevronUp className="w-4 h-4" /> ) : ( <ChevronDown className="w-4 h-4" /> )} | src/components/automation/WebhookMonitor.tsx:241 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.42 | ação/botão | Nova Instância | src/components/configuracoes/EvolutionInstances.tsx:254 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.43 | ação/botão | Cadastrar chave válida | src/components/configuracoes/EvolutionInstances.tsx:276 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.44 | ação/botão | Conectar (QR Code) | src/components/configuracoes/EvolutionInstances.tsx:325 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.45 | ação/botão | Dashboard de Status | src/components/configuracoes/EvolutionInstances.tsx:333 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.46 | ação/botão | Verificar Conexão | src/components/configuracoes/EvolutionInstances.tsx:341 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.47 | ação/botão | Reiniciar | src/components/configuracoes/EvolutionInstances.tsx:354 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.48 | ação/botão | Logout (Desconectar) | src/components/configuracoes/EvolutionInstances.tsx:366 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.49 | ação/botão | Editar Configurações | src/components/configuracoes/EvolutionInstances.tsx:378 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.50 | ação/botão | Excluir Instância | src/components/configuracoes/EvolutionInstances.tsx:386 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.51 | submissão de formulário | form na linha 415 | src/components/configuracoes/EvolutionInstances.tsx:415 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 15.52 | entrada/seleção | Ex: Produção Principal | src/components/configuracoes/EvolutionInstances.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.53 | entrada/seleção | Ex: my-instance | src/components/configuracoes/EvolutionInstances.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.54 | entrada/seleção | https://api.evolution.com | src/components/configuracoes/EvolutionInstances.tsx:437 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.55 | entrada/seleção | editingInstance ? 'Deixe em branco para manter a chave atual' : 'Informe a chave da API' | src/components/configuracoes/EvolutionInstances.tsx:441 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.56 | entrada/seleção | is_active | src/components/configuracoes/EvolutionInstances.tsx:451 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.57 | ação/botão | Cancelar | src/components/configuracoes/EvolutionInstances.tsx:456 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.58 | ação/botão | {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar | src/components/configuracoes/EvolutionInstances.tsx:457 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.59 | ação/botão | Fechar | src/components/configuracoes/EvolutionInstances.tsx:486 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.60 | ação/botão | Fechar | src/components/configuracoes/EvolutionInstances.tsx:510 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.61 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.62 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.63 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.64 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.65 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.66 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.67 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.68 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.69 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.70 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.71 | ação/botão | geral | src/pages/admin/Configuracoes.tsx:321 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.72 | ação/botão | comunicacao | src/pages/admin/Configuracoes.tsx:325 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.73 | ação/botão | integracao | src/pages/admin/Configuracoes.tsx:329 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.74 | ação/botão | automacao | src/pages/admin/Configuracoes.tsx:333 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.75 | ação/botão | automacao-visitas | src/pages/admin/Configuracoes.tsx:337 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.76 | ação/botão | financeiro | src/pages/admin/Configuracoes.tsx:341 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.77 | entrada/seleção | {isSaving === 'company_name' && <Loader2 className="w-4 h-4 animate-spin ml-2" />} | src/pages/admin/Configuracoes.tsx:356 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.78 | entrada/seleção | {isSaving === 'company_phone' && <Loader2 className="w-4 h-4 animate-spin ml-2" />} | src/pages/admin/Configuracoes.tsx:366 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.79 | entrada/seleção | {isSaving === 'company_email' && <Loader2 className="w-4 h-4 animate-spin ml-2" />} | src/pages/admin/Configuracoes.tsx:377 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.80 | entrada/seleção | {isSaving === 'lead_auto_assign' && <Loader2 className="w-4 h-4 animate-spin" />} | src/pages/admin/Configuracoes.tsx:402 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.81 | entrada/seleção | {isSaving === 'notification_emails' && <Loader2 className="w-4 h-4 animate-spin" />} | src/pages/admin/Configuracoes.tsx:419 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.82 | entrada/seleção | {isSaving === 'notification_whatsapp' && <Loader2 className="w-4 h-4 animate-spin" />} | src/pages/admin/Configuracoes.tsx:436 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.83 | navegação/link | Ver documentação | src/pages/admin/Configuracoes.tsx:490 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.84 | entrada/seleção | http://localhost:3000 | src/pages/admin/Configuracoes.tsx:505 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.85 | entrada/seleção | Opcional se não configurado auth | src/pages/admin/Configuracoes.tsx:514 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.86 | ação/botão | {wahaStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Testar Conexão | src/pages/admin/Configuracoes.tsx:524 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.87 | entrada/seleção | Clique em “Gerar URL manual segura” | src/pages/admin/Configuracoes.tsx:565 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.88 | ação/botão | Button na linha 572 | src/pages/admin/Configuracoes.tsx:572 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.89 | ação/botão | {isSaving === 'prepare_webhook' ? ( <Loader2 className="w-4 h-4 mr-2 animate-spin" /> ) : ( <Zap className="w-4 h-4 mr-2" /> )} Gerar URL manual segura | src/pages/admin/Configuracoes.tsx:585 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.90 | ação/botão | {isSaving === 'test_webhook' ? ( <Loader2 className="w-4 h-4 mr-2 animate-spin" /> ) : ( <Activity className="w-4 h-4 mr-2" /> )} Testar Webhook | src/pages/admin/Configuracoes.tsx:643 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.91 | ação/botão | {isSaving === 'configure_webhook' ? ( <Loader2 className="w-4 h-4 mr-2 animate-spin" /> ) : ( <Zap className="w-4 h-4 mr-2" /> )} Configurar Webhook Automaticamente | src/pages/admin/Configuracoes.tsx:694 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.92 | navegação/link | Webhooks - Evolution API V2 (Português) | src/pages/admin/Configuracoes.tsx:780 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.93 | entrada/seleção | Seu token do WhatsApp Business API | src/pages/admin/Configuracoes.tsx:825 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.94 | entrada/seleção | ID do número de telefone | src/pages/admin/Configuracoes.tsx:837 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.95 | entrada/seleção | Sua chave da API de SMS | src/pages/admin/Configuracoes.tsx:859 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.96 | entrada/seleção | smtp.gmail.com | src/pages/admin/Configuracoes.tsx:894 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.97 | entrada/seleção | 587 | src/pages/admin/Configuracoes.tsx:905 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.98 | entrada/seleção | seu-email@gmail.com | src/pages/admin/Configuracoes.tsx:917 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.99 | entrada/seleção | Sua senha ou app password | src/pages/admin/Configuracoes.tsx:929 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.100 | ação/botão | Button na linha 968 | src/pages/admin/Configuracoes.tsx:968 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 15.101 | navegação/link | Gerenciar backups no Supabase | src/pages/admin/Configuracoes.tsx:969 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 15.102 | entrada/seleção | Input na linha 1030 | src/pages/admin/Configuracoes.tsx:1030 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.103 | entrada/seleção | Input na linha 1045 | src/pages/admin/Configuracoes.tsx:1045 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.104 | entrada/seleção | +5585999999999 | src/pages/admin/Configuracoes.tsx:1060 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.105 | entrada/seleção | Switch na linha 1083 | src/pages/admin/Configuracoes.tsx:1083 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.106 | entrada/seleção | Switch na linha 1096 | src/pages/admin/Configuracoes.tsx:1096 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.107 | entrada/seleção | Token da Meta Business API | src/pages/admin/Configuracoes.tsx:1117 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.108 | entrada/seleção | ID do número do WhatsApp Business | src/pages/admin/Configuracoes.tsx:1128 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.109 | entrada/seleção | 6.0 | src/pages/admin/Configuracoes.tsx:1170 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 15.110 | entrada/seleção | 20.0 | src/pages/admin/Configuracoes.tsx:1186 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 16. /admin/analytics — Analytics

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Analytics.tsx`
- Dependências identificadas: Tabelas: `corretores`, `distribution_metrics`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 16.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 16.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 16.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 16.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 16.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 17. /admin/monitoring — Monitoring

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/Monitoring.tsx`
- Dependências identificadas: Tabelas: `application_logs`, `communication_log`, `distribution_attempts`, `notifications`, `profiles`, `rate_limits`, `user_roles`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 17.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 17.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 17.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 17.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 17.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 18. /admin/ai-agents — AIAgents

- Acesso esperado: **admin**
- Arquivo de entrada: `src/pages/admin/AIAgents.tsx`
- Dependências identificadas: Tabelas: `agent_conversations`, `agent_followups`, `agent_messages`, `ai_agents`, `ai_lead_qualification`, `evolution_instances`, `integration_logs`, `notifications`, `profiles`, `user_roles`, `visitas`
Edge Functions: `create-notification`, `evolution-manager`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 18.1 | submissão de formulário | form na linha 251 | src/components/ai-agents/AgentEditor.tsx:251 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 18.2 | ação/botão | basic | src/components/ai-agents/AgentEditor.tsx:254 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.3 | ação/botão | personality | src/components/ai-agents/AgentEditor.tsx:255 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.4 | ação/botão | ai | src/components/ai-agents/AgentEditor.tsx:256 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.5 | ação/botão | behavior | src/components/ai-agents/AgentEditor.tsx:257 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.6 | ação/botão | followups | src/components/ai-agents/AgentEditor.tsx:258 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.7 | entrada/seleção | Ex: Ana - Consultora Imobiliária | src/components/ai-agents/AgentEditor.tsx:269 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.8 | entrada/seleção | formData.evolution_instance_id \|\| "default" | src/components/ai-agents/AgentEditor.tsx:280 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.9 | entrada/seleção | SelectTrigger na linha 287 | src/components/ai-agents/AgentEditor.tsx:287 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.10 | entrada/seleção | formData.llm_provider | src/components/ai-agents/AgentEditor.tsx:307 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.11 | entrada/seleção | SelectTrigger na linha 314 | src/components/ai-agents/AgentEditor.tsx:314 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.12 | entrada/seleção | formData.ai_model | src/components/ai-agents/AgentEditor.tsx:326 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.13 | entrada/seleção | SelectTrigger na linha 330 | src/components/ai-agents/AgentEditor.tsx:330 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.14 | entrada/seleção | Descrição do propósito do agente... | src/components/ai-agents/AgentEditor.tsx:346 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.15 | entrada/seleção | Switch na linha 362 | src/components/ai-agents/AgentEditor.tsx:362 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.16 | entrada/seleção | Ana | src/components/ai-agents/AgentEditor.tsx:374 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.17 | entrada/seleção | Consultora de Imóveis | src/components/ai-agents/AgentEditor.tsx:383 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.18 | entrada/seleção | formData.tone | src/components/ai-agents/AgentEditor.tsx:394 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.19 | entrada/seleção | SelectTrigger na linha 398 | src/components/ai-agents/AgentEditor.tsx:398 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.20 | entrada/seleção | Olá! Como posso ajudar você hoje? | src/components/ai-agents/AgentEditor.tsx:413 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.21 | entrada/seleção | formData.system_prompt | src/components/ai-agents/AgentEditor.tsx:430 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.22 | entrada/seleção | Switch na linha 482 | src/components/ai-agents/AgentEditor.tsx:482 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.23 | entrada/seleção | formData.max_properties_to_show.toString() | src/components/ai-agents/AgentEditor.tsx:491 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.24 | entrada/seleção | SelectTrigger na linha 495 | src/components/ai-agents/AgentEditor.tsx:495 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.25 | entrada/seleção | formData.fallback_action | src/components/ai-agents/AgentEditor.tsx:507 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.26 | entrada/seleção | SelectTrigger na linha 511 | src/components/ai-agents/AgentEditor.tsx:511 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.27 | entrada/seleção | comprar, apartamento, casa, imóvel | src/components/ai-agents/AgentEditor.tsx:525 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.28 | entrada/seleção | formData.max_messages_per_conversation | src/components/ai-agents/AgentEditor.tsx:541 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.29 | entrada/seleção | formData.conversation_timeout_hours | src/components/ai-agents/AgentEditor.tsx:552 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.30 | entrada/seleção | Switch na linha 578 | src/components/ai-agents/AgentEditor.tsx:578 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.31 | entrada/seleção | Switch na linha 589 | src/components/ai-agents/AgentEditor.tsx:589 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.32 | entrada/seleção | Switch na linha 600 | src/components/ai-agents/AgentEditor.tsx:600 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.33 | entrada/seleção | formData.max_unclear_attempts | src/components/ai-agents/AgentEditor.tsx:610 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.34 | entrada/seleção | Ex: gerente, atendente, proposta, fluxo de pagamento | src/components/ai-agents/AgentEditor.tsx:626 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.35 | entrada/seleção | Mensagem enviada antes da transferência... | src/components/ai-agents/AgentEditor.tsx:643 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.36 | ação/botão | Cancelar | src/components/ai-agents/AgentEditor.tsx:672 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.37 | ação/botão | {saveMutation.isPending ? ( <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando... </> ) : ( <> <Save className="h-4 w-4 mr-2" /> Salvar Agente </> )} | src/components/ai-agents/AgentEditor.tsx:675 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.38 | entrada/seleção | Buscar... | src/components/ai-agents/ConversationMonitor.tsx:156 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.39 | ação/botão | button na linha 174 | src/components/ai-agents/ConversationMonitor.tsx:174 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.40 | ação/botão | Tentar Novamente | src/components/ai-agents/FollowupEditor.tsx:205 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.41 | ação/botão | Adicionar | src/components/ai-agents/FollowupEditor.tsx:225 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.42 | ação/botão | Criar Primeiro Follow-up | src/components/ai-agents/FollowupEditor.tsx:256 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.43 | ação/botão | Mover follow-up para cima | src/components/ai-agents/FollowupEditor.tsx:326 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.44 | ação/botão | Mover follow-up para baixo | src/components/ai-agents/FollowupEditor.tsx:336 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.45 | ação/botão | Editar | src/components/ai-agents/FollowupEditor.tsx:382 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.46 | ação/botão | Excluir este follow-up | src/components/ai-agents/FollowupEditor.tsx:383 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.47 | entrada/seleção | form.delay_hours | src/components/ai-agents/FollowupEditor.tsx:412 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.48 | entrada/seleção | form.send_after_hour | src/components/ai-agents/FollowupEditor.tsx:421 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.49 | entrada/seleção | form.send_before_hour | src/components/ai-agents/FollowupEditor.tsx:431 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.50 | entrada/seleção | form.media_type \|\| 'text' | src/components/ai-agents/FollowupEditor.tsx:444 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.51 | entrada/seleção | SelectTrigger na linha 450 | src/components/ai-agents/FollowupEditor.tsx:450 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.52 | entrada/seleção | https://exemplo.com/audio/followup1.ogg | src/components/ai-agents/FollowupEditor.tsx:475 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.53 | entrada/seleção | Mensagem curta após o áudio. Deixe vazio para enviar só o áudio. Use {{nome}}, {{bairro}}, etc. | src/components/ai-agents/FollowupEditor.tsx:487 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.54 | entrada/seleção | https://exemplo.com/imagens/apartamento.jpg | src/components/ai-agents/FollowupEditor.tsx:511 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.55 | entrada/seleção | Legenda que aparece embaixo da imagem. Use {{nome}}, {{bairro}}, etc. | src/components/ai-agents/FollowupEditor.tsx:519 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.56 | entrada/seleção | Use {{nome}}, {{bairro}}, {{tipo_imovel}}, {{orcamento}}, etc. | src/components/ai-agents/FollowupEditor.tsx:533 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.57 | entrada/seleção | Switch na linha 545 | src/components/ai-agents/FollowupEditor.tsx:545 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.58 | entrada/seleção | Switch na linha 552 | src/components/ai-agents/FollowupEditor.tsx:552 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.59 | entrada/seleção | Switch na linha 559 | src/components/ai-agents/FollowupEditor.tsx:559 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.60 | ação/botão | Cancelar | src/components/ai-agents/FollowupEditor.tsx:568 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.61 | ação/botão | Salvar | src/components/ai-agents/FollowupEditor.tsx:569 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.62 | entrada/seleção | Buscar por telefone, tipo ou bairro... | src/components/ai-agents/LeadQualificationView.tsx:195 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.63 | ação/botão | Nova Instância | src/components/configuracoes/EvolutionInstances.tsx:254 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.64 | ação/botão | Cadastrar chave válida | src/components/configuracoes/EvolutionInstances.tsx:276 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.65 | ação/botão | Conectar (QR Code) | src/components/configuracoes/EvolutionInstances.tsx:325 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.66 | ação/botão | Dashboard de Status | src/components/configuracoes/EvolutionInstances.tsx:333 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.67 | ação/botão | Verificar Conexão | src/components/configuracoes/EvolutionInstances.tsx:341 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.68 | ação/botão | Reiniciar | src/components/configuracoes/EvolutionInstances.tsx:354 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.69 | ação/botão | Logout (Desconectar) | src/components/configuracoes/EvolutionInstances.tsx:366 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.70 | ação/botão | Editar Configurações | src/components/configuracoes/EvolutionInstances.tsx:378 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.71 | ação/botão | Excluir Instância | src/components/configuracoes/EvolutionInstances.tsx:386 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.72 | submissão de formulário | form na linha 415 | src/components/configuracoes/EvolutionInstances.tsx:415 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 18.73 | entrada/seleção | Ex: Produção Principal | src/components/configuracoes/EvolutionInstances.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.74 | entrada/seleção | Ex: my-instance | src/components/configuracoes/EvolutionInstances.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.75 | entrada/seleção | https://api.evolution.com | src/components/configuracoes/EvolutionInstances.tsx:437 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.76 | entrada/seleção | editingInstance ? 'Deixe em branco para manter a chave atual' : 'Informe a chave da API' | src/components/configuracoes/EvolutionInstances.tsx:441 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.77 | entrada/seleção | is_active | src/components/configuracoes/EvolutionInstances.tsx:451 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.78 | ação/botão | Cancelar | src/components/configuracoes/EvolutionInstances.tsx:456 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.79 | ação/botão | {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar | src/components/configuracoes/EvolutionInstances.tsx:457 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.80 | ação/botão | Fechar | src/components/configuracoes/EvolutionInstances.tsx:486 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.81 | ação/botão | Fechar | src/components/configuracoes/EvolutionInstances.tsx:510 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.82 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.83 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 18.84 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.85 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 18.86 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.87 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.88 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 18.89 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.90 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.91 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.92 | ação/botão | Novo Agente | src/pages/admin/AIAgents.tsx:169 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.93 | ação/botão | agents | src/pages/admin/AIAgents.tsx:238 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.94 | ação/botão | conversations | src/pages/admin/AIAgents.tsx:242 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.95 | ação/botão | qualifications | src/pages/admin/AIAgents.tsx:246 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.96 | ação/botão | analytics | src/pages/admin/AIAgents.tsx:250 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.97 | ação/botão | Criar Primeiro Agente | src/pages/admin/AIAgents.tsx:270 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.98 | entrada/seleção | Switch na linha 292 | src/pages/admin/AIAgents.tsx:292 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 18.99 | ação/botão | Configurar | src/pages/admin/AIAgents.tsx:312 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.100 | ação/botão | Conversas | src/pages/admin/AIAgents.tsx:320 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 18.101 | ação/botão | `Excluir agente ${agent.name}` | src/pages/admin/AIAgents.tsx:328 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 19. /meus-leads — MeusLeads

- Acesso esperado: **corretor**
- Arquivo de entrada: `src/pages/corretor/MeusLeads.tsx`
- Dependências identificadas: Tabelas: `corretores`, `leads`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 19.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 19.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 19.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 19.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.11 | ação/botão | Ir para Meu Perfil | src/pages/corretor/MeusLeads.tsx:133 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.12 | entrada/seleção | Buscar leads... | src/pages/corretor/MeusLeads.tsx:215 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 19.13 | ação/botão | Ligar | src/pages/corretor/MeusLeads.tsx:303 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.14 | ação/botão | WhatsApp | src/pages/corretor/MeusLeads.tsx:315 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 19.15 | ação/botão | Detalhes | src/pages/corretor/MeusLeads.tsx:327 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 20. /minhas-visitas — MinhasVisitas

- Acesso esperado: **corretor**
- Arquivo de entrada: `src/pages/corretor/MinhasVisitas.tsx`
- Dependências identificadas: Tabelas: `corretores`, `empreendimentos`, `leads`, `notifications`, `profiles`, `user_roles`, `visitas`
Edge Functions: `create-notification`, `distribute-lead`, `distribute-visit`, `send-lead-to-crm`, `send-visit-reminder`
RPCs: `hard_delete_visita`, `restore_visita`, `soft_delete_visita`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 20.1 | ação/botão | Restaurar | src/components/actions/VisitaActions.tsx:261 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.2 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:278 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.3 | ação/botão | {restoreMutation.isPending ? "Restaurando..." : "Restaurar"} | src/components/actions/VisitaActions.tsx:279 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.4 | ação/botão | Excluir Permanentemente | src/components/actions/VisitaActions.tsx:293 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.5 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:310 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.6 | ação/botão | {hardDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir Permanentemente"} | src/components/actions/VisitaActions.tsx:311 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.7 | ação/botão | Detalhes | src/components/actions/VisitaActions.tsx:324 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.8 | ação/botão | Confirmar | src/components/actions/VisitaActions.tsx:342 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.9 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:359 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.10 | ação/botão | {updateStatusMutation.isPending ? "Confirmando..." : "Confirmar"} | src/components/actions/VisitaActions.tsx:360 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.11 | ação/botão | DialogTrigger na linha 374 | src/components/actions/VisitaActions.tsx:374 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.12 | ação/botão | Marcar Realizada | src/components/actions/VisitaActions.tsx:375 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.13 | entrada/seleção | Comentários ou feedback do lead sobre a visita... | src/components/actions/VisitaActions.tsx:403 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.14 | entrada/seleção | Switch na linha 413 | src/components/actions/VisitaActions.tsx:413 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.15 | entrada/seleção | Adicione seu feedback sobre esta visita... | src/components/actions/VisitaActions.tsx:425 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.16 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:435 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.17 | ação/botão | {updateStatusMutation.isPending ? "Salvando..." : "Marcar Realizada"} | src/components/actions/VisitaActions.tsx:445 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.18 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:461 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.19 | ação/botão | Não | src/components/actions/VisitaActions.tsx:478 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.20 | ação/botão | {updateStatusMutation.isPending ? "Cancelando..." : "Sim, Cancelar"} | src/components/actions/VisitaActions.tsx:479 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.21 | ação/botão | Remarcar | src/components/actions/VisitaActions.tsx:493 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.22 | ação/botão | {sendReminderMutation.isPending ? "Enviando..." : "Lembrete"} | src/components/actions/VisitaActions.tsx:506 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.23 | ação/botão | Detalhes | src/components/actions/VisitaActions.tsx:519 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.24 | ação/botão | Editar | src/components/actions/VisitaActions.tsx:530 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.25 | ação/botão | Excluir | src/components/actions/VisitaActions.tsx:543 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.26 | ação/botão | Cancelar | src/components/actions/VisitaActions.tsx:560 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.27 | ação/botão | {softDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir"} | src/components/actions/VisitaActions.tsx:561 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.28 | submissão de formulário | {!initialData?.id && ( <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-2"> <Switch id="cadastrar_sem_visita" checked={watch("cadas | src/components/forms/LeadForm.tsx:301 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 20.29 | entrada/seleção | Nome completo do lead | src/components/forms/LeadForm.tsx:305 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.30 | entrada/seleção | email@exemplo.com | src/components/forms/LeadForm.tsx:332 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.31 | entrada/seleção | watch("empreendimento_id") \|\| undefined | src/components/forms/LeadForm.tsx:345 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.32 | entrada/seleção | SelectTrigger na linha 349 | src/components/forms/LeadForm.tsx:349 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.33 | entrada/seleção | Switch na linha 369 | src/components/forms/LeadForm.tsx:369 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.34 | ação/botão | {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"} | src/components/forms/LeadForm.tsx:398 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.35 | entrada/seleção | watch("horario_visita_solicitada") \|\| "" | src/components/forms/LeadForm.tsx:429 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.36 | entrada/seleção | SelectTrigger na linha 433 | src/components/forms/LeadForm.tsx:433 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.37 | entrada/seleção | Select na linha 454 | src/components/forms/LeadForm.tsx:454 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.38 | entrada/seleção | SelectTrigger na linha 455 | src/components/forms/LeadForm.tsx:455 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.39 | entrada/seleção | Select na linha 473 | src/components/forms/LeadForm.tsx:473 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.40 | entrada/seleção | SelectTrigger na linha 474 | src/components/forms/LeadForm.tsx:474 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.41 | entrada/seleção | Informações adicionais sobre o lead... | src/components/forms/LeadForm.tsx:490 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.42 | ação/botão | Cancelar | src/components/forms/LeadForm.tsx:499 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.43 | ação/botão | {(createLeadMutation.isPending \|\| updateLeadMutation.isPending) && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )} {initialData?.id ? "Atualizar" : "Criar"} Lead | src/components/forms/LeadForm.tsx:502 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.44 | submissão de formulário | {status === 'realizada' && ( <div className="space-y-4"> <div className="space-y-2"> <Label>Avaliação do Lead</Label> <div className="flex items-center gap-2"> <div className="flex | src/components/forms/VisitaForm.tsx:164 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 20.45 | entrada/seleção | watch('lead_id') | src/components/forms/VisitaForm.tsx:170 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.46 | entrada/seleção | SelectTrigger na linha 175 | src/components/forms/VisitaForm.tsx:175 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.47 | ação/botão | Adicionar novo lead | src/components/forms/VisitaForm.tsx:187 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.48 | entrada/seleção | watch('corretor_id') | src/components/forms/VisitaForm.tsx:207 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.49 | entrada/seleção | SelectTrigger na linha 212 | src/components/forms/VisitaForm.tsx:212 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.50 | entrada/seleção | Checkbox na linha 229 | src/components/forms/VisitaForm.tsx:229 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.51 | entrada/seleção | watch('empreendimento_id') \|\| '' | src/components/forms/VisitaForm.tsx:258 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.52 | entrada/seleção | SelectTrigger na linha 263 | src/components/forms/VisitaForm.tsx:263 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.53 | entrada/seleção | watch('status') \|\| 'agendada' | src/components/forms/VisitaForm.tsx:279 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.54 | entrada/seleção | SelectTrigger na linha 284 | src/components/forms/VisitaForm.tsx:284 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.55 | ação/botão | {selectedDate ? ( format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) ) : ( "Selecione uma data" )} | src/components/forms/VisitaForm.tsx:302 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.56 | entrada/seleção | watch('horario_visita') \|\| '' | src/components/forms/VisitaForm.tsx:336 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.57 | entrada/seleção | SelectTrigger na linha 340 | src/components/forms/VisitaForm.tsx:340 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.58 | entrada/seleção | Comentários ou feedback do lead sobre a visita... | src/components/forms/VisitaForm.tsx:374 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.59 | entrada/seleção | Seu feedback sobre a visita... | src/components/forms/VisitaForm.tsx:383 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 20.60 | ação/botão | Limpar | src/components/forms/VisitaForm.tsx:393 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.61 | ação/botão | {isLoading ? "Salvando..." : "Salvar Visita"} | src/components/forms/VisitaForm.tsx:401 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.62 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.63 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 20.64 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.65 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 20.66 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.67 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.68 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 20.69 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.70 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.71 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.72 | ação/botão | Ir para Meu Perfil | src/pages/corretor/MinhasVisitas.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 20.73 | entrada/seleção | Buscar visitas... | src/pages/corretor/MinhasVisitas.tsx:252 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 21. /minhas-comissoes — MinhasComissoes

- Acesso esperado: **corretor**
- Arquivo de entrada: `src/pages/corretor/MinhasComissoes.tsx`
- Dependências identificadas: Tabelas: `corretores`, `notifications`, `profiles`, `user_roles`, `vendas`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 21.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 21.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 21.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 21.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.11 | navegação/link | {displayName} | src/pages/corretor/MinhasComissoes.tsx:245 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 21.12 | ação/botão | Button na linha 305 | src/pages/corretor/MinhasComissoes.tsx:305 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 21.13 | navegação/link | a na linha 320 | src/pages/corretor/MinhasComissoes.tsx:320 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 22. /perfil — Perfil

- Acesso esperado: **autenticado**
- Arquivo de entrada: `src/pages/corretor/Perfil.tsx`
- Dependências identificadas: Tabelas: `corretor_bairros`, `corretor_construtoras`, `corretores`, `notifications`, `profiles`, `user_roles`
Edge Functions: `create-notification`
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 22.1 | ação/botão | Abrir menu lateral | src/components/layout/DashboardLayout.tsx:110 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.2 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:124 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 22.3 | ação/botão | Button na linha 155 | src/components/layout/DashboardLayout.tsx:155 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.4 | navegação/link | Abrir MeMude Financeiro | src/components/layout/DashboardLayout.tsx:156 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 22.5 | ação/botão | Menu de perfil do usuário | src/components/layout/DashboardLayout.tsx:170 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.6 | ação/botão | DropdownMenuItem na linha 191 | src/components/layout/DashboardLayout.tsx:191 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.7 | navegação/link | {item.name} | src/components/layout/DashboardLayout.tsx:211 | Abre o destino correto, sem 404, erro de console ou perda indevida de contexto. |
| [ ] 22.8 | ação/botão | `Notificações: ${unreadCount} não lidas` | src/components/notifications/NotificationSystem.tsx:178 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.9 | ação/botão | Marcar todas como lidas | src/components/notifications/NotificationSystem.tsx:195 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.10 | ação/botão | Marcar notificação como lida | src/components/notifications/NotificationSystem.tsx:251 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.11 | submissão de formulário | form na linha 266 | src/pages/corretor/Perfil.tsx:266 | Valida dados, persiste uma única vez, informa sucesso/erro e atualiza a tela. |
| [ ] 22.12 | entrada/seleção | Ex: 12345-F | src/pages/corretor/Perfil.tsx:269 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.13 | entrada/seleção | Ex: +55 (85) 99999-9999 | src/pages/corretor/Perfil.tsx:283 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.14 | entrada/seleção | Ex: Especialista em imóveis de médio/alto padrão em Fortaleza... | src/pages/corretor/Perfil.tsx:297 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.15 | ação/botão | {isCreatingProfile ? "Ativando..." : "Ativar Perfil de Corretor"} | src/pages/corretor/Perfil.tsx:307 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.16 | ação/botão | perfil | src/pages/corretor/Perfil.tsx:400 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.17 | ação/botão | areas | src/pages/corretor/Perfil.tsx:404 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.18 | ação/botão | historico | src/pages/corretor/Perfil.tsx:408 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 22.19 | entrada/seleção | Input na linha 423 | src/pages/corretor/Perfil.tsx:423 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.20 | entrada/seleção | Input na linha 439 | src/pages/corretor/Perfil.tsx:439 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.21 | entrada/seleção | Input na linha 458 | src/pages/corretor/Perfil.tsx:458 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.22 | entrada/seleção | Input na linha 474 | src/pages/corretor/Perfil.tsx:474 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |
| [ ] 22.23 | entrada/seleção | corretor.creci | src/pages/corretor/Perfil.tsx:491 | Deve permanecer indisponível com motivo explícito e sem sugerir funcionalidade pronta. |
| [ ] 22.24 | entrada/seleção | Adicione informações adicionais sobre seu perfil... | src/pages/corretor/Perfil.tsx:501 | Aceita somente valores válidos, mantém estado e afeta consulta/formulário conforme o rótulo. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 23. /ai-agents — redirecionamento

- Acesso esperado: **admin**
- Redireciona para: `/admin/ai-agents` (herda a mesma proteção de acesso)
- Arquivo de entrada: `definido diretamente em App.tsx`
- Dependências identificadas: nenhuma dependência de dados direta
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] | rota | Renderização e acesso | App.tsx | Redireciona/renderiza exatamente conforme a regra de acesso. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 24. /ai-agentes — redirecionamento

- Acesso esperado: **admin**
- Redireciona para: `/admin/ai-agents` (herda a mesma proteção de acesso)
- Arquivo de entrada: `definido diretamente em App.tsx`
- Dependências identificadas: nenhuma dependência de dados direta
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] | rota | Renderização e acesso | App.tsx | Redireciona/renderiza exatamente conforme a regra de acesso. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).

---

## 25. * — NotFound

- Acesso esperado: **público**
- Arquivo de entrada: `src/pages/NotFound.tsx`
- Dependências identificadas: nenhuma dependência de dados direta
- Estado da página: [ ] não iniciada  [ ] em teste  [ ] aprovada  [ ] reprovada/bloqueada

| Item | Tipo | Controle/função | Origem | Critério de aprovação |
|---|---|---|---|---|
| [ ] 25.1 | ação/botão | Voltar ao Início | src/pages/NotFound.tsx:76 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |
| [ ] 25.2 | ação/botão | Página Anterior | src/pages/NotFound.tsx:83 | Executa a ação indicada uma única vez, com loading, feedback e tratamento de erro. |

### Validações obrigatórias da página

- [ ] Carregamento inicial sem erro visual, console error ou requisição 4xx/5xx inesperada.
- [ ] Estado vazio, loading, sucesso e falha de consulta apresentados corretamente.
- [ ] Permissões testadas como anônimo, administrador, corretor e cliente quando aplicável.
- [ ] Layout validado em desktop e viewport móvel.
- [ ] Teclado, foco, nome acessível e contraste dos controles críticos validados.
- [ ] Escritas conferidas no banco e leituras atualizadas sem duplicidade.
- [ ] Evidência anexada ao relatório (teste, log, resposta ou captura).


## Jornadas transversais e integrações

- [ ] Auth: login, logout, recuperação, redefinição, sessão expirada e bloqueio por papel.
- [ ] Leads: criação, edição, qualificação, lixeira, restauração, distribuição e CRM.
- [ ] Corretores: convite, cadastro, aprovação, suspensão, reativação, exclusão e escopo próprio.
- [ ] Visitas: criação, conflito de horário, confirmação, lembrete, realização, cancelamento, reagendamento e lixeira.
- [ ] Vendas: registro, edição, comissão, comprovante privado e sincronização financeira.
- [ ] WhatsApp: envio, fila, entrega, webhook, duplicidade, assinatura inválida, timeout e fallback.
- [ ] IA: agente, conversa, qualificação, follow-up, handoff humano e indisponibilidade do provedor.
- [ ] WordPress: teste de conexão, sincronização incremental/completa, erro remoto e idempotência.
- [ ] Relatórios: geração, filtros, impressão, CSV/JSON/XLSX e agendamento.
- [ ] Segurança: IDOR/BOLA, XSS, upload malicioso, rate limit, CORS, RLS e ausência de PII em logs.
- [ ] Operação: carga, concorrência, retry, dead-letter, cron, backup, restore e rollback.
