# Identidade visual — Conversas e app do corretor

Base: guia "Identidade visual do MeMude Corretor" (26/11/2026). Vale só para **Connect → Conversas** e o app **/app**.
O resto do Connect continua com o visual de antes.

## Como está montado

- Classe **`tema-memude`** (`src/index.css`): troca as cores do shadcn pelas do guia, aplica a fonte e os detalhes abaixo.
  - Página `/conversas`: a classe fica no contêiner da página e em cada janela que ela abre (diálogos, menus, dicas).
  - App `/app`: a classe vai no `<html>` enquanto o app está aberto, então tudo herda, inclusive janelas e avisos.
- Tokens **`mm-*`** no Tailwind (`bg-mm-lilas`, `text-mm-rosa-texto`, `bg-mm-acao`…), com versão para o tema escuro.
- Fonte **Plus Jakarta Sans** (400–800) servida pelo próprio site (`@fontsource-variable/plus-jakarta-sans`). O CSP bloqueia Google Fonts.
- Logos: `src/assets/memude-logotipo.svg` e `memude-simbolo.svg`, recortados do logo oficial. Componente `Marca` / `Simbolo` em `src/components/app/Marca.tsx`.

## Regras do guia aplicadas

| Elemento | Regra |
|---|---|
| Cores | Roxo `#422F91` conduz (abas ativas, preços, destaques). Rosa `#D41F58` só na ação principal (Enviar, Aceitar, Aplicar, Novo) |
| Texto | `#1E1640`; apoio `#6B6385`; rosa pequeno em `#B0164A` |
| Fundos | Tela `#F5F3FA`, cartões brancos, selo lilás `#EEEAF8`, rosa-claro `#FDE8EF` |
| Estados | Sucesso `#1F7A4D`/`#E3F4EA`, alerta `#7A4A00`/`#FFF1D6`, erro `#B0164A`/`#FFF1F5` (borda `#F6CADA`) |
| Botões | Sempre em pílula, texto 700. Variantes novas do `Button`: `acao` (rosa) e `contorno` (borda roxa 1,5 px) |
| Campos | Raio 14, borda `#A39CBB`; no foco, borda roxa e anel roxo 15% |
| Cartões | Raio 16, borda `#EFECF6`, quase sem sombra; destaque com raio 20–22 |
| Selos | 11 px, 800, pílula sem borda (etapas do funil, tempo de espera, papel) |
| Títulos | 800 com espaço levemente negativo; preços com números tabulares |
| Barra inferior | 5 abas, 68 px, ícone 24, ativa em roxo 700 |
| "Cliente novo" | Tela cheia em roxo, cartão branco com ícones em quadrado rosa-claro, botão rosa |
| PWA | Cor do tema `#FAF9FD`; abertura com o símbolo sobre rosa `#E92662` |
| Tom de voz | Frases curtas, sem emoji (inclusive nas prévias de mensagem da lista) |

Exceção consciente: os tiques de "lida" continuam azuis, como no WhatsApp, para não confundir.
