<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# E15 — Personagem em camadas + animações (spec)

**Decisões do José (2026-06-01):**
- **Resolução mantida** (320×180, tiles 16px) — 48×48 cancelado (estudo TDAH pendente). **SEM TAMANHO FIXO de
  sprite** (emendado e REMEDIDO em 2026-08-25): este documento dizia 16×32 e nenhum dos 80 PNG entregues tem esse
  tamanho. Os 39 quadros de sprite cobrem **13 animações** em **15 tamanhos distintos**, larguras 24–34 e alturas
  29–36, mais um 64×64 esquecido. E o tamanho **varia dentro da mesma animação** (`nadar` 34×29 e 34×32; `pulo`
  26×32 e 28×30) — não há nem tamanho por animação em que se apoiar. Ver a seção "Sprite size" do
  [`Art-Bible.md`](Art-Bible.md) para a medição e as consequências (o atlas não pode supor grade uniforme, nem
  por folha nem por animação; cada sprite carrega o próprio pivô, porque o `render/draw` ancora o squash &
  stretch NOS PÉS).
- **Orientação:** personagem em **perfil**, virado para a **última direção** (E/W). **Sempre respira/anima** (idle nunca estático).
- **Camadas procedurais:** corpo + cabelo + roupa como camadas (palette-swap por chave + overlays) → diversidade
  (5 tons Fitzpatrick, vários cabelos/roupas), jogadores distintos no multiplayer. **Sem PNG embutido** (GPL-clean);
  PixelLab gera só **referência de design**, convertida à mão para sprite procedural.

## Pipeline (validado na prova)
PixelLab (referência) → extrair paleta/pose → **sprite procedural** (pixel-data + paleta hex) → sistema de camadas.
Prova feita: `Pip` lateral → paleta extraída → render procedural fiel (ver `assets-ref/`, não versionado). A
prova original foi num quadro 16×32; o tamanho era do EXPERIMENTO, não uma spec — a arte entregue depois não o
seguiu, e a decisão do Dev é que não há tamanho fixo.

## Animações pedidas → fonte PixelLab

| # | Animação (José) | Fonte PixelLab | Tipo |
|---|---|---|---|
| 1 | **Respirar sempre** (idle vivo) | `breathing-idle` | template |
| 2 | Andar | `walking` | template |
| 3 | Correr | `running-8-frames` | template |
| 4 | Pular do chão | `jumping-1` / `two-footed-jump` | template |
| 5 | Pular da parede (wall-jump) | "pushing off a wall to jump" | v3 custom |
| 6 | Mudar de orientação (virar) | "turning around" | v3 custom |
| 7 | Agachar | `crouching` | template |
| 8 | Rastejar | "crawling on belly" | v3 custom |
| 9 | Escalar parede | "climbing a wall" | v3 custom |
| 10 | Andar pendurado no teto | "moving hand over hand on ceiling" | v3 custom |
| 11 | Subir/descer escada | "climbing a ladder" | v3 custom |
| 12 | Subir/descer cipó/corda | "climbing a rope" | v3 custom |
| 13 | Nadar frente/trás | "swimming horizontally" | v3 custom |
| 14 | Nadar p/ baixo / mergulhar | "diving downward swimming" | v3 custom |
| 15 | Nadar p/ cima | "swimming upward" | v3 custom |
| 16 | Sair da água | "climbing out of water" | v3 custom |
| 17 | Voar | "flying with arms out" | v3 custom |
| 18 | Pulo "bumbum em chamas" (lava/fogo) | "jumping in panic, bottom on fire" | v3 custom |
| 19 | Pulo "bumbum dolorido" (espinhos) | "jumping in pain holding bottom" | v3 custom |

**Economia (Tier 1, 2000 ger.):** gerar só a direção **east** (espelhar W no motor) → 1 geração por animação.
Lote 1 (prova de animação): #1 breathing-idle + #2 walking. Validar conversão → escalar para o resto.

## Status
- [x] Base `Pip` (referência lateral) + prova de conversão procedural.
- [ ] Lote 1: breathing-idle + walking (em geração).
- [ ] Conversão das animações para frames procedurais.
- [ ] Sistema de camadas (pele Fitzpatrick + cabelos + roupas) + distinção por jogador.
- [ ] Lotes 2+: demais animações (#3–#19).
