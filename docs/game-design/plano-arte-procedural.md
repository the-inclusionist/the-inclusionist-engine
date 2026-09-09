# Plano — Arte procedural semântica (imagem semântica + dicionário de paletas)

Pedido do José em 2026-07-03. Substitui o dilema "PNG × procedural": a arte vira **dado semântico** e as cores
vivem num **dicionário de paletas separado**. Escopo travado: **unificado** — personagens **e** tiles/mundo.
Realiza o pilar "arte = dados / GPL-clean". Research-first (fontes ao fim). Estudo para decisão; nada de código.

## 1. Modelo (confirmado com o José)
- **Imagem semântica** (o asset): por pixel, **(região, luminosidade)** — nunca uma cor. `região` = o que é
  (pele, cabelo, camisa, calça, metal, pedra, água, contorno…); `luminosidade` = degrau ordenado sombra→luz
  (+ papel `contorno`). Nada é chapado: a luminosidade preserva volume/sombreamento.
- **Dicionário de paletas** (separado, do jogo): por região, um conjunto de **rampas** escolhíveis (ex.: pele
  clara/média/escura; N cores de camisa; materiais de tile). Uma rampa = cor por nível de luminosidade.
- **Render**: `cor(pixel) = paleta[ variante_escolhida_da_região ][ luminosidade ]`. Mesma imagem semântica +
  paletas diferentes → recolor infinito, com sombreamento correto. Compatibilidade = só rampas da mesma região.

## 2. Referências estudadas
- **Palette swap / color ramps indexados** (NES/SNES; tutoriais Slynyrd; modo indexado do Aseprite): recolorir
  trocando a paleta mantendo os índices — a base clássica disto.
- **Recolor por LUT/rampa em jogos modernos** (ex.: *Dead Cells* — swap de cor por rampas HSV; *Rain World* —
  cor procedural): separar **forma/sombreamento** de **cor** é técnica consagrada.
- **Semente no próprio repo:** `game.js` já tem caminho indexado — `PIP_PAL` (paleta de 10 cores),
  `indexedToCanvas()` (índice→canvas) e `silhouetteCanvasIdx()` (silhueta chapada p/ alto-contraste). **Este
  plano generaliza esse código** de "paleta fixa" para "semântica (região+luminosidade) + dicionário de
  paletas". Não é do zero.

## 3. Formato do dado semântico (a "imagem semântica")
Por asset, dois canais por pixel: **regionId** (qual região) + **lumLevel** (nível na rampa; um valor especial
= `contorno`). Proposta:
- ~~**Armazenamento legível/diffável**: um grid de texto onde cada célula é `região×luminosidade`~~ —
  **a proposta de 03/07 caiu em 09/09, e caiu por medição.** Ela justificava-se a si própria com a condição
  *«preferir texto/JSON indexado **enquanto os sprites são pequenos (24×32)**»*, e essa condição morreu no dia
  em que o LPC entrou pela ponte do ADR-0133.
- **Animações**: várias imagens semânticas (frames) + tags (reusa `frameTags` do Aseprite na importação).
- **Metadados**: tamanho, âncora/pés (slice), lista de regiões usadas.

### 📏 A MEDIÇÃO DE 2026-09-09, e ela decidiu três coisas de uma vez

Descodificadas as folhas reais do LPC (`sprite/character/Body/Base/Human_androgynous/Coffee/`), com um leitor
PNG sem dependências:

| folha | dimensões | bytes | píxeis opacos | **cores únicas** |
|---|---|---|---|---|
| `walk.png` | 576×256 | 30 724 | 41 923 | **11** |
| `thrust.png` | 576×256 | 28 785 | 41 700 | **14** |
| `hurt.png` | 448×64 | 21 528 | 8 621 | **10** |
| **as três juntas** | — | 81 037 | 92 244 | **15** |

**① A grelha de texto é inviável e o número é grande.** 576×256 = 147 456 píxeis; a dois caracteres por
píxel, uma folha vira **~295 KB de texto** — quase dez vezes o PNG RGBA de 30 KB que ela descreve. E é uma
folha de um corpo, antes de cabelo, roupa e das outras animações. 📌 O que a grelha protegia era
**legibilidade**, e ninguém lê 147 mil células: a legibilidade passa a ser dada pelo editor, que desenha, e
por uma **exportação de texto para depuração** de recursos pequenos.

**② 🎯 A ANOTAÇÃO É UMA TABELA DE QUINZE LINHAS.** Três folhas inteiras têm quinze cores únicas somadas — a
pessoa não pinta píxeis, decide quinze vezes. É isto que torna o anotador viável, e é o número que faltava
para saber se ele valia a pena.

**③ Zero alfa parcial: todos os 92 244 píxeis opacos têm alfa exactamente 255.** A máscara dura do formato
deixa de ser uma restrição que impomos e passa a ser o que a fonte já é. ⚠️ E é ela que impede a
**pré-multiplicação** do browser de corromper os canais R e G, que é a forma de corrupção que falha em silêncio.

📌 **E a ordenação por luminância funciona nesta arte**: as seis cores mais frequentes descem 80 → 64 → 47 →
35 → 21 → 6, que é uma rampa de corpo limpa. A sugestão automática do §7 não é uma esperança.

### O formato decidido em 2026-09-09

**Dois ficheiros por recurso, um partilhado por jogo.**

- **`<nome>.semantic.png`** — `R` = `regionId` (0 = nada), `G` = `lumLevel` (um valor reservado = `contorno`),
  `B` = 0 reservado, `A` = **0 ou 255 e mais nada**.
  ⚠️ **Sem gestão de cor** (um `iCCP`/`gAMA` faz o browser transformar os valores e os índices deixam de ser
  índices), **sem alfa parcial**, e **nunca redimensionado nem recomprimido**. 📌 `tools/png-write.mjs` já
  escreve exactamente isto — codificador RGBA sem dependências, filtro 0, sem chunks de cor. Reusar.
- **`<nome>.semantic.json`** — `regioes`, `niveis`, `quadros` (`{nome,x,y,w,h,pivo,duracaoMs}`), `animacoes`,
  `mapaDeCores` (a tabela de quinze linhas que a pessoa decidiu) e `origem` — 🎯 esta com **os mesmos campos
  da linha do `art/ATTRIBUTION.csv`**, para o livro-razão ser GERADO em vez de escrito à mão.
- **`paletas.json`** — o §4 abaixo, inalterado: do jogo e não do recurso.

⚠️ **O pivô mora no JSON e não numa convenção de nomes**, porque o ADR-0027 mediu **quinze tamanhos distintos**
de sprite e concluiu que o atlas não pode assumir grelha uniforme. A medição acima confirma-o do lado do LPC:
`walk` é 576×256 e `hurt` é 448×64 — **a grelha muda entre folhas da mesma personagem.**

## 4. Dicionário de paletas (separado)
- Estrutura: `região → { variantes: { nome: rampa[] } }`, onde `rampa[lumLevel] = cor`. Ex.:
  `pele → { clara:[…], media:[…], escura:[…] }`, `camisa → { vermelha:[…], azul:[…] }`,
  `pedra → { cinza:[…], musgo:[…] }`.
- **Regras de compatibilidade** embutidas na estrutura (só se troca variante DENTRO da região; níveis fixos).
- **Contorno** pode ser global (uma cor) ou por região (contorno de pele ≠ de metal) — decidir.
- Vive como **dado do jogo** (não no asset): `app/js/art/palettes.js` (ou `.json`), pré-cacheado.

## 5. Motor de render (combinar semântica + paleta)
- **Compor um canvas** por (asset, combinação-de-paletas) uma vez e cachear a `PIXI.Texture` (NEAREST) — como
  o `indexedToCanvas` atual já faz, só que a fonte é a imagem semântica + as variantes escolhidas. Recolor =
  recompor o canvas (barato p/ sprites pequenos) ou, no futuro, um **shader/LUT** (mapear (região,lum)→cor na
  GPU) se precisar de troca em tempo real de muitos.
- **Sombreamento correto** vem de graça: o `lumLevel` indexa o degrau da rampa.
- **Perf (hardware fraco = pilar):** cache por combinação; recompor só quando a escolha muda.

## 6. Importação (o editor lê; o jogo não)
Reusa as pesquisas de `plano-tiled-aseprite.md` — agora como **parsers de import**, não runtime:
- **png/jpg**: extrai as cores únicas → lista para o humano anotar (cor→(região,luminosidade)).
- **Aseprite / Libresprite** (Libresprite = fork GPL, ótimo p/ o pilar): lê PNG+JSON → frames + `frameTags`
  (animações) + a **paleta indexada** (no modo indexado, já vem a ordem de cores — acelera a anotação).
- **Tiled / LDtk** (ambos JSON): importa o **tileset** (imagem) + a grade, para anotar tiles por material.
- O import produz a **imagem semântica** + sugestões (agrupar por luminosidade via ordenação HSV das cores).

## 7. Editor (`tools/`, standalone, no-build)
- Abrir bitmap/animação (formatos acima) → **paleta detectada**.
- Para cada cor: escolher **região** (dropdown de materiais) + **luminosidade** (degrau, ou "contorno").
  Auto-sugestão: ordenar por luminância e propor níveis; agrupar cores parecidas.
- **Preview ao vivo**: aplicar variantes do dicionário (trocar pele/roupa/material) e ver o sombreamento.
- **Salvar**: imagem semântica (+ frames/tags) no formato do §3. Validar: toda cor anotada, níveis coerentes,
  contorno presente.
- Reusa `art/palettes.js` e o motor de render do jogo (uma verdade só; valida as fronteiras da engine).

## 8. Encaixe na engine (`../2-Architecture/plano-engine.md`)
- Novo subsistema **Arte/Material** (`art/`): `semantic.js` (formato+parse), `palettes.js` (dicionário),
  `recolor.js` (motor de composição). O subsistema **Render** consome texturas já compostas; as **Entidades**
  pedem "personagem com pele=X, camisa=Y". **Tiles** idem (material por tipo).
- **Alto-contraste** = uma paleta especial (chapado + contorno) aplicada pelo mesmo `recolor` → some a
  duplicação de caminho que a pesquisa do Aseprite apontou.
- Encaixa no **boot async** (carrega dicionário + imagens semânticas).

## 9. Entrega em etapas (cada uma verificável)
1. **Formato + motor de recolor** (`art/semantic.js` + `art/palettes.js` + `art/recolor.js`), provado num
   asset pequeno (ex.: o menino), gerando a textura recolorida — sem editor ainda. Generaliza `PIP_/indexedToCanvas`.
2. **Alto-contraste via paleta** (migra `silhouetteCanvasIdx` para o novo motor).
3. **Editor** `tools/`: importar png/jpg + anotar + preview + salvar.
4. **Import Aseprite/Libresprite** (frames+tags+paleta indexada).
5. **Import Tiled/LDtk** (tileset → materiais de tile) — une com o tilemap-glifo.
6. **Migrar personagens e tiles** do jogo para o sistema semântico; PNGs viram só fonte de autoria.

## 10. Riscos
- **Escopo grande (unificado)** → entregar em etapas §9; começar por 1 personagem antes de generalizar p/ tiles.
- **Anotação trabalhosa** → auto-sugestão por luminância + import da paleta indexada do Aseprite reduzem o esforço.
- **Perf de recolor** → cache por combinação; shader/LUT só se necessário.
- **Legibilidade do formato** vs compactação → decidir texto/JSON vs PNG-de-dados no detalhamento (preferir
  legível enquanto sprites são pequenos).
- **a11y não pode regredir** → o alto-contraste passa a ser paleta; testar cedo (etapa 2).

*Fontes:* Aseprite (modo indexado / color ramps; docs CLI, gists dacap) · técnicas de palette-swap/LUT em
pixel-art (Slynyrd ramps; palette-swap gamedev) · Libresprite (fork GPL do Aseprite) · LDtk/Tiled (JSON) ·
`plano-tiled-aseprite.md` (parsers de import) · semente no repo (`PIP_PAL`/`indexedToCanvas`/`silhouetteCanvasIdx`).

---

## 11. Backlog de temas de cenário — PAUSADO até a etapa 3 (era a issue #14)

~20 temas de cenário precisam de arte (Cave, Desert, Factory, Castle, …). 🛑 **Não começar tema novo** enquanto
o pipeline procedural deste plano não estiver pronto: cada tema desenhado à mão antes disso é arte que a etapa
6 («migrar personagens e tiles para o sistema semântico») vai ter de refazer.

⚠️ **Isto veio do tracker de issues em 2026-09-09 (ADR-0126), e o corpo da issue dizia porquê sem o notar:**
*«Tracked so it isn't lost»* — uma coisa rastreada para não se perder é uma NOTA, não um problema. Não havia
conserto à espera; havia uma espera. Uma issue sem fix não tem commit que a feche, e uma que ninguém pode
fechar ensina a ignorar o quadro inteiro.

📌 **O que a destranca é a etapa 1 deste plano** (o motor de recolorização), e é por isso que ela mora aqui e
não no roadmap: quem abrir este ficheiro para construir o pipeline é exactamente quem precisa de saber que há
vinte temas à espera dele. **Cada tema vira uma issue quando for construível**, uma por tema, com a paleta e a
imagem semântica já decididas.
⚠️ **Corrigido em 2026-09-09:** esta linha dizia «etapa 3» e chamava-lhe «o motor de recolorização». Pelo §9 o
motor é a **etapa 1**; a etapa 3 é o editor. Um número errado aqui adiava vinte temas por duas etapas inteiras.
