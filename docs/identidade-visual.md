# Identidade visual — MeMude Connect e app do corretor

Base: guia "Identidade visual do MeMude Corretor" (26/11/2026) e o app de referência memude-corretor.vercel.app.
Vale para o **Connect inteiro** e para o app **/app**. O Connect mantém o desenho de desktop (menu lateral, tabelas);
o app segue a estrutura do MeMude Corretor (cinco abas, título 26/800, abas em trilho lilás).

## Como está montado

- **Tokens** em `src/index.css` (`:root` e `.dark`): as variáveis do shadcn (`--primary`, `--background`…) apontam para a paleta do guia,
  e os tokens **`mm-*`** (`bg-mm-lilas`, `text-mm-rosa-texto`, `bg-mm-acao`…) dão acesso direto às cores do guia, com versão escura.
- **Paleta do Tailwind remapeada** (`tailwind.config.ts`): cores soltas como `blue-500`, `green-100`, `red-600` caem nos tons do guia,
  mantendo o sentido — azuis e violetas → roxo; vermelhos e rosas → rosa; verdes → sucesso; amarelos e laranjas → alerta; cinzas → neutros lilás.
  Assim as telas antigas acompanham a identidade sem precisar trocar classe por classe.
- **Fonte** Plus Jakarta Sans (400–800), carregada em `src/main.tsx` pelo próprio site (o CSP bloqueia Google Fonts).
- **Botões** sempre em pílula (`[data-botao]`), com as variantes `acao` (rosa, ação principal) e `contorno` (borda roxa).
- **Campos** com raio 14, borda `#A39CBB` e foco roxo com anel de 15% (`[data-campo]`).
- **Sombras** sempre no tom do texto (`#1E1640`), quase nenhuma.
- **Logos**: `src/assets/memude-logotipo.svg` e `memude-simbolo.svg`. No Connect, `Logo` mostra "me mude | CONNECT";
  no app, `Marca` mostra "me mude | CORRETOR".
- **`.tema-memude`**: usado em Conversas e no app só para forçar títulos 800, como no app de referência.

## Regras do guia aplicadas

| Elemento | Regra |
|---|---|
| Cores | Roxo `#422F91` conduz (abas ativas, preços, destaques). Rosa `#D41F58` só na ação principal |
| Texto | `#1E1640`; apoio `#6B6385`; rosa pequeno em `#B0164A` |
| Fundos | Tela `#F5F3FA`, cartões brancos, selo lilás `#EEEAF8`, rosa-claro `#FDE8EF` |
| Estados | Sucesso `#1F7A4D`/`#E3F4EA`, alerta `#7A4A00`/`#FFF1D6`, erro `#B0164A`/`#FFF1F5` (borda `#F6CADA`) |
| Botões | Pílula, texto 700 |
| Campos | Raio 14, borda `#A39CBB`; foco roxo |
| Cartões | Raio 16, borda fina; janelas com raio 22 |
| Selos | 11 px, 700–800, pílula |
| Abas | Trilho lilás, aba ativa branca em roxo 800 |
| Tabelas | Cabeçalho 12 px em maiúsculas, 700, cinza-lilás |
| Abertura | Símbolo sobre rosa `#E92662` |
| PWA | Cor do tema `#FAF9FD` |
| Tom de voz | Frases curtas, sem emoji na interface (mensagens de WhatsApp para clientes seguem os modelos de cada uma) |

Exceção consciente: os tiques de "lida" no chat seguem a cor do roxo claro, não o azul do WhatsApp.
