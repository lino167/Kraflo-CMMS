# Kraflo: design system (base: Estilo Linear)

> Um painel de comando à meia-noite: quase preto, letras brancas e precisas, e **uma só cor de destaque** (o laranja industrial da Kraflo) na ação principal.

Base: Estilo Linear (ProfitizeBuild), inspirado no site do Linear (https://linear.app). A ProfitizeBuild não tem relação com as marcas citadas.

Siga este arquivo em todas as telas. Em caso de dúvida, volte a ele.

## Adaptações da Kraflo

- **Destaque**: laranja `#ff8c1a` (`--primary`) no lugar do verde-limão. É a identidade da Kraflo e já é a `theme_color` do PWA. Regra mantida: **um botão de destaque por tela**.
- **Fontes**: Inter no texto e nos títulos (a Outfit foi removida); JetBrains Mono em TAGs, números de OS, atalhos e rótulos de campo.
- **Tela de campo (`/campo`)**: prioriza legibilidade em fábrica (contraste alto, alvos de toque de pelo menos 44 px). Pode se afastar deste arquivo onde a legibilidade pedir.

## Fundos (variáveis em `src/index.css`)

| Nome | Cor | Variável | Onde |
|---|---|---|---|
| Vazio | `#08090a` | `--background` | Fundo da página, de ponta a ponta |
| Carbono | `#0f1011` | `--card`, `--sidebar-background` | Cartões, molduras, barra lateral e topo |
| Obsidiana | `#161718` | `--popover` | Painéis dentro de cartões, menus, um degrau acima |
| Grafite | `#23252a` | `--secondary`, `--muted`, `--border` | Botões discretos, áreas com hover e fios |

## Textos e detalhes

- Texto: `#ffffff` (`--foreground`); corpo em Névoa `#d0d6e0`; texto suave `#8a8f98` (`--muted-foreground`).
- Fio: 1 px em Grafite, **no lugar de sombra**.
- Íris `#6366f1`: fundo de etiquetas de categoria, em pequenas doses.
- Verde pulso `#27a644` (`--success`): etiquetas de apoio, nunca botão.

## Tipografia

| Uso | Fonte | Peso | 
|---|---|---|
| Títulos | Inter | 510, letras 2% mais juntas |
| Corpo | Inter | 400 |
| Código, TAG, atalho | JetBrains Mono | 400, 12 px |

## Componentes

- Botão principal: laranja, texto `#08090a`, cantos de 6 px (`rounded-md`).
- Botão secundário: sem fundo, contorno de 1 px em Grafite, mesmo canto.
- Campo: fundo do próprio fundo, fio Grafite, rótulo em JetBrains Mono quando for dado técnico.
- Cartão: Carbono, fio Grafite, cantos de 12 px (`rounded-lg`), sem sombra.

## Faça

- Fundo quase preto de ponta a ponta; cartões um degrau mais claros.
- Fios de 1 px entre as partes.
- Um botão de destaque por tela; os outros neutros.
- TAG, número de OS e atalhos em fonte mono, pequenos.

## Evite

- Negrito pesado (o mais forte é o peso médio).
- Gradiente em botões, cartões ou textos; brilho (`glow`/neon); vidro desfocado (`backdrop-blur`).
- Segunda cor de botão; texto colorido no corpo.
- Cantos muito redondos: 6 px nos botões, 12 px nos cartões.
- Cartões que sobem ao passar o mouse.

## Movimento

- Transições de 150 a 200 ms, secas, sem quicar.
- No hover a borda clareia um tom; nada cresce nem pula.
