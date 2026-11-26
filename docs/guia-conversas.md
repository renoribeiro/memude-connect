# MeMude Conversas — guia de uso

Guias por público: [corretor](guias/guia-corretor.md) · [SDR](guias/guia-sdr.md) · [cliente](guias/guia-cliente.md).
Identidade visual desta área: [identidade-visual-conversas.md](identidade-visual-conversas.md).

O cliente fala sempre com **o número da MeMude**. Por dentro, quem atende muda: SDR → corretor → closer.
A IA lê as conversas e **só sugere**. Nada muda no CRM sem alguém tocar em "Aplicar".

## 1. Primeiro passo (admin, uma vez só)

1. Connect → **Conversas** → aba **Números** → **Novo número**.
2. Dê um nome (ex.: *Atendimento MeMude*) e escolha **Principal**.
3. No celular com o chip da MeMude: WhatsApp → Configurações → **Dispositivos conectados** → **Conectar dispositivo**.
   Leia o QR code. A janela fecha sozinha quando conectar.
4. (Recomendado) Repita com um segundo chip como **Reserva**. Se o principal cair, quem escrever no reserva
   continua com o mesmo atendente.

Os números que já existiam (avisos e visitas) **não são tocados**.

## 2. Equipe (SDR, closer, admin) — Connect → Conversas

| O que | Como |
|---|---|
| Ver todas as conversas | Aba **Conversas**. Filtros: Minhas, Aguardando, SDR, Corretores, Arquivadas |
| Responder | Digite e Enter. Shift+Enter quebra a linha |
| Resposta rápida | Digite `/` e o atalho (ex.: `/tabela`) |
| Áudio, foto, PDF | Microfone e clipe ao lado da caixa de texto |
| Nota interna | Ícone de bloquinho na caixa: fica amarela e o cliente **não vê** |
| Responder citando | Passe o mouse na mensagem → seta de responder |
| Assumir / transferir | Ficha do cliente (painel à direita) |
| Agendar visita | Ficha → **Agendar visita**. O corretor recebe o "Cliente novo" no app |
| Conversa nova com um lead | Botão **+** ao lado da busca |
| Avisos no computador | Sininho no canto da barra de abas |

**Assinatura automática.** A primeira mensagem de cada pessoa sai com *Nome · Atendimento*, *Nome · Corretor(a)* ou *Nome · Especialista*.
Depois, nas 4 horas seguintes, sai sem assinatura.

**IA (só sugere):**
- resumo e temperatura (quente, morno, frio);
- campos da ficha (renda, entrada/FGTS, prazo, finalidade, região);
- etapa;
- resposta sugerida (aparece acima da caixa de texto: **Usar** só preenche, você revisa e envia);
- lembrete;
- imóveis que combinam.

Áudios do cliente são transcritos.

**Alertas (aba Alertas):**
- corretor sem responder há mais de 15 min (das 8h às 20h);
- cliente pós-visita sem contato há 3 dias;
- sinal de compra;
- contato pessoal fora do número da MeMude;
- número desconectado.

**Desempenho:** tempo médio de resposta, % respondido em até 15 min, visitas, vendas e atrasos de cada corretor.

## 3. Corretor — app no celular

1. Abra **core.memudecore.com.br** no celular e entre com seu login: o app abre sozinho.
2. Instale:
   - Android/Chrome: menu → **Instalar app**.
   - iPhone/Safari: **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone e ative as **notificações**.

| Aba | Para quê |
|---|---|
| **Conversas** | Seus clientes. O contador mostra há quanto tempo o cliente espera |
| **Hoje** | Atividades (marque como feita) e visitas dos próximos 7 dias |
| **Funil** | Seus clientes por etapa. Deslize para o lado; "…" move de etapa |
| **Imóveis** | Catálogo para copiar e mandar |
| **Eu** | Seu desempenho, notificações, tema escuro, respostas rápidas |

**Cliente novo:** quando a SDR agenda uma visita para você, a tela cheia aparece com som e contagem regressiva.
- **Aceitar cliente:** a conversa vem para você.
- **Não posso atender:** com motivo; a SDR escolhe outro corretor.

No chat:
- o **ícone de prédio** mostra os imóveis que combinam com o cliente, e você envia com um toque;
- o **ícone de informação** abre a ficha com as sugestões da IA.

Se o cliente faltar ou cancelar a visita, a conversa volta sozinha para a SDR.

## 4. Proteções do número (evitar bloqueio)

- Sem disparo em massa.
- Máximo de 40 conversas novas por dia por número.
- Máximo de 40 mensagens por minuto por número e 20 por pessoa.
- Cada mensagem sai com "digitando…" proporcional ao tamanho.
- O robô de follow-up está em stand-by.

## 5. Se algo der errado

| Situação | O que fazer |
|---|---|
| Mensagem com aviso de erro | Toque em **Tentar de novo** |
| Faixa vermelha "número desconectado" | Admin → Números → **Reconectar com QR code** |
| Notificação não chega no iPhone | O app precisa estar instalado na Tela de Início |
| Voltar atrás | `supabase/rollback/conversas_reverter.sql` desliga gatilhos e crons sem apagar dados |
