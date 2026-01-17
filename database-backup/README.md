# Database Migrations Backup

Este diretório contém um backup completo da estrutura atual do banco de dados Supabase para desenvolvimento.

## Estrutura das Migrations

### 00001_initial_schema.sql
- **Descrição**: Cria todas as 18 tabelas principais da aplicação
- **Conteúdo**: Estrutura completa das tabelas com colunas, tipos, defaults e habilitação de RLS
- **Tabelas**: audit_logs, bairros, construtoras, profiles, corretores, empreendimentos, leads, visitas, communication_log, lead_distribution_log, corretor_bairros, corretor_construtoras, system_settings, report_templates, scheduled_reports, wp_sync_log, wp_sync_performance, wp_categories_cache

### 00002_custom_types.sql
- **Descrição**: Define todos os tipos customizados (enums) usados na aplicação
- **Tipos**: communication_type, corretor_status, estado_brasil_enum, lead_status, tipo_imovel_enum, user_role

### 00003_database_functions.sql
- **Descrição**: Cria todas as 6 funções personalizadas do banco de dados
- **Funções**: 
  - `get_current_user_role()` - Obtém role do usuário atual
  - `validate_cpf()` - Validação de CPF brasileiro
  - `get_corretor_visitas_stats()` - Estatísticas de visitas do corretor
  - `handle_new_user()` - Manipula criação de novos usuários
  - `update_updated_at_column()` - Atualiza timestamp de modificação
  - `cleanup_old_sync_logs()` - Limpeza de logs antigos

### 00004_rls_policies.sql
- **Descrição**: Define todas as políticas de Row Level Security (RLS)
- **Segurança**: Controle de acesso granular por tabela e operação
- **Usuários**: Políticas específicas para admin, corretores e usuários gerais

### 00005_triggers.sql
- **Descrição**: Cria todos os triggers do banco de dados
- **Triggers**: 
  - Trigger para criação automática de perfil de usuário
  - Triggers para atualização automática de timestamps

### 00006_initial_data.sql
- **Descrição**: Insere dados iniciais essenciais para desenvolvimento
- **Dados**: 
  - Configurações do sistema
  - Bairros padrão do Ceará
  - Construtoras de exemplo
  - Templates de relatórios padrão

## Como Usar

### Para Restaurar o Banco Completo:
```sql
-- Execute as migrations em ordem (dependências devem ser respeitadas):
\i 00002_custom_types.sql      -- Primeiro os tipos
\i 00001_initial_schema.sql    -- Depois as tabelas
\i 00003_database_functions.sql -- Funções
\i 00004_rls_policies.sql      -- Políticas RLS
\i 00005_triggers.sql          -- Triggers
\i 00006_initial_data.sql      -- Dados iniciais
```

### Para Desenvolvimento Local:
1. Configure um novo projeto Supabase
2. Execute as migrations na ordem correta
3. Configure as variáveis de ambiente da aplicação
4. Execute o frontend conectado ao novo banco

### Para Produção:
1. **NÃO EXECUTE** estas migrations em produção
2. Use apenas para desenvolvimento e staging
3. Para produção, use os procedimentos oficiais do Supabase

## Informações Técnicas

- **Total de Tabelas**: 18
- **Total de Tipos Customizados**: 6 enums
- **Total de Funções**: 6 funções personalizadas
- **RLS Habilitado**: Em todas as tabelas
- **Triggers**: 10 (1 para usuários + 9 para timestamps)
- **Políticas RLS**: 47 políticas de segurança

## Dependências

- PostgreSQL 14+
- Extensões Supabase (auth, storage, etc.)
- Permissões adequadas para criação de tabelas, tipos e funções
- **IMPORTANTE**: Execute os tipos customizados ANTES das tabelas

## Notas de Segurança

- Todas as tabelas têm RLS habilitado
- Políticas específicas para controle de acesso
- Funções com SECURITY DEFINER quando necessário
- Validações integradas (CPF, etc.)
- Controle granular por usuário e role

## Estrutura de Dados

### Relacionamentos Principais:
- `profiles` ← `corretores` (1:1)
- `empreendimentos` ← `leads` (1:N)
- `corretores` ← `leads` (1:N)
- `leads` ← `visitas` (1:N)
- `corretores` ↔ `bairros` (N:N via corretor_bairros)
- `corretores` ↔ `construtoras` (N:N via corretor_construtoras)

### Dados de Auditoria:
- `audit_logs` - Log completo de mudanças
- `communication_log` - Histórico de comunicações
- `lead_distribution_log` - Log de distribuição de leads
- `wp_sync_log` - Log de sincronização WordPress

## Manutenção

- **Data de Criação**: ${new Date().toISOString()}
- **Versão da Aplicação**: Backup completo do estado atual
- **Ambiente**: Desenvolvimento/Staging apenas
- **Atualização**: Gere novo backup para mudanças estruturais

## Restauração de Emergência

Em caso de necessidade de restauração completa:

1. **Backup dos dados atuais** (se possível)
2. **Execute migrations em ordem**
3. **Importe dados** se necessário
4. **Verifique políticas RLS**
5. **Teste funcionalidades críticas**

---

⚠️ **ATENÇÃO**: Este é um backup para desenvolvimento. Não use em produção sem revisar cada migration cuidadosamente.