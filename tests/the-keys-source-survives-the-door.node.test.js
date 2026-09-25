// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KEY'S SOURCE IS NOT LOST AT THE DOOR — the EDGE half of ADR-0109, and the sieve it owes.
//
// ========================= THE ERASURE THIS EXISTS TO END =========================
// Issue #114 §C stayed unbuilt for two months for a measured reason: `input/state.keys` is a `Set<string>` of CODES,
// several transports wrote into it, and a synthetic `KeyboardEvent` looked like any other — by the time `held()`
// answered, there was no way to know WHO pressed. The question the latch asks («did this press come from a device with
// the latch?») had its answer thrown away before being asked.
//
// ⚠️ AND THE SIEVE IS AN INVENTORY, not a word search: «isto perdeu a origem» cannot be grepped. What is frozen is the
// list of who writes into the set WITHOUT going through the pair — and each entry says why that module does. It is that
// hand-written sentence that stops a new writer from coming in quietly.
//
// 📌 THE LIST IS AT ITS FLOOR: only the pair itself is on it, so the sieve asserts the whole absence (see below).
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInputState } from '../app/js/input/state.js';
const {
  keys, keySource, markKey, markKeyWithoutSource, releaseKey, releaseAllKeys, sourceOf, held,
} = createInputState();
import { stampSource, sourceOfEvent, SOURCE_KEY } from '../app/js/input/synthetic-source.js';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/** A direct write to the key set, under any of the names it travels by. */
const ESCREVE_CRU = /\b(?:heldKeys|keys)\.(?:add|delete|clear)\s*\(/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** CODE lines (a comment does not count) that touch the set without going through the pair. */
function escritasCruasDe(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && ESCREVE_CRU.test(ln)).length;
}

/**
 * WHO STILL WRITES RAW, and why.
 *
 * ⚠️ `input/state.ts` is here and STAYS: it is the pair.
 */
const POR_MIGRAR = {
  'input/state.ts': 'o PAR — é aqui que `marcarTecla`/`soltarTecla`/`soltarTodas` vivem, e é por isso que ele escreve',
};
// ✅ `input/touch-bindings.ts` left on 2026-09-08 (it stamps `toque`), and `input/keydown.ts` left the same day.
//
// 🎯 THE LIST IS AT THE FLOOR, and that changes what this sieve means: with only the pair in it, it ASSERTS THE WHOLE
// ABSENCE — no module of this engine writes into the key set without saying who pressed. It is the gate ADR-0109's
// `confirmation` owed, and what makes it worth it is what it prevents: the erasure coming back through a new writer
// nobody noticed coming in.
//
// ⚠️ `keydown` left by solving the hard point its own entry carried: a synthetic `KeyboardEvent` would be stamped
// `teclado`. The way out was `input/synthetic-source`: the stamp travels IN THE EVENT, and `isTrusted` answers for
// whoever did not stamp. See the cases further down.

describe('ADR-0109 · a origem da tecla viaja com ela', () => {
  beforeEach(() => { releaseAllKeys(); });

  it('[Right] marcar escreve NOS DOIS, e o `held` continua a ver a tecla', () => {
    markKey('KeyA', 'toque');
    expect(keys.has('KeyA')).toBe(true);
    expect(sourceOf('KeyA')).toBe('toque');
    expect(held({ ctrl: { jump: ['KeyA'] }, pad: -1 }, 'jump')).toBe(true);
  });

  it('⚠️ [Right] soltar limpa NOS DOIS — um mapa que sobrevive à tecla descreve quem já ninguém segura', () => {
    markKey('KeyA', 'toque');
    releaseKey('KeyA');
    expect(keys.has('KeyA')).toBe(false);
    expect(sourceOf('KeyA')).toBeUndefined();
    expect(keySource.size).toBe(0);
  });

  it('⚠️ [Zero] `soltarTodas` limpa os dois — é a rede do `blur`, e meia rede não é rede', () => {
    markKey('KeyA', 'toque');
    markKey('KeyB', 'teclado');
    releaseAllKeys();
    expect(keys.size).toBe(0);
    expect(keySource.size).toBe(0);
  });

  it('⚠️ [Zero] uma tecla de origem DESCONHECIDA responde `undefined`, e não um padrão', () => {
    // ⚠️ THIS IS THE CASE THAT STOPS THE ERASURE COMING BACK THROUGH ANOTHER DOOR. A `teclado` default would make a
    // TOUCH key — entered by an unmigrated writer — be read as keyboard: the latch would turn itself off and nothing
    // would say so. Not knowing is an answer; pretending to know is not.
    keys.add('KeyZ'); // the raw path, which is still reachable
    expect(keys.has('KeyZ')).toBe(true);
    expect(sourceOf('KeyZ')).toBeUndefined();
  });

  it('[Boundary] marcar duas vezes com origens diferentes fica com a ÚLTIMA', () => {
    // The key is the same, the device changed — and what matters is who holds it NOW.
    markKey('KeyA', 'teclado');
    markKey('KeyA', 'toque');
    expect(sourceOf('KeyA')).toBe('toque');
    expect(keys.size).toBe(1);
  });

  it('⚠️ [Interface] nenhum escritor CRU novo entrou sem ser declarado', () => {
    const crus = ficheirosTs()
      .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasCruasDe(p)])
      .filter(([, n]) => n > 0)
      .map(([m]) => m);
    const novos = crus.filter((m) => !(m in POR_MIGRAR));
    expect(
      novos,
      'módulo novo a escrever no conjunto de teclas SEM origem. Use `marcarTecla`/`soltarTecla` de '
      + '`input/state`; se ainda não puder, declare-o aqui dizendo que transporte ele vai carimbar — e é '
      + 'nessa frase que «não sei de onde vem» teria de ser escrito à mão em vez de entrar calado.',
    ).toEqual([]);
  });

  it('[Interface] a lista de POR_MIGRAR não tem órfãos — quem já migrou sai dela', () => {
    const crus = new Set(ficheirosTs()
      .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasCruasDe(p)])
      .filter(([, n]) => n > 0).map(([m]) => m));
    expect(Object.keys(POR_MIGRAR).filter((m) => !crus.has(m)), 'entrada de quem já não escreve cru').toEqual([]);
  });

  it('⚠️ [Interface] e o crivo continua VIVO: ele acha o PAR, que escreve cru por definição', () => {
    // Without this, a dead regex would leave the two cases above green for having nothing to examine.
    //
    // ⚠️ ANCHORED ON A NAME AND NOT ON A COUNT: with the list at the floor the count is 1, and `>= 1` would be an
    // assertion any file could satisfy. `input/state` is the only one that writes raw BY DESIGN — it is the pair —, so it
    // is the anchor that cannot disappear without someone noticing.
    const crus = new Set(ficheirosTs()
      .filter((p) => escritasCruasDe(p) > 0)
      .map((p) => relative(RAIZ, p).split('\\').join('/')));
    expect([...crus], 'a varredura não achou o par — a regex ou o caminho morreram').toContain('input/state.ts');
  });

  it('⚠️ [Zero] `marcarTeclaSemOrigem` APAGA a origem anterior, em vez de a deixar herdar', () => {
    // The defect this line prevents is costly and silent: the child plays by gaze, lets go of the key, and a synthetic
    // dispatch from outside repeats the same code. Without the `delete`, the latch would keep answering «olhos» about an
    // edge that is no longer hers. A map that keeps yesterday's right answer is worse than an empty one.
    markKey('KeyA', 'olhos');
    markKeyWithoutSource('KeyA');
    expect(keys.has('KeyA')).toBe(true);   // the key WORKS: not knowing who produced it does not invalidate it
    expect(sourceOf('KeyA')).toBeUndefined();
  });
});

// ========================= THE STAMP ON THE EVENT (input/synthetic-source) =========================
// ⚠️ A synthetic `KeyboardEvent` enters through `keydown` and would be stamped `teclado` — and rule 3 of ADR-0109 says that
// pressing a key gives the keyboard back WITHOUT the latch, so an assistive input dispatching keys (as the webcam once
// did) would turn off by itself the latch the child depends on, mid-game and with nothing on screen saying so.
describe('ADR-0109 · quem despachou este evento', () => {
  const ev = (over = {}) => ({ code: 'KeyA', ...over });

  it('[Right] um carimbo válido responde o transporte declarado', () => {
    expect(sourceOfEvent(stampSource(ev(), 'olhos'))).toBe('olhos');
  });

  it('[Right] sem carimbo, um evento DE CONFIANÇA é o teclado — a única inferência do módulo', () => {
    // `isTrusted` is the property a script cannot forge: it means the browser saw the person press.
    expect(sourceOfEvent(ev({ isTrusted: true }))).toBe('teclado');
  });

  it('⚠️ [Zero] sem carimbo e SEM confiança responde `undefined`, e não `teclado`', () => {
    // ⚠️ THIS IS WHERE THE ERASURE WOULD TRY TO COME BACK. A synthetic event nobody signed is outside code that did not
    // declare; answering `'teclado'` would be worse than the original erasure, because it would look like an answer.
    expect(sourceOfEvent(ev({ isTrusted: false }))).toBeUndefined();
    expect(sourceOfEvent(ev())).toBeUndefined(); // and the ABSENCE of `isTrusted` is not a `true` by default
  });

  it('⚠️ [Boundary] um carimbo INVÁLIDO não vira transporte fantasma', () => {
    // The value comes from an expando on an object this code did not build. Without `isTransportName`, a misspelt
    // `'olho'` would enter `keySource` and the latch would start deciding about a device that does not exist.
    const mau = ev({ isTrusted: true });
    mau[SOURCE_KEY] = 'olho';
    expect(sourceOfEvent(mau)).toBe('teclado'); // falls to the next rule, instead of accepting the rubbish
    const naoString = ev();
    naoString[SOURCE_KEY] = { inUse: 'olhos' };
    expect(sourceOfEvent(naoString)).toBeUndefined();
  });

  it('⚠️ [Boundary] o carimbo GANHA de `isTrusted` — declaração vence inferência', () => {
    // The order of the two lines is the rule. A REAL event someone remapped (a pedal, a sip-and-puff switch emitting real
    // keys) has to keep what whoever stamped took the trouble to declare.
    expect(sourceOfEvent(stampSource(ev({ isTrusted: true }), 'gestos'))).toBe('gestos');
  });

  it('⚠️ [Interface] NADA nesta engine despacha tecla sintética sem carimbar', () => {
    // The sieve that closes the door on the WRITER's side — the one above closes it on the reader's, and a door closed
    // on one side only is not closed. An inventory over the real tree, not over a fixture.
    const semCarimbo = [];
    for (const p of ficheirosTs()) {
      for (const ln of readFileSync(p, 'utf8').split(/\r?\n/)) {
        if (/^\s*(\/\/|\*|\/\*)/.test(ln)) continue;
        if (/new KeyboardEvent\s*\(/.test(ln) && !/stampSource\s*\(/.test(ln)) {
          semCarimbo.push(relative(RAIZ, p).split('\\').join('/'));
        }
      }
    }
    expect(
      semCarimbo,
      'despacho de tecla sintética sem declarar o transporte. Envolva em `carimbarOrigem(…, transporte)` de '
      + '`input/synthetic-source` — sem isso o evento chega ao `keydown` indistinguível de uma tecla premida.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e ESTE crivo também está vivo: a raiz ainda despacha a tecla de menu, e carimbada', () => {
    // The vacuum the other way round: here the danger is the regex dying and the case above passing for finding nothing. The webcam that used to
    // anchor this left with WebGazer (ADR-0214); the one synthetic key left is the menu key the pad and the controller hand to menus.
    const fonte = readFileSync(join(RAIZ, 'boot/create-game.ts'), 'utf8');
    expect(fonte, 'a raiz deixou de despachar a tecla de menu, ou o carimbo saiu').toMatch(/stampSource\([^\n]*KeyboardEvent/);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · `markKey` writing only to `keys` (without the map) -> fails "marcar escreve NOS DOIS". It is the silent divergence:
//     the game moves just the same and only the latch goes wrong.
//   · `releaseKey` not deleting from the map -> fails "soltar limpa NOS DOIS". The map would describe keys nobody holds
//     any more, and the source read would be that of a press that ended.
//   · `releaseAllKeys` not clearing the map -> fails the `blur` case. Half a life-cycle net is not a net.
//   · ⚠️ `sourceOf` returning `'teclado'` instead of `undefined` -> fails the UNKNOWN source case. It is the most dangerous
//     mutation of the six: it is the "reasonable" reading that brings the erasure back through another door.
//   · killing the `ESCREVE_CRU` regex -> TWO fail, and the one that matters is the VACUUM one: without it, the inventory
//     would pass for having nothing to examine.
//   · removing `input/keydown.ts` from `POR_MIGRAR` -> fails "escritor CRU novo". It is the realistic drift: the list
//     stops covering who writes, and the sieve starts looking at less than exists.
