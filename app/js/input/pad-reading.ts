// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-reading — WHAT A GAMEPAD IS DOING RIGHT NOW, and nothing else.
//
// 🔴 WHY IT IS ITS OWN MODULE. `input/gamepad` carried two jobs under one name: this one — buttons and axes in,
// positions out, no host, no state, no clock — and the DI runtime that polls the pads every frame and decides
// where the reading goes (title, pause, seat, play, wizard). The second is the engine's wiring and can only be
// read with a ctx in hand; the first is arithmetic over a snapshot, and every one of its rules is a promise to a
// child whose controller the browser does not recognise: a D-pad on a DirectInput POV hat, an analogue axis used
// as a button, a map the child recorded in the wizard.
//
// 📌 Nothing here reads or writes state. The frame-to-frame memory (`padCur`, `padPrevAct`) belongs to whoever
// polls; `PAD_DEAD` comes from `input/state` because it is the engine's dead zone and not this module's opinion.
import { GAMEPAD_STANDARD } from './default-bindings.js';
import type { PadTable } from './pad-defaults.js';
import type { Action } from '../core/actions.js';
import { PAD_DEAD } from './state.js';

// ---------------------------------------------------------------------------------------------
// Gamepad API surface (minimal, adapter-friendly — mirrors the real Gamepad/GamepadButton shape)
// ---------------------------------------------------------------------------------------------

export interface PadButtonLike { pressed: boolean; }
export interface PadLike {
  id: string;
  index: number;
  mapping: string; // 'standard' (XInput) | '' (DirectInput/other)
  buttons: readonly (PadButtonLike | null | undefined)[];
  axes: readonly number[];
}
/** Adapter for `navigator.getGamepads()` — the DI point that lets tests feed a fake pad without a browser. */
export type GetGamepads = () => readonly (PadLike | null | undefined)[] | null | undefined;

// ---------------------------------------------------------------------------------------------
// Action mapping (button/axis -> game action)
// ---------------------------------------------------------------------------------------------

/** One binding captured by the wizard: a digital button, a signed analog threshold, or an exact hat/POV value.
 *  Loosely-shaped (all fields optional) rather than a strict union: bindings round-trip through JSON in
 *  localStorage, so `bindActive` must stay defensive against malformed/partial saved data, same as the original. */
export interface PadBinding { b?: number; ax?: number; s?: number; av?: number; v?: number; }
/** action -> binding, keyed by the 9 wizard steps (left/right/up/down/jump/run/swap/especial/start), PLUS the
 *  `_skip: true` sentinel meaning "user cancelled the wizard for this model — use the default mapping, don't
 *  ask again this session" (not persisted). A flat index signature (not `Partial<Record<..>> & {_skip}`) so the
 *  boolean `_skip` and the PadBinding action values can coexist under TS's index-signature rule; `bindingAt`
 *  narrows a lookup back down to a PadBinding for `bindActive`. */
export type PadMap = Record<string, PadBinding | boolean | undefined>;
function bindingAt(map: PadMap, key: string): PadBinding | undefined {
  const v = map[key];
  return typeof v === 'object' && v !== null ? v : undefined;
}

export type ActionKey = 'left' | 'right' | 'up' | 'down' | 'action2' | 'action1' | 'action4' | 'action3';
export interface Dirs { left: boolean; right: boolean; up: boolean; down: boolean; }
export interface PadActions extends Dirs {
  [key: string]: boolean; // torna PadActions atribuível a PadState (input/state.ts's Record<string,boolean>)
  action2: boolean; action1: boolean; action4: boolean; action3: boolean;
  _start: boolean; // pulo OU start (fecha diálogos/telas de vitória)
  _pause: boolean; // só start (pausa/retoma)
}

// [axisValue, up, down, left, right] — os 8 passos de um D-pad "POV hat" (eixo alto do DirectInput), repouso ~1.286.
const HAT_STEPS: readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1][] = [
  [-1, 1, 0, 0, 0], [-0.7143, 1, 0, 0, 1], [-0.4286, 0, 0, 0, 1], [-0.1429, 0, 1, 0, 1],
  [0.1429, 0, 1, 0, 0], [0.4286, 0, 1, 1, 0], [0.7143, 0, 0, 1, 0], [1, 1, 0, 1, 0],
];

/** O passo do hat que este valor de eixo É, ou `null` — os oito distam ~0.286, e a tolerância é ±0.09. */
function hatStepAt(v: number | undefined): readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1] | null {
  if (typeof v !== 'number' || Math.abs(v) > 1.001) return null; // fora do repouso do hat
  return HAT_STEPS.find(([hv]) => Math.abs(v - hv) <= 0.09) ?? null;
}

/** Um passo do hat ACENDE direções e nunca as apaga — é o que deixa o stick e o D-pad vivos ao mesmo tempo. */
function applyHatStep(d: Dirs, step: readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1]): void {
  const [, up, down, left, right] = step;
  if (up) d.up = true;
  if (down) d.down = true;
  if (left) d.left = true;
  if (right) d.right = true;
}

/** Direções pelas FONTES PADRÃO: stick 0/1 (zona morta PAD_DEAD), D-pad 12-15, e o "hat" nos eixos >=6 (POV do
 *  DirectInput). Controles com os dois direcionais mapeados ficam com ambos vivos (dedo no stick não mata o D-pad). */
export function stdDirs(gp: PadLike): Dirs {
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const ax = (i: number): number => gp.axes[i] || 0;
  const d: Dirs = { left: ax(0) < -PAD_DEAD || b(14), right: ax(0) > PAD_DEAD || b(15), up: ax(1) < -PAD_DEAD || b(12), down: ax(1) > PAD_DEAD || b(13) };
  for (let i = 6; i < gp.axes.length; i++) {
    const step = hatStepAt(gp.axes[i]);
    if (step) applyHatStep(d, step);
  }
  return d;
}

/** Está o binding `bd` ativo agora neste gamepad? Digital = pressed; analógico ({ax,s}) = limiar por sinal
 *  (metade do curso); hat ({av,v}) = valor exato do passo (±0.13 — os 8 passos distam ~0.286). */
export function bindActive(gp: PadLike, bd: PadBinding | null | undefined): boolean {
  if (!bd) return false;
  if (bd.b != null) return !!(gp.buttons[bd.b] && gp.buttons[bd.b]!.pressed);
  if (bd.ax != null) return ((gp.axes[bd.ax] || 0) * (bd.s ?? 0)) > 0.5;
  if (bd.av != null) return Math.abs((gp.axes[bd.av] || 0) - (bd.v ?? 0)) <= 0.13;
  return false;
}

/** O retrato quando a CRIANÇA gravou um mapa no assistente: as direções dela caem de volta no padrão quando o
 *  binding não está ativo, para o D-pad e o stick continuarem vivos ao lado do que ela escolheu. */
function actionsFromTheSavedMap(gp: PadLike, custom: PadMap): PadActions {
  const A = (k: string): boolean => bindActive(gp, bindingAt(custom, k));
  const sd = stdDirs(gp);
  return {
    left: A('left') || sd.left, right: A('right') || sd.right, up: A('up') || sd.up, down: A('down') || sd.down,
    action2: A('action2'), action1: A('action1'), action4: A('action4'), action3: A('action3'), _start: A('action2') || A('start'), _pause: A('start'),
  };
}

/**
 * O retrato pela TABELA declarada — a fábrica da engine com o padrão deste jogo por cima (ADR-0115), resolvida em
 * `input/pad-defaults`.
 *
 * ⚠️ OS ÍNDICES SAEM DA TABELA, e não de literais aqui. Enquanto eram literais, esta linha e
 * `input/default-bindings` DISCORDAVAM e nada notava — a mesma forma de defeito que o gate do toque apanhou: duas
 * tabelas que concordam entre si não provam nada sobre um terceiro que as lê.
 *
 * ⚠️ E A DISCORDÂNCIA ERA REAL: aqui estava `action1: b(2) || b(5) || b(7)`, ou seja X, R1 e R2 todos a correr,
 * enquanto a tabela declara R1 como `rightShoulder` e R2 como `rightTrigger`. O ADR-0086 registrou esta mudança
 * como o asterisco do seu «zero movimento»: nenhum VERBO muda de botão, mas `run` perde dois dos seus três.
 */
function actionsFromTheTable(gp: PadLike, table: PadTable): PadActions {
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const sd = stdDirs(gp);
  const at = (a: Action): boolean => { const i = table[a]; return typeof i === 'number' ? b(i) : false; };
  return {
    left: sd.left, right: sd.right, up: sd.up, down: sd.down,
    action1: at('action1'), action2: at('action2'), action3: at('action3'), action4: at('action4'),
    leftShoulder: at('leftShoulder'), leftTrigger: at('leftTrigger'),
    rightShoulder: at('rightShoulder'), rightTrigger: at('rightTrigger'),
    // ⚠️ `start` COMO POSIÇÃO, e não só como os derivados abaixo. Faltava, e o gate da tabela foi quem
    // o encontrou: quem quisesse saber «o START está apertado?» tinha de ler `_start`, que começa por
    // underscore e quer dizer outra coisa (fecha diálogo, e aceita a ação 2 também).
    start: at('start'), select: at('select'),
    // `_start` e `_pause` são DERIVADOS e não posições: «fecha diálogo» aceita a ação 2 ou o START, «pausa»
    // só o START. Ficam escritos aqui porque descrevem o que a raiz faz com duas posições, não uma terceira.
    _start: at('action2') || at('start'), _pause: at('start'),
  };
}

/** Ações do frame para este gamepad. `custom` = mapa salvo pelo assistente para este `gp.id` (null/`_skip` = a
 *  tabela declarada). ⚠️ A tabela só decide no segundo ramo, que é o certo: o padrão de um jogo não se sobrepõe
 *  a uma escolha que a criança gravou. */
export function padActions(gp: PadLike, custom: PadMap | null, table: PadTable = GAMEPAD_STANDARD): PadActions {
  return custom && !custom._skip ? actionsFromTheSavedMap(gp, custom) : actionsFromTheTable(gp, table);
}

/**
 * AS POSIÇÕES QUE O MODO DE UM BOTÃO NÃO CORTA. Pausar é a SAÍDA, não uma jogada.
 *
 * ⚠️ Cortar o START prenderia a criança dentro da partida — é o mesmo raciocínio que põe «a saída
 * primeiro» no ADR-0044 e que fez a armadilha de foco existir no ADR-0090. Uma acomodação que tranca não
 * é acomodação. Os derivados (`_start`, `_pause`) também passam: eles descrevem o que a raiz faz com
 * estas duas posições, não uma terceira.
 */
const OUTSIDE_CUT = new Set(['start', 'select', '_start', '_pause']);

/**
 * O MODO DE UM BOTÃO, APLICADO AO CONTROLE — a metade que faltava da empatia motora (issue #120).
 *
 * ⚠️ ELE VALIA SÓ NO TECLADO. `input/keydown` solta todas as outras teclas de jogo quando uma nova chega com o
 * modo ligado; `pollPads` não tinha equivalente nenhum. Uma criança que ligasse o modo e tivesse um controle na
 * mão **não estava no modo** — sem erro, sem aviso, sem sintoma, porque as definições continuavam a dizer que
 * estava ligado.
 *
 * ⚠️ AS DIREÇÕES CONTAM, e é isso que torna a regra fiel ao teclado: lá, `isGameKeyCode` inclui as teclas
 * de `p.ctrl`, que são as quatro direções — andar e pular não coexistem. Um filtro que poupasse as
 * direções seria mais confortável e estaria a simular outra deficiência.
 *
 * ⚠️ E A ESCOLHA DE QUEM SOBREVIVE É DIFERENTE DA DO TECLADO, POR NECESSIDADE. No teclado a chegada nova
 * ganha, porque HÁ uma chegada: o evento diz qual é. Um controle é lido por SONDAGEM — o que chega é um
 * retrato, sem ordem. Então mantém-se a que já valia, e só quando ela solta é que a próxima assume. É o
 * que impede o botão de correr de ser cortado porque o polegar encostou noutro, e é a mesma leitura de
 * «segurar» que o ADR-0077 dá.
 *
 * A POLÍTICA é a mesma do `keydown`; a IMPLEMENTAÇÃO não pode ser partilhada hoje porque as formas do
 * estado diferem — lá é um `Set` de códigos de tecla, aqui é um retrato de booleanos por posição.
 */
export function oneButtonAtOnce(
  // ⚠️ O QUADRO ANTERIOR É TIPADO PELO QUE ESTA FUNÇÃO LÊ, e não por `PadActions`: o `padPrevAct[gi]` do laço é
  // `PadState`, mais frouxo, e exigir a forma completa obrigaria o chamador a um molde que não descreve o
  // que se passa aqui — só se pergunta «esta chave estava em baixo?».
  wasDown: Readonly<Record<string, boolean | undefined>>,
  reading: PadActions,
  on: boolean,
): PadActions {
  if (!on) return reading;
  const cuttable = Object.keys(reading).filter((k) => !OUTSIDE_CUT.has(k));
  const active = cuttable.filter((k) => reading[k] === true);
  if (active.length <= 1) return reading;
  // A que já valia tem prioridade; sem nenhuma, a primeira do retrato assume.
  const kept = active.find((k) => wasDown[k] === true) ?? active[0];
  const onlyOne: PadActions = { ...reading };
  for (const k of active) if (k !== kept) onlyOne[k] = false;
  return onlyOne;
}
