# Destinos dos avisos de visita

## Regra revisada

- Grupo configurado: somente **VISITA CONFIRMADA**, após o aceite do corretor (`match_accepted`). Uma publicação por visita e revisão do agendamento.
- Closer privado: recebimento, pendências e erros de comandos, distribuição, recusas, timeout, lembretes, confirmações de presença, alterações, cancelamentos e resultados. A confirmação também continua disponível ao Closer.
- Cliente e corretor: mantêm as perguntas e mensagens necessárias ao atendimento. Planilha e histórico continuam atualizados.

## Implementação

1. `private.visit_emit` limita a criação de entregas ao grupo e serializa a verificação de duplicidade pela linha do ciclo.
2. Os produtores de recibos e atualizações de intake criam somente entregas ao Closer.
3. A migração preserva o histórico enviado, invalida avisos operacionais do grupo ainda não concluídos e garante uma cópia privada quando não existe, sem repetir entregas incertas.
4. O worker valida novamente evento, revisão, corretor e estado antes de publicar. Confirmações canceladas, realizadas, substituídas ou excluídas são obsoletadas.
5. A mensagem inclui código, cliente/telefone, empreendimento, data/hora, endereço de encontro/bairro, corretor/WhatsApp/CRECI, perfil do cliente e link do acompanhamento.
6. Erros de comando no grupo são direcionados ao Closer; solicitações continuam sendo recebidas no grupo e resolvidas pelo Closer no privado.

## Validação e publicação

Testes PostgreSQL isolados cobrem os destinos por evento, filas antigas, deduplicação, nova revisão e repetição da migração. Testes de unidade cobrem o conteúdo e confirmações obsoletas. Executar também os testes existentes de visitas, CRM/vendas, lint, tipos e build.

Publicar a migração e os workers de WhatsApp, intake e webhook mantendo a autorização existente. A verificação em produção deve ser somente de leitura ou transacional com rollback, sem gerar mensagens de teste para clientes ou para o grupo. A interface não requer novo deploy Vercel.

Reversão: restaurar a versão anterior das funções e os três produtores SQL a partir das migrações anteriores. Não reativar automaticamente linhas obsoletas, pois isso recriaria o excesso de avisos.
