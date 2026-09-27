// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LATCH FOLLOWS THE CONTROLLER — and switching controllers writes NOTHING (ADR-0113 clause 1, issue #127).
//
// ========================= WHAT THIS FILE ASSERTS, AND WHY IN SEQUENCES =========================
// «Trocar de controle troca a alternância» means nothing without having switched. It is the lesson the
// `input/transport-in-use` cases had already written: a case that calls a function once measures the function; what
// makes the child stumble is the ORDER. So the cases here are sequences — the same player, two devices.
//
// 🎯 AND THE MOST IMPORTANT PROPERTY IS NEGATIVE: the store COUNTS the writes, and the transport switch must add up to
// ZERO. A `sincronizar` that wrote the resolved value would erase, on the first edge, the choice the child made on the
// other controller — and would stay green in every positive case.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { applyLatch, syncLatch, BASE_DA_MARCHA } from '../app/js/input/latch-sync.js';
import { latchKey, legacyLatchKey } from '../app/js/input/latch-scope.js';

/** A fake store that COUNTS the writes — the count is what proves clause 1. */
function armazemFalso(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  return {
    get: (chave) => (chave in dados ? dados[chave] : null),
    set: (chave, valor) => { escritas.push(chave); dados[chave] = valor; },
    escritas,
  };
}

const jogador = () => ({ toggleMove: false, walkDir: 0 });
/** The factory default, and a game that holds nothing — the two defaults storage does not know (ADR-0249). */
const FABRICA = { byDefault: false, gameHoldsKeys: false };
const chave = (i, transporte) => latchKey(BASE_DA_MARCHA, i, transporte);
const legada = (i) => legacyLatchKey(BASE_DA_MARCHA, i);

describe('a alternância resolvida para o transporte em uso', () => {
  it('[Zero] nada guardado e sem legado: fica o padrão de fábrica, e ninguém escreve', () => {
    const a = armazemFalso();
    const p = jogador();
    expect(syncLatch(p, a, 0, 'teclado', FABRICA), 'não havia o que mudar').toBe(false);
    expect(p.toggleMove).toBe(false);
    expect(a.escritas, 'resolver não é gravar').toEqual([]);
  });

  it('🎯 [Sequência] o MESMO jogador com dois aparelhos recebe duas respostas — e o disco não é tocado', () => {
    const a = armazemFalso({ [chave(0, 'gamepad')]: '1', [chave(0, 'teclado')]: '0' });
    const p = jogador();

    expect(syncLatch(p, a, 0, 'gamepad', FABRICA), 'ligou ao pegar no controle').toBe(true);
    expect(p.toggleMove, 'o valor do GAMEPAD não chegou').toBe(true);

    expect(syncLatch(p, a, 0, 'teclado', FABRICA), 'a troca tinha de mudar a resposta').toBe(true);
    expect(p.toggleMove, 'o teclado herdou o estado do gamepad').toBe(false);

    expect(a.escritas, 'trocar de aparelho GRAVOU — a escolha do outro controle seria apagada').toEqual([]);
  });

  it('⚠️ [Boundary] o `false` guardado é um VALOR: não deixa o legado ligado passar por cima', () => {
    const a = armazemFalso({ [chave(0, 'teclado')]: '0', [legada(0)]: '1' });
    const p = jogador();
    syncLatch(p, a, 0, 'teclado', FABRICA);
    expect(p.toggleMove, 'o legado atropelou uma escolha explícita deste aparelho').toBe(false);
  });

  it('📌 a criança que já jogava não perde o ajuste: só o legado, e ele vale para o aparelho novo', () => {
    const a = armazemFalso({ [legada(0)]: '1' });
    const p = jogador();
    syncLatch(p, a, 0, 'gamepad', FABRICA);
    expect(p.toggleMove, 'o ajuste guardado antes da divisão desapareceu').toBe(true);
  });

  it('🔴 nos quatro de um comando, o jogo dá o padrão e o `false` guardado dela vence — ADR-0249', () => {
    for (const transporte of ['olhos', 'rosto', 'gestos', 'fala']) {
      const semNada = armazemFalso();
      const p = jogador();
      syncLatch(p, semNada, 0, transporte, { ...FABRICA, gameHoldsKeys: true });
      expect(p.toggleMove, `${transporte} não aderiu num jogo que segura`).toBe(true);
      syncLatch(p, semNada, 0, transporte, { ...FABRICA, gameHoldsKeys: false });
      expect(p.toggleMove, `${transporte} continuou a aderir quando o jogo deixou de segurar`).toBe(false);

      const desligou = armazemFalso({ [chave(0, transporte)]: '0', [legada(0)]: '1' });
      const q = jogador();
      syncLatch(q, desligou, 0, transporte, { ...FABRICA, gameHoldsKeys: true });
      expect(q.toggleMove, `${transporte}: o jogo passou por cima do «desligado» que ela guardou`).toBe(false);
      expect(desligou.escritas, 'resolver gravou').toEqual([]);
    }
  });

  it('[Muitos] jogadores diferentes não partilham a chave', () => {
    const a = armazemFalso({ [chave(0, 'teclado')]: '1', [chave(1, 'teclado')]: '0' });
    const p0 = jogador(); const p1 = jogador();
    syncLatch(p0, a, 0, 'teclado', FABRICA);
    syncLatch(p1, a, 1, 'teclado', FABRICA);
    expect([p0.toggleMove, p1.toggleMove]).toEqual([true, false]);
  });
});

describe('a regra que acompanha o desligar', () => {
  it('🔴 desligar PARA quem anda por travamento — senão a personagem anda sozinha, sem erro nenhum', () => {
    const p = { toggleMove: true, walkDir: -1 };
    expect(applyLatch(p, false)).toBe(true);
    expect(p.walkDir, 'a criança largou tudo e a personagem continuou a andar').toBe(0);
  });

  it('⚠️ LIGAR não mexe na direcção — zerá-la a cada aresta seria o defeito ao contrário, e mais frequente', () => {
    const p = { toggleMove: false, walkDir: 1 };
    applyLatch(p, true);
    expect(p.walkDir, 'ligar tirou a direcção a quem estava a andar').toBe(1);
  });

  it('[Um] a segunda chamada com o mesmo valor não muda nada, e diz que não mudou', () => {
    const p = { toggleMove: true, walkDir: 2 };
    expect(applyLatch(p, true), 'idempotência: quem anuncia por aresta repetiria a frase').toBe(false);
    expect(p.walkDir).toBe(2);
  });
});

// ============================================================================================
// WHAT MAKES THE CACHE A CACHE: ONE WRITER ONLY
// ============================================================================================
//
// 🎯 `p.toggleMove` is a DERIVED CACHE (issue #127) — the engine rewrites it on the edge, from the key of the transport
// in use, and the cartridge's physics loop reads it. That holds only while there is ONE writer. A second, in any module,
// makes the field drift from the source it claims to derive from — and the drift does not fail loudly: the child
// switches devices, the value does not follow, and nothing says so.
//
// ⚠️ A CEILING, NOT A FLOOR. This number cannot RISE. It can fall (if the field ever leaves), which is why the assertion
// is on the set and not the count: a new name must appear in the failure message so whoever reads it knows where it
// went.
//
// 📌 And it speaks only of the ENGINE. `game-platformer` writes `pl.toggleMove` in its own loop, which is legitimate and
// not measurable from here — the lesson of ADR-0121 is that this repository's CI cannot depend on another's state.
// What is asserted is what this tree controls.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'app', 'js');

/** ⚠️ Does NOT eat URLs: `(^|[^:])//` leaves `https://` alone. A naive comment-stripper has fooled this repository
 *  before, each time with an empty scan read as absence. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');

function ficheiros(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p)); continue; }
    if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

const escritores = () => ficheiros(RAIZ)
  .filter((f) => /\.toggleMove\s*=[^=]/.test(semComentarios(readFileSync(f, 'utf8'))))
  .map((f) => f.replace(RAIZ, '').replace(/\\/g, '/').replace(/^\//, ''))
  .sort();

describe('quem escreve a alternância no jogador', () => {
  it('🎯 [Interface] a engine tem UM escritor, e é o dono da regra', () => {
    expect(escritores(), 'escritor novo de `toggleMove`: a cache deixou de derivar da chave do transporte')
      .toEqual(['input/latch-sync.ts']);
  });

  it('📌 [Vácuo] a varredura ACHA o escritor que existe — senão ela aprovaria uma árvore vazia', () => {
    // Without this case, killing the regex leaves the [Interface] comparing `[]` with `[]` and the gate blind forever.
    // It is the EXIT half, which is what separates an inventory from a monument.
    expect(escritores().length, 'a varredura não acha nada — está cega, e não é a árvore que está limpa')
      .toBeGreaterThan(0);
  });
});

// ================================ MUTATIONS CHECKED ================================
// (2026-09-27, ADR-0249) the rule answering `true` on the four again → 🔴 «nos quatro de um comando…», on the quiz half.
// 1. `syncLatch` writing the resolved value (`armazem.set(...)`) → 🎯 the [Sequência] fails on the write count, and ONLY
//    on it: every value case would stay green. It is the mutation that separates «a alternância segue o controle» from
//    «a alternância segue o último controle e apaga os outros».
// 2. ignoring the `transporte` argument (fixing `'teclado'`) → the [Sequência] fails on the second assertion.
// 3. removing `if (!ligada) p.walkDir = 0` → the turning-off case fails, with the defect's sentence written.
// 4. an unconditional `p.walkDir = 0` → the TURNING-ON case fails. The two mutations together are why the line is
//    conditional, and neither alone showed it.
// 5. `readTriState` collapsing «nunca escrito» into `false` (the `getBool` `latch-store` refuses) → the LEGACY case
//    fails: the child who already played loses the setting on the first start after the update.
