// SPDX-License-Identifier: AGPL-3.0-or-later
// game/secret-areas — A ÁREA SECRETA QUE ACENDE QUANDO ALGUÉM ENTRA, E QUE AVISA QUEM NÃO VÊ.
//
// Este módulo é o miolo do laço `for(const reg of darkRegions)` que vivia dentro do `update(dt)` do main.js —
// o único trecho daquele `update` que não era orquestração. O resto do `update` continua lá, e deve continuar:
// uma lista de passos na ordem certa é trabalho legítimo de composition root.
//
// O que o bloco faz, dito por inteiro: cada região escura (uma cavidade do mapa, achada por inundação em
// `game/level-geometry.ts:buildDarkRegions`) é coberta por um `Graphics` preto opaco. ENQUANTO houver um
// jogador com a caixa de colisão sobre qualquer célula da região, a cobertura desaparece por interpolação; ao
// sair, ela volta. Não é inversão de cor nem lanterna — é revelar o que estava escondido, e esconder de novo.
// E, na entrada, o jogo ANUNCIA "Área secreta revelada." ao leitor de tela, uma vez só.
//
// ======================= É ENGINE, E NÃO DESTE JOGO =======================
// Um segundo jogo da coleção reusaria isto inteiro, e é fácil ver por quê: nada aqui sabe o que é moeda,
// quiz, sílaba ou power-up. O que existe é um predicado geométrico ("alguma caixa encosta neste conjunto de
// células?"), um passo de interpolação e uma regra de anúncio. "Área secreta que se revela por presença" é
// uma mecânica de plataforma genérica, e o ANÚNCIO é a metade que nenhum outro engine traz de graça: é o
// pilar de a11y do ADR-0010 aplicado a um segredo VISUAL, que sem isto simplesmente não existiria para quem
// joga com leitor de tela.
// Mora em `game/` — e não em `render/` — porque a decisão é de MECÂNICA, não de pixel: o alfa é a saída, não
// o assunto. É a mesma vizinhança de `game/physics.ts`, `game/elevators.ts` e `game/level-geometry.ts`, que
// são igualmente engine e igualmente reusáveis. Fica, aliás, EXATAMENTE ao lado de quem produz o seu dado:
// `buildDarkRegions` monta as regiões, este módulo as anima. Produtor e consumidor porta com porta.
//
// ======================= DECIDIR ≠ EXECUTAR: as três partes puras =======================
// A extração vale pela testabilidade, e o que importa testar não é o `gfx.alpha = …`:
//   · `regionOccupied(cells, players, box, tile)` — a caixa do jogador vira um RETÂNGULO DE TILES e se
//     pergunta se alguma célula dele está no conjunto da região. Aqui mora a assimetria fácil de errar: a
//     borda direita e a borda de baixo descontam 0,01px antes de dividir, senão um jogador exatamente
//     encostado na parede "ocuparia" a coluna seguinte. Sem teste, essa subtração é indistinguível de sujeira.
//   · `stepRevealAlpha(alpha, occupied, dt)` — o passo de 0,08 por tick COM TRAVA NOS DOIS SENTIDOS
//     (`Math.min` subindo, `Math.max` descendo). Sem a trava, um `dt` grande (aba que volta do segundo plano,
//     máquina de escola engasgando) passaria do alvo e a cobertura piscaria — e piscar é WCAG 2.3.1, não é
//     estética. E o corte de visibilidade em `alpha > 0.001`, que tira o `Graphics` do render em vez de
//     desenhá-lo transparente.
//   · `nextAnnounce(announced, occupied, alpha)` — a HISTERESE. Anuncia ao entrar; NÃO repete enquanto o
//     jogador está dentro (senão seriam 60 anúncios por segundo em cima do leitor de tela, que é a diferença
//     entre uma pista e uma tortura); e só rearma quando a cobertura voltou a ser TOTAL (`alpha >= 1`) — ir e
//     voltar na soleira da porta não gera um segundo anúncio. Essa regra é acessibilidade pura e, até esta
//     extração, não tinha teste nenhum.
//
// ======================= O QUE FICOU DE FORA, E POR QUÊ =======================
//  · A CRIAÇÃO das regiões (`buildDarkRegions` + o `Graphics` preto + o `darkLayer`) fica no main.js: é
//    z-order e composição de cena. Este módulo recebe as regiões prontas e nunca as constrói.
//  · O conteúdo que a escuridão cobre (`abandonG`: entulho, viga, pichação) é de `render/scene-city.ts`.
//  · `inDark(tx,ty)` — o predicado que impede pombo e gato de nascerem dentro de uma secreta — FICA no
//    main.js: ele pergunta outra coisa (é célula de segredo?), não tem a ver com presença nem com alfa, e
//    `render/scene-city` também o usa.
//  · O passo NÃO é agendado aqui. Continua sendo o `update(dt)` do main.js que decide a ordem (depois da
//    física, para que a posição do quadro já seja a definitiva) — orquestração é do composition root.
//
// ======================= ARMADILHAS DE ORDEM DE BOOT =======================
//  · `darkRegions` é `const` do main.js, criado bem acima do `update`. Entra por VALOR (é o mesmo array de
//    ponta a ponta; o módulo MUTA `gfx.alpha` e `announced` nos objetos, nunca troca o array). Logo,
//    `initSecretAreas` tem de ser chamado DEPOIS daquela declaração — não é uma seta preguiçosa que salva,
//    é a posição do init.
//  · `players` entra por GETTER: é a lista viva de `core/state.ts`, que muda de tamanho quando alguém entra
//    ou sai da partida.
//  · SEM I/O no import e sem PIXI: o `Graphics` entra por interface estrutural de DOIS campos (`alpha`,
//    `visible`), o que faz o módulo inteiro rodar no project `node` com objetos literais.

/** O par de campos que este módulo escreve na cobertura escura — um `PIXI.Graphics`, visto por um buraco. */
export interface RevealGfx { alpha: number; visible: boolean }

/** Uma região secreta VIVA: as células que a formam, a cobertura, e se ela já foi anunciada. */
export interface SecretRegion {
  /** Células da região, na grafia `"tx,ty"` (a mesma que o main.js monta e que `inDark` consulta). */
  set: Set<string>;
  /** A cobertura preta que some ao entrar. */
  gfx: RevealGfx;
  /** Trava do anúncio — ver `nextAnnounce`. */
  announced: boolean;
}

/** O mínimo que se lê de um jogador: o pé (x central, y da base). */
export interface OccupantPos { x: number; y: number }

/** A caixa de colisão do jogador (`game/player.ts:BOX`): largura centrada em x, altura ACIMA de y. */
export interface BoxSize { w: number; h: number }

/** Quanto de alfa a cobertura anda por tick de 60fps. */
export const REVEAL_ALPHA_STEP = 0.08;
/** Abaixo disto a cobertura sai do render (`visible = false`) em vez de ser desenhada quase transparente. */
export const REVEAL_VISIBLE_MIN = 0.001;
/** O anúncio, palavra por palavra — a mesma frase que o leitor de tela recebia do main.js. */
export const SECRET_REVEAL_MSG = 'Área secreta revelada.';
/** A folga subtraída das bordas direita e inferior antes de dividir pelo tile. Ver `playerTileSpan`. */
export const EDGE_EPSILON = 0.01;

/**
 * A cobertura ainda vale a pena desenhar?
 *
 * ESTRITAMENTE acima do limiar: em `0.001` ela já sai do render, em vez de ser desenhada quase transparente
 * (um `Graphics` invisível ainda custa uma passada de desenho, e são várias regiões por mapa).
 *
 * Existe como função, e não como duas comparações dentro de `stepRevealAlpha`, por um motivo que só apareceu
 * na mutação: escrito duas vezes, o limiar tem uma cópia INALCANÇÁVEL — no ramo "já está no alvo" o alfa só
 * pode ser 0 ou 1, então trocar `>` por `>=` ali não muda nada e nenhum teste pode pegar. Uma expressão só,
 * exportada, e o limiar volta a ter exatamente um lugar onde errar.
 */
export function isRevealVisible(alpha: number): boolean {
  return alpha > REVEAL_VISIBLE_MIN;
}

/** O retângulo de TILES que a caixa de um jogador cobre. */
export interface TileSpan { tx0: number; tx1: number; ty0: number; ty1: number }

/**
 * A caixa do jogador em coordenadas de TILE.
 *
 * `pl.x` é o CENTRO horizontal e `pl.y` é a BASE (os pés), então a caixa vai de `x - w/2` a `x + w/2` e de
 * `y - h` a `y`. As duas bordas "de saída" (direita e inferior) descontam {@link EDGE_EPSILON} antes de
 * dividir: sem isso, um jogador cuja borda direita caísse exatamente em `k * TILE` reivindicaria também a
 * coluna `k`, que ele apenas toca — e uma área secreta acenderia com o personagem ainda do lado de fora.
 */
export function playerTileSpan(pl: OccupantPos, box: BoxSize, tile: number): TileSpan {
  return {
    tx0: Math.floor((pl.x - box.w / 2) / tile),
    tx1: Math.floor((pl.x + box.w / 2 - EDGE_EPSILON) / tile),
    ty0: Math.floor((pl.y - box.h) / tile),
    ty1: Math.floor((pl.y - EDGE_EPSILON) / tile),
  };
}

/** Alguma célula do retângulo `span` pertence ao conjunto `cells`? */
export function spanTouchesCells(span: TileSpan, cells: Set<string>): boolean {
  for (let ty = span.ty0; ty <= span.ty1; ty++) {
    for (let tx = span.tx0; tx <= span.tx1; tx++) {
      if (cells.has(tx + ',' + ty)) return true;
    }
  }
  return false;
}

/**
 * A região está ocupada por ALGUÉM? Basta um jogador — o segredo é do ambiente, não de quem o achou.
 * (Consequência conhecida e preservada: em multi-tela, o jogador 2 revela a área do jogador 1.)
 */
export function regionOccupied(cells: Set<string>, players: readonly OccupantPos[], box: BoxSize, tile: number): boolean {
  for (const pl of players) {
    if (spanTouchesCells(playerTileSpan(pl, box, tile), cells)) return true;
  }
  return false;
}

/** O resultado de um passo de alfa. `changed: false` = já estava no alvo, e NADA deve ser escrito. */
export interface AlphaStep {
  /** O alfa novo (igual ao antigo quando `changed` é falso). */
  alpha: number;
  /** A visibilidade que corresponde ao alfa novo — o chamador só a aplica quando `changed` é verdadeiro. */
  visible: boolean;
  /** Houve movimento? Preserva o `if (alpha !== target)` do original: parado, nem `visible` se reescreve. */
  changed: boolean;
}

/**
 * Um passo da cobertura em direção ao alvo (`0` quando ocupada — revelada; `1` quando vazia — escura).
 *
 * A TRAVA é a razão de esta função existir separada: `Math.min` na subida e `Math.max` na descida garantem
 * que nenhum `dt` grande ultrapasse o alvo. Sem elas o alfa oscilaria em torno de 0 ou de 1 e a área
 * piscaria — que é falha de acessibilidade (WCAG 2.3.1), não enfeite quebrado.
 */
export function stepRevealAlpha(alpha: number, occupied: boolean, dt: number, stepPerTick: number = REVEAL_ALPHA_STEP): AlphaStep {
  const target = occupied ? 0 : 1;
  const step = stepPerTick * dt;
  if (alpha === target) return { alpha, visible: isRevealVisible(alpha), changed: false };
  const next = target > alpha ? Math.min(target, alpha + step) : Math.max(target, alpha - step);
  return { alpha: next, visible: isRevealVisible(next), changed: true };
}

/** O que fazer com o anúncio neste quadro. */
export interface AnnounceDecision {
  /** O novo valor da trava. */
  announced: boolean;
  /** Falar AGORA? */
  say: boolean;
}

/**
 * A histerese do anúncio, em três regras:
 *  1. entrou e ainda não avisou → avisa e TRAVA;
 *  2. está dentro e já avisou → silêncio (senão, um anúncio por quadro);
 *  3. saiu E a cobertura já voltou ao preto TOTAL (`alpha >= 1`) → REARMA, para a próxima entrada avisar.
 * A regra 3 é o que impede que ir e voltar na soleira da porta gere dois anúncios: enquanto a cobertura ainda
 * está desbotando de volta, a trava continua de pé.
 *
 * `alpha` é o valor JÁ ATUALIZADO pelo passo deste quadro — a ordem importa e é a do original.
 */
export function nextAnnounce(announced: boolean, occupied: boolean, alpha: number): AnnounceDecision {
  if (occupied && !announced) return { announced: true, say: true };
  if (!occupied && alpha >= 1) return { announced: false, say: false };
  return { announced, say: false };
}

/* ===================== a metade que MUTA: um passo por quadro ===================== */

export interface SecretAreasCtx {
  /** As regiões prontas (`const` do main.js, montado sobre `buildDarkRegions`) — por VALOR: ver o cabeçalho. */
  regions: SecretRegion[];
  /** A lista viva de jogadores (`core/state.ts`) — por GETTER: ela cresce e encolhe. */
  getPlayers: () => readonly OccupantPos[];
  /** Caixa de colisão do jogador (`game/player.ts:BOX`). */
  box: BoxSize;
  /** Lado do tile em pixels (`core/constants.ts:TILE`). */
  tile: number;
  /** Anúncio ao leitor de tela (`core/a11y-sr.ts:srSay`). */
  srSay: (msg: string) => void;
}

export interface SecretAreasApi {
  /** Um quadro: ocupação → alfa → anúncio, para cada região. Chamado pelo `update(dt)` do main.js. */
  stepSecretAreas(dt: number): void;
}

export function initSecretAreas(ctx: SecretAreasCtx): SecretAreasApi {
  function stepSecretAreas(dt: number): void {
    const players = ctx.getPlayers();
    for (const reg of ctx.regions) {
      const occ = regionOccupied(reg.set, players, ctx.box, ctx.tile);

      const st = stepRevealAlpha(reg.gfx.alpha, occ, dt);
      // `changed` guarda a escrita inteira, `visible` inclusive — verbatim do original, onde o
      // `if (alpha !== target)` envolvia as DUAS atribuições.
      if (st.changed) { reg.gfx.alpha = st.alpha; reg.gfx.visible = st.visible; }

      const an = nextAnnounce(reg.announced, occ, reg.gfx.alpha);
      reg.announced = an.announced;
      if (an.say) ctx.srSay(SECRET_REVEAL_MSG);
    }
  }

  return { stepSecretAreas };
}
