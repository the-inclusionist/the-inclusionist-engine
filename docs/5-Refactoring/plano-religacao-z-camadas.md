# Plano — religação das camadas ao `core/layers.ts` (ordem-z canônica) · issue !52 · ADR-0020

Converter TODAS as camadas do jogo à ordem-z nomeada (`Z` em `app/js/core/layers.ts`). Fim do
`addChildAt(camera.getChildIndex(vizinha))` e dos hacks de "re-adicionar ao topo". **Mundo** (dentro da `camera`) passa a
usar `sortableChildren=true` + `layer.zIndex=Z.*`; **overlay** (DOM) usa `z-index:Z.*` via CSS var/classe.

> **Método:** uma rodada por faixa; após cada rodada o **Dev builda e nós dois testamos** (title + 4 temas v3 + Cidade +
> menus + HUD + modos de a11y). Elementos concretos entram por `Z.BANDA + offset` pequeno para **preservar a ordem atual
> exata** (a religação é comportamento-neutro; só troca o mecanismo de z).

## Fundação (parte da Rodada 1)
- `camera.sortableChildren = true` e `app.stage.sortableChildren = true`.
- Remover os hacks: `camera.addChild(fxG/carLayer/themeFxG/fogG)` repetidos (game.js:1185,1220) e o
  `app.stage.setChildIndex(weatherLayer, …)` do `drawWeather` (513) — substituídos por `zIndex`.

## Inventário + atribuição (todos os elementos)

### MUNDO (dentro de `camera`, por viewport)
| Elemento | game.js | z atual (hack) | → `Z.*` | Rodada |
|---|---|---|---|---|
| `parallaxLayers[0]` sky | 606 | addChildAt i=0 | `PARALLAX_4` | R1 |
| `parallaxLayers[1]` far | 606 | addChildAt i=1 | `PARALLAX_3` | R1 |
| `parallaxLayers[2]` near | 606 | addChildAt i=2 | `PARALLAX_2` | R1 |
| `starsG` (estrelas) | 683 | addChildAt(idx parallax[1]) | `SKY_ANIM` | R1 |
| `skyLayer` (nuvens/pássaros do mundo) | 1125 | addChildAt(idx worldSprite) | `PARALLAX_1+500` | R1 |
| `skyDecoG` (nuvens/pássaros de tela v3) | 684 | addChildAt(idx worldSprite) | `BG_DECOR-500` | R1 |
| `decoLayer` (árvores) | 774 | addChild | `BG_DECOR` | R1 |
| `waterFxG` (corais/algas/peixes) | 1155 | decoLayer.addChild | `BG_DECOR+100` | R1 |
| `abandonG` (ruínas, sob escuridão) | 1094 | addChildAt(idx darkLayer) | `BG_DECOR+200` | R1 |
| `cityDecoG` (deco cidade) | 1093 | lifeLayer.addChildAt 0 | `BG_DECOR+300` | R1 |
| `worldSprite` (tiles) | 681 | addChild | `TILES` | R2 |
| `rampLayer` (rampa cadeirante) | 830 | worldSprite+1 | `SCENERY_INTERACT` | R2 |
| `ropeLayer` (corda) | 869 | worldSprite+1 | `SCENERY_INTERACT+10` | R2 |
| `elevLayer` (elevador) | 902 | worldSprite+1 | `SCENERY_INTERACT+20` | R2 |
| **`extraLayer`** — portão | 798/803 | addChild | `SCENERY_INTERACT+50` | R2 |
| **`extraLayer`** — power-ups | 798/802 | addChild | `ITEMS+100` | R2 |
| `lavaFxG` (tracinhos de lava) | 1154 | lifeLayer.addChildAt 0 | `VFX_BACK` | R2 |
| `lifeLayer` (bichos da cidade) | 953 | addChild | `FAUNA_BACK` | R1 |
| `grassG` (grama/flores) | 1138 | lifeLayer.addChildAt 0 | `FLORA_BACK` | R1 |
| `coinContainer` (moedas/letras/formas) | 724 | addChild | `ITEMS` | R2 |
| `playerSprite` / `allPSprites` | 1183/1219 | addChild | `PLAYER` | R2 |
| `caneLayer` (bengala) | 926 | addChild | `PLAYER+10` | R2 |
| `chairLayer` (cadeira de rodas) | 941 | addChild | `PLAYER+20` | R2 |
| `easyHitbox` (hitbox modo fácil) | 828 | addChild | `WORLD_A11Y` | R3 |
| `fxG` (partículas/juice) | 1195 | addChild + re-add topo | `VFX_FRONT` | R3 |
| `carLayer` (carros) | 1037 | addChild + re-add topo | `VEHICLES` | R3 |
| `themeFxG` (minhocas/vagalumes/borboletas v3, à frente) | 1139 | addChild + re-add topo | `FAUNA_FRONT` | R1 |
| `fogG` (névoa) | 685 | addChild + re-add topo | `WEATHER-500` | R1 |
| `darkLayer` (escurecimento cego) | 742 | addChild | `DARK_WORLD` | R1 |

> `FLORA_FRONT` fica **reservada** (folhagem que tampa o player) — sem elemento hoje; entra quando houver planta de primeiro-plano.

### GLOBAL / OVERLAY (na `app.stage` PIXI ou no DOM)
| Elemento | onde | z atual | → `Z.*` | Rodada |
|---|---|---|---|---|
| `camera` (o mundo) | app.stage | addChild / addChildAt 0 | base (zIndex 0) | R1 |
| `weatherLayer` (chuva/clarão em tela) | app.stage | setChildIndex topo | `WEATHER` | R3 |
| `titleG` (cena do título) | app.stage | addChildAt(idx weather) | `MENU` (é a tela de menu) | R4 |
| `vpSpr`/`vpFrames`/`vpDots` (viewports MP) | app.stage | addChild | `HUD` (molduras/bolinhas) | R4 |
| `_minimap` | render/minimap | stage.addChild | `HUD+100` | R4 |
| `#game-hud` | CSS z-4 | 4 | `HUD` | R4 |
| `.touch` / `.touch-start` | CSS z-14/15 | 14/15 | `TOUCH_CONTROLS` | R4 |
| `#viz-overlay` / `#viz-indicator` | CSS z-8/20 | 8/20 | `WORLD_A11Y`/`HUD` | R4 |
| `.quiz` (atividade) | CSS z-12 | 12 | `DIALOGUE` | R4 |
| `.pause-incanvas`/`.screen-pause` | CSS z-6 | 6 | `GAME_MSG` | R4 |
| `#game-region .overlay` (modais a11y) | CSS z-60 (+`_ovZ` JS) | 60 | `MENU` (range) | R4 |
| `.overlay` (modal global) | CSS z-50 | 50 | `MENU` | R4 |
| `.skip-link` | CSS z-100 | 100 | `CAPTIONS-? (a11y nav)` | R4 |
| **CRT vinheta** `::before` | CSS z-5 | 5 | **POST_FX** (cobre tudo) | R5 |
| **CRT scanlines** `::after` | CSS z-500 | 500 | **POST_FX** (cobre tudo) | R5 |
| filtros a11y (HC / CB / empatia) | (hoje no canvas) | — | **POST_FX** (último; cobre menu) | R5 |

## Rodadas (build + teste do Dev entre cada)
> **Correção (sortableChildren é tudo-ou-nada por container):** um filho sem `zIndex` vira 0 e desaba pro fundo. Logo o
> MUNDO inteiro (a `camera`) migra **numa rodada só** — todos os filhos ganham `zIndex` de uma vez, reproduzindo a ordem
> atual (**no-op visual**). Não dá pra fatiar fundo/núcleo/frente sem quebrar no meio → as ~24 linhas de MUNDO são **R1**.

- **R1 — MUNDO inteiro (atômico):** `camera.sortableChildren=true` + `zIndex=Z.*` em TODOS os filhos da câmera (céu →
  world-a11y), removendo os `addChildAt(getChildIndex)` e os re-add-ao-topo. Alvo = **no-op visual**. *Testar:* 4 temas v3
  + Cidade + cego/cadeirante — nada muda de ordem; itens atrás do player; portão; carros/névoa na frente.
- **R2 — OVERLAY (stage global + DOM):** `app.stage.sortableChildren` p/ `camera`(base)/`weatherLayer`/`titleG`/viewports;
  `z-index:Z.*` no CSS p/ HUD/minimapa/toque/quiz/pause/modais/menus. *Testar:* menu sobre HUD; modais empilham; título; MP.
- **R3 — PÓS-FX (fix de comportamento):** CRT + filtros a11y cobrindo **tudo, inclusive menu**; `A11Y_CORRECTION` por
  último; a11y **suprime** o CRT decorativo; overlay troca p/ **paleta CB-safe**. *Testar:* daltonismo/alto-contraste **no menu**.

## Pontos que a religação já corrige (bônus)
- **`extraLayer` misturava** portão (cenário) + power-ups (itens) → separados em `SCENERY_INTERACT` vs `ITEMS`.
- **Hacks de "re-erguer ao topo"** (`fxG`/`carLayer`/`themeFxG`/`fogG` re-adicionados em 1185/1220; `weatherLayer` em 513) → viram `zIndex` declarativo.
- **CRT/a11y não cobriam o menu** (bug relatado) → resolvido na R5 (pós-fx sobre o frame composto).
