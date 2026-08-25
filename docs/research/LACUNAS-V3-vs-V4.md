<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
---
title: Análise de lacunas — v3.1.100 (monólito) → v4.0.0 (PixiJS)
data: 2026-06-01
método: 4 subagentes em paralelo (shell/UX · ambientes/temas · personagem · mecânicas/sistemas)
fontes: v3.1.100.html (~3454 linhas) · v4.0.0/{game.js,index.html,style.css}
---

# O que a v3 tinha e ainda falta na v4

> A v4.0.0 foi uma **reescrita validação-primeiro** em PixiJS: portou o **mundo Clarity**, a **física
> base**, os **3 modos** (Lúdico/Soma-Sub/Sílabas) e ADICIONOU muita coisa nova (multiplayer 1–4,
> Braille, toque, minimapa, PWA, VLibras, persistência). Mas, por ser um esqueleto, deixou de fora
> grande parte da **camada de apresentação** (telas/menus), do **sistema de ambientes** e da
> **diversidade do personagem**. Este documento consolida o levantamento dos 4 agentes.

## 🔴 ALTO impacto — regressões estruturais (paridade essencial)

| # | Lacuna | v3 (ref) | Por que importa |
|---|---|---|---|
| A1 | **Shell de navegação ausente** — sem splash/título, sem menu de entrada, sem fluxo entre telas | `gamePhase: title→modeselect→playing` (l.3108), `drawTitleScene` (l.3115), menu (l.338) | v4 boota direto no jogo; não há ponto de entrada, byline/versão, nem "voltar" |
| A2 | **Tela de PAUSA inexistente** | `#pause-overlay` Voltar/Menu/Sair + Esc + foco-trap (l.319-328, 3194) | **Regressão de GAG/a11y** — pausar é requisito; v4 não pausa de forma alguma |
| A3 | **Diversidade do personagem perdida** — 1 personagem fixo | `randomAppearance` + `SKIN_TONES` (5 Fitzpatrick), `HAIR/SHIRT/PANTS_COLORS`, `hairStyle`, `gender` (l.1295-1309) | **Fere o pilar de inclusão/representatividade** (racial e de gênero). v4 distingue jogadores só por `tint` uniforme |
| A4 | **`drawGenderOverlay`/`drawHairOverlay`** (cabelo longo+saia; penteados) | l.2744-2758 | Representação de gênero feminino; perdida na v4 |
| A5 | **Sistema de temas inteiro** — só 1 ambiente fixo | `THEMES` (campo/cemitério/espaço/floresta/clássico), `SCENE_THEMES`, sorteio, UI de seleção (l.1025-1043, 462-467) | É a identidade visual do jogo; sem ele há um só cenário morto |
| A6 | **Gradiente de céu (`drawBackdrop`)** | l.2867-2875 | Mudança visual mais barata/imediata; v4 usa cor sólida `0x05070f` |
| A7 | **Inversão da escuridão completa** + **`drawCaveRock`/`CAVE_PAL`** | crossfade bidirecional c/ histerese (l.2139-2151); rocha de mina por tema (l.1405-1425, 1036-1041) | v4 só revela permanentemente (unidirecional), sem a estética de mina — o "prêmio visual" de entrar no escuro |
| A8 | **Bunny-hop / cadeia de pulo** `[0,5,8,9][jumpChain]` | escala o pulo correndo sobre pedra (l.2335-2353) | Coração do platforming; v4 tem pulo único fixo |
| A9 | **Voo (tile 8)** e **Wallcling/Aranha (tile 14)** — mecânicas inteiras | l.2257-2266 / 2272-2306 | Tiles 8/14 são inertes na v4 |
| A10 | **Power-ups como tiles do mapa** (7/12/13/14 via `applyItemPlacements`) | data-driven no `CLARITY_MAP` | v4 tornou 7/12/13/14 inertes e fez power-ups como spawn dinâmico/bônus — diverge do design |
| A11 | **HUD por jogador no MP** (placar P2-P4, ordem de chegada) + **inventário de power-ups** | `#score-p2`, `finishOrder`, `updatePowerupsHUD` (l.308, 1844) | v4 suporta 4 telas mas HUD só reflete o jogador ativo; jogador não vê power-up ativo |

## 🟡 MÉDIO impacto — configurações, feedback e a11y

| # | Lacuna | v3 |
|---|---|---|
| M1 | **Opções de a11y visual:** alto contraste, paleta colorblind-safe, animação decorativa (reduce-motion) | painéis WCAG Visual (l.369, 423-434) |
| M2 | **Alto contraste do personagem (`viewHC`)** — silhueta chapada | l.2730, 2825 — regressão de a11y |
| M3 | **`drawHills`** (colinas em paralaxe) + **flora por tema** (`drawBgBush`, `THEME_FLORA`) + **grama de superfície** (`drawSurfaceGrass`) | l.2859, 2916-2955, 2615-2640 (R1 pedido pelo José) |
| M4 | **Aparências realmente distintas por jogador** (não só `tint`) | loop de garantia P1≠P2 (l.1786-1797) |
| M5 | **`drawPlayerSwimming`** (sprite girado na água) + **tint vermelho de susto** | l.2734-2742, 2769 (v4 usa alpha piscante) |
| M6 | **Cronômetro** + tempo exibido na vitória | l.491, 2562-2566 |
| M7 | **Gamepad (Xbox)** + **remap de P2+** + **drop-in "PRESS START"** | `pollGamepads` (l.3331), `buildRemapUI` P1+P2 (l.3248) |
| M8 | **Dificuldade explícita** (`DIFF_PROFILES` fácil/normal) + "movimento por alternância" | l.1668 |
| M9 | **TTS por voz (`speechSynthesis`)** | v3 fala; v4 só usa `aria-live` |
| M10 | **Cadeia incremental do trampolim** (`trampLevel` 5→8) + **pulo-turbo (jump15)** | l.2045-2053, 2345 |
| M11 | **Toggle de LIBRAS sob demanda** (opt-in) + **botão tela cheia** + **pular desafio** | l.3290, 365, 1914 |

## 🟢 BAIXO impacto — polimento / extras

| # | Lacuna | v3 |
|---|---|---|
| B1 | Decorações-assinatura por tema: **nuvens, pássaros, estrelas, vagalumes, borboletas, minhocas, névoa** | l.2877-3060 |
| B2 | **Painel `?debug=true`** com knobs do TUNE editáveis ao vivo | l.3385-3419 (objeto `TUNE` já existe na v4) |
| B3 | Abas de documentação (Game/Design/Acessibilidade), toast genérico, aviso de orientação retrato, legenda de controles dinâmica | l.278, 1897, 290, 1204 |

## ⚪ Pendências do PROJETO — faltam em AMBAS (não são regressões)

- **Telemetria 1EdTech/xAPI/Caliper** (pilar P6) — nunca implementada em código.
- **i18n / idiomas nórdicos** (pilar P3) — ambas 100% pt-BR hardcoded.
- **UI de customização Mii-like** + persistência de aparência (backlog §6).
- **Árvores da Floresta Brasileira** (catálogo de espécies — backlog §7).

## ✅ Onde a v4 SUPERA a v3 (ganhos da reescrita — não confundir com lacunas)

Persistência de controles em localStorage (B2 do projeto) · multiplayer **1–4 telas** (render-to-texture)
· **controles de toque** (joystick digital) · **minimapa** fog-of-war · **PWA/offline** · integração
**VLibras** · modo **Braille** · modo **assistência** · **legendas de SFX** · modo maiúscula/minúscula ·
HUD de FPS · skip-link/landmarks · auditoria axe (0 violações).

## ✅ Auditoria do mapa — RESOLVIDA (2026-06-01): mapa IDÊNTICO

Auditoria byte-a-byte do `CLARITY_MAP` (script Node): **v3 e v4 são idênticos** — ambos **62 linhas**,
largura 13–56, **0 células diferentes**, histogramas de tile iguais. A suposta "divergência" foi um
**engano do agente** (leu o comentário desatualizado `// 58`; o array real tem 62 linhas em ambas).
Não há erro de mapa nem re-port necessário.

**Porém:** o mapa contém tiles **7 (pulo-turbo ×1), 8 (voo ×1), 10 (portão ×7), 11 (chave ×1)** que a
v4 **não usa** como mecânica (trata 7/8 como inertes; o portão/chave da E12 são spawns dinâmicos
separados, não os tiles do mapa). Isso é a lacuna de física/itens (A8–A10/E18), não um defeito do mapa.

---

## Roadmap de paridade proposto (E14+) — ordem sugerida

> Uma mudança coesa por etapa, com commit. José define/reordena.

1. **E14 — Shell de navegação:** título/splash + menu + **pausa** (A1, A2). *Desbloqueia a UX inteira.*
2. **E15 — Diversidade do personagem:** `randomAppearance` + tons Fitzpatrick + overlays cabelo/gênero + aparências distintas por jogador + HC do personagem (A3, A4, M2, M4). *Pilar de inclusão.*
3. **E16 — Sistema de temas + céu + colinas:** `THEMES` + `drawBackdrop` + `drawHills` + seleção/sorteio (A5, A6, M3-parcial).
4. **E17 — Inversão da escuridão + rocha de mina:** crossfade bidirecional + `drawCaveRock`/`CAVE_PAL` (A7).
5. **E18 — Física avançada:** bunny-hop/jumpChain + voo + wallcling + power-ups como tiles do mapa + trampolim incremental (A8-A10, M10). *Antes: auditar o `CLARITY_MAP`.*
6. **E19 — HUD/MP completo + cronômetro + opções visuais a11y:** placar por jogador, inventário de power-ups, tempo, alto contraste/CB-safe/reduce-motion (A11, M1, M6).
7. **E20 — Gamepad + remap P2+ + dificuldade + TTS** (M7, M8, M9).
8. **E21 — Decoração-assinatura por tema** (nuvens/pássaros/vagalumes/etc.) + flora/grama (B1, M3-resto).
9. **E22 — Extras:** debug panel, fullscreen, pular desafio, LIBRAS opt-in, abas/doc (B2, B3, M11).
10. **(Projeto, fora da paridade):** telemetria, i18n, Mii-like, Floresta Brasileira.
