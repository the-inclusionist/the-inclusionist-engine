// SPDX-License-Identifier: AGPL-3.0-or-later
// O JOGO DE MENTIRA QUE OS GATES DA ENGINE USAM — nascido da separação do cartucho (issue #111).
//
// ========================= O QUE ISTO EXISTE PARA CONSERTAR =========================
// Nove gates desta engine importavam de `app/js/game/**` para se montarem: `render/draw` pedia o
// `makePlayer` do jogo, `render/high-contrast` pedia a tabela `roleOf`, `ui/activities-menu` pedia o estado
// e o id, `input/touch` pedia o preset da plataforma. Enquanto o jogo morava aqui isso parecia natural — e
// era a fronteira a ser afirmada em prosa e desmentida pelos imports.
//
// ⚠️ E O CUSTO NÃO ERA HIPOTÉTICO: com o cartucho fora, esses gates simplesmente não compilam. Foi a medida
// que a separação devolveu, e é o que torna esta pasta trabalho e não arrumação.
//
// ========================= A REGRA DESTE FICHEIRO =========================
// ⚠️ UM FALSO DECLARA A FATIA MÍNIMA, NUNCA O JOGO INTEIRO. `core/entity.ts` já regista por escrito por que
// as vinte e três visões estreitas existem: «trocar 23 visões estreitas por uma interface gorda destruiria
// isso — todo fixture passaria a ter de inventar 52 campos». Copiar o `makePlayer` de verdade para cá seria
// exatamente isso, com o agravante de a cópia divergir sem ninguém notar.
//
// ⚠️ E O QUE UM FALSO NÃO PODE FAZER É PROVAR UMA RELAÇÃO COM O JOGO REAL. Onde um gate afirmava algo sobre
// o cartucho — que o preset da plataforma tem nove ações, que o manifesto de sprites tem quatro quadros de
// `idle` — a asserção NÃO foi falsificada: ela mudou de repositório, para `game-platformer`, onde o jogo
// existe e a engine chega pelo pacote. Integração pertence a quem integra.

/**
 * A caixa de colisão. É o mesmo `{w:10,h:30}` que `draw.node.test.js` já inventava no seu ctx falso — e o
 * ficheiro avisava, na linha do lado, que os casos da câmera conferem `y - BOX.h/2`, então o número tem de
 * ser coerente entre o ctx e o jogador. Agora há UM número, e ele está aqui.
 */
export const BOX_FALSO = Object.freeze({ w: 10, h: 30 });

/**
 * Um jogador com a fatia que os módulos de RENDER da engine leem, e nada mais.
 *
 * ⚠️ OS CAMPOS NÃO FORAM ESCOLHIDOS A OLHO: são os que `render/player-anim` de facto lê, extraídos por
 * varredura de `pl.<campo>` no módulo — vinte e cinco. O `makePlayer` do jogo devolve mais de quarenta;
 * copiar todos seria trazer o jogo de volta por baixo, e adivinhar menos deixa a máquina de animação a
 * devolver `undefined`, que foi como este ficheiro descobriu que faltavam onze.
 *
 * Os valores são os que o `makePlayer` real usa no arranque, para o falso começar onde o jogo começa.
 */
export function jogadorFalso(i = 0, over = {}) {
  return {
    i,
    x: 100 + i * 22, y: 100, vx: 0, vy: 0,
    onGround: false, onLadder: false, inWater: false, airTime: 99,
    facing: 1, anim: 0, walkAnim: 0, walkDir: 0,
    hurtTimer: 0, clinging: false, clingN: null, jumpChain: 0, groundIdle: 0,
    // o bloco que a máquina de animação lê
    flying: false, idleNow: false, idleTime: 0, flavor: -1, flavorT: 0, climbFrame: 0,
    running: false, walking: false, runCane: false,
    rmWalk: false, rmBreath: false, rmFlavor: false,
    viz: 'normal', easy: false, toggleMove: false,
    activePower: 'off', owned: [], hasKey: false,
    quiz: null, sprite: null, _tx: null,
    ...over,
  };
}

/**
 * A tabela tile→papel, de mentira. A de verdade é do JOGO e a engine a RECEBE — é o que o comentário de
 * `high-contrast` já dizia enquanto importava a do jogo.
 *
 * ⚠️ Os papéis são os da ENGINE (`render/hc-role-data`), não os tiles do jogo: o que um gate de alto
 * contraste prova é que a cor sai do PAPEL, e para isso qualquer tabela que devolva papéis serve. Uma que
 * copiasse os tiles do platformer voltaria a atar a engine a um jogo, só que por baixo.
 */
export function roleOfFalso(tipo) {
  // ⚠️ OS NOMES SÃO OS DE `render/hc-role-data.HC_ROLE_KEYS`, e não inventados: `hazard`, `climb`, `water`.
  // A primeira versão deste falso devolvia `solid` e `ladder`, que não existem — e dezassete casos do project
  // browser estouraram com `Cannot read properties of undefined`, porque a tabela de cores é indexada pelo
  // papel. `gate` fica de fora de propósito: o próprio módulo regista que ele NÃO vem de `roleOf()`.
  // ⚠️ OS NÚMEROS TAMBÉM NÃO SÃO LIVRES: os gates de alto contraste montam um mundo de teste e escrevem os
  // tipos na prosa dos casos — «col0=pedra(2, estrutura) · col1=lava(9, hazard) · col2=escada(4, climb)», e
  // «água(3)». Inverter 2 e 9 fazia a pedra ser repintada e a lava não, e três casos reprovavam a dizer
  // exatamente isso. O `2` devolve `null` de propósito: estrutura NÃO tem papel, só é dessaturada.
  if (tipo === 9) return 'hazard';
  if (tipo === 4) return 'climb';
  if (tipo === 3) return 'water';
  return null;
}

/**
 * Um preset de NOVE ações — o número que o jogo de plataforma declara hoje.
 *
 * ⚠️ E é por isso que ele é falso e não importado: o gate que prova que o preset REAL tem nove ações mudou
 * para `game-platformer`, junto com o preset. O que fica aqui é o comportamento da engine DADO um preset de
 * nove, que é o que `input/touch` e `ui/reach-notice` de facto testam.
 */
export function presetFalso() {
  // A FORMA é `{ label, short? }` — a mesma do `ActionPreset` de `core/actions`. O `short` só existe nas
  // quatro ações, porque é a palavra da LEGENDA e as direções não entram nela.
  return {
    up: { label: 'subir' }, down: { label: 'descer' },
    left: { label: 'esquerda' }, right: { label: 'direita' },
    action1: { label: 'correr', short: 'corre' },
    action2: { label: 'pular', short: 'pula' },
    action3: { label: 'especial', short: 'esp' },
    action4: { label: 'interagir', short: 'pega' },
    start: { label: 'pausar' },
  };
}

/** O id de armazenamento, que desde o ADR-0088 é do jogo e não da engine. Neutro de propósito. */
export const JOGO_FALSO = 'jogo-de-teste';
