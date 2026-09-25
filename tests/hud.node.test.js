// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/hud (NODE project: only the PURE half, no `document`). Contract: the screen GRID
// (screenGrid/screenRect/screenCount), the static MARKUP (vphudHtml/waitBadgeHtml) and the PROJECTION of one player's HUD
// (hudRowView) are value functions — they depend on no DOM and no global state. The shell
// (initHud/buildGameHud/updateGameHud/…) is in tests/hud.browser.test.js.
// ZOMBIES + Right-BICEP. See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import {
  screenGrid, screenRect, screenCount, vphudHtml, waitBadgeHtml, hudRowView, counterLabel, applyCounterLabel,
} from '../app/js/ui/hud.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

// No game constant here (item 19): the fixture DECLARES an objective, field 5 of the contract. A test that needed a
// game's constant would be saying the module needs it too.
// The DEFAULT name is 'itens', not the platformer's. A HUD test that said "moedas" on every line would assert, out of
// habit, what item 19 took out of the module — and the fixtures gate (engine-boundary) fails exactly that. The examples
// below vary the name on purpose.
const OBJ = (have, need, nome = 'itens', gender = 'm') =>
  ({ name: { text: nome, gender, plural: have !== 1 }, have, need });
const ICONE = '🪙';

const pct = (s) => Number.parseFloat(s); // '50%' -> 50 (the functions return CSS strings)

// A FAKE power table — deliberately different from any real one: hudRowView must read the INJECTED resolver, not an
// internal copy.
// `powerShort`/`POWER_MSG` are FUNCTIONS (item 14), so they follow the current language. The fixture is still a table —
// it reads best in a test — and becomes a function at injection, which also proves the module indexes nothing: it ASKS.
const POWERS_TAB = { off: '—', superjump: '🐇 Super-pulo', fly: '🎈 Voo' };
const POWERS = (k) => POWERS_TAB[k] || '—';

// ---------------------------------------------------------------------------------------------
// screenGrid — columns/rows of the screen grid
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenGrid', () => {
  it('[Zero] sem jogadores ainda, a grade já é 1×1 (o boot monta uma tela antes de players[] existir)', () => {
    expect(screenGrid(0)).toEqual({ cols: 1, rows: 1 });
  });

  it('[One] solo: uma coluna, uma linha', () => {
    expect(screenGrid(1)).toEqual({ cols: 1, rows: 1 });
  });

  it('[Many] 2 = lado a lado; 3 e 4 = 2×2', () => {
    expect(screenGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(screenGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(screenGrid(4)).toEqual({ cols: 2, rows: 2 });
  });

  it('[Cross-check] de 1 a 4 jogadores a grade sempre comporta todas as telas (cols×rows ≥ n)', () => {
    for (let n = 1; n <= 4; n++) {
      const { cols, rows } = screenGrid(n);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
    }
  });

  it('[Boundary] 4 é o teto do jogo: a grade nunca passa de 2×2', () => {
    const { cols, rows } = screenGrid(4);
    expect(cols).toBe(2);
    expect(rows).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// screenRect — each screen's rectangle (in %)
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenRect', () => {
  it('[One] solo ocupa a tela inteira', () => {
    expect(screenRect(0, 1)).toEqual({ L: '0%', T: '0%', W: '100%', H: '100%' });
  });

  it('[Many] 2 jogadores: metades esquerda e direita, altura cheia', () => {
    expect(screenRect(0, 2)).toEqual({ L: '0%', T: '0%', W: '50%', H: '100%' });
    expect(screenRect(1, 2)).toEqual({ L: '50%', T: '0%', W: '50%', H: '100%' });
  });

  it('[Many] 4 jogadores: os quatro quadrantes', () => {
    expect(screenRect(0, 4)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 4)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 4)).toEqual({ L: '0%', T: '50%', W: '50%', H: '50%' });
    expect(screenRect(3, 4)).toEqual({ L: '50%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Boundary] 3 jogadores: a 3ª tela é CENTRALIZADA na linha de baixo (25%), não colada à esquerda', () => {
    expect(screenRect(0, 3)).toEqual({ L: '0%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(1, 3)).toEqual({ L: '50%', T: '0%', W: '50%', H: '50%' });
    expect(screenRect(2, 3)).toEqual({ L: '25%', T: '50%', W: '50%', H: '50%' });
  });

  it('[Cross-check] com 1, 2 e 4 telas a grade cobre 100% da área, sem sobra nem sobreposição', () => {
    for (const n of [1, 2, 4]) {
      let area = 0;
      for (let i = 0; i < n; i++) { const r = screenRect(i, n); area += pct(r.W) * pct(r.H); }
      expect(area).toBe(100 * 100);
    }
  });

  it('[Cross-check] com 3 telas sobra metade da linha de baixo — a área coberta é 3/4 da tela', () => {
    let area = 0;
    for (let i = 0; i < 3; i++) { const r = screenRect(i, 3); area += pct(r.W) * pct(r.H); }
    expect(area).toBe(0.75 * 100 * 100);
  });

  it('[Cross-check] nenhuma tela transborda a área visível (L+W ≤ 100 e T+H ≤ 100) em 1..4 jogadores', () => {
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < n; i++) {
        const r = screenRect(i, n);
        expect(pct(r.L) + pct(r.W)).toBeLessThanOrEqual(100);
        expect(pct(r.T) + pct(r.H)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('[Interface] os quatro campos saem prontos para o CSS (sufixo %)', () => {
    const r = screenRect(2, 4);
    for (const v of [r.L, r.T, r.W, r.H]) expect(v.endsWith('%')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// screenCount — quantas telas montar
// ---------------------------------------------------------------------------------------------

describe('ui/hud · screenCount', () => {
  it('[Zero] com 0 jogadores ainda monta 1 tela (buildGameHud roda no boot, antes de players[])', () => {
    expect(screenCount(0)).toBe(1);
  });

  it('[One/Many] a partir de 1 jogador é uma tela por jogador', () => {
    expect(screenCount(1)).toBe(1);
    expect(screenCount(4)).toBe(4);
  });

  it('[Error] valor negativo não gera laço vazio: continua sendo 1 tela', () => {
    expect(screenCount(-3)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// vphudHtml — markup do contador (moedas + poder)
// ---------------------------------------------------------------------------------------------

describe('ui/hud · vphudHtml', () => {
  it('[Interface] o objetivo INTEIRO entra: numerador e denominador saem dele, não de constante nenhuma', () => {
    // An `Objective` comes in, and the HUD does not know WHAT is being gathered — not a default constant put where a
    // boundary belongs (ADR-0027, step 4).
    expect(vphudHtml(OBJ(0, 10), ICONE)).toContain('/ 10');
    expect(vphudHtml(OBJ(4, 10), ICONE)).toContain('>4</b>');
    expect(vphudHtml(OBJ(0, 3), ICONE)).toContain('/ 3');
  });

  it('[Interface] o ÍCONE é injetado — a engine não desenha mais a moeda no markup', () => {
    // The case that holds the half that was only vocabulary. A hard-coded icon would pass everything above.
    expect(vphudHtml(OBJ(0, 10), '🧩')).toContain('>🧩<');
    expect(vphudHtml(OBJ(0, 10), '🧩')).not.toContain(ICONE);
  });

  it('[Right] o contador tem NOME ACESSÍVEL — e ele deixou de vir por MARKUP (issue #106)', () => {
    // A counter of just "3 / 10" gives someone who cannot see the screen nothing to hear. The name comes from
    // `Objective.name`, declared by the GAME — and a game lives in another repository (ADR-0083), so its text is not
    // reviewed by this tree.
    //
    // ⚠️ AND IN MARKUP IT WOULD GO INTO AN ATTRIBUTE, the worst context: inside an element a quote is harmless; inside
    // `aria-label="…"` it CLOSES the attribute and the rest becomes attributes — an `onmouseover` without a single tag.
    // `setAttribute` escapes by construction.
    const posto = [];
    const alvo = { setAttribute: (k, v) => posto.push([k, v]) };
    const raiz = { querySelector: (sel) => (sel === '.vphud-obj' ? alvo : null) };

    applyCounterLabel(translate, raiz, OBJ(3, 10, 'palavras'));
    expect(posto).toHaveLength(1);
    expect(posto[0][0]).toBe('aria-label');
    expect(posto[0][1]).toContain('palavras');
  });

  it('[Zero] ⚠️ e o markup NÃO carrega mais o nome do jogo — nem escapado', () => {
    // The negative half, the one that prevents the return: while the name stays out of the string, there is no escape to
    // forget. A case asserting only `setAttribute` would let through a version doing both.
    const html = vphudHtml(OBJ(3, 10, 'palavras'), ICONE);
    expect(html).not.toContain('palavras');
    expect(html).not.toContain('aria-label');
  });

  it('[Error] ⚠️ um jogo que devolve um NÃO-NÚMERO em `have` não escreve markup', () => {
    // `Objective.have` is `number` in the type, and the type does not cross the package boundary: a game in plain
    // JavaScript returns whatever it likes. «É um número» being written in the type is exactly what makes one forget.
    const html = vphudHtml({ ...OBJ(0, 10), have: '<img src=x onerror=alert(1)>' }, ICONE);
    expect(html).not.toContain('<img');
    expect(html).toContain('<b class="vphud-n">0</b>'); // falso, mas inofensivo
  });

  it('[Zero] sem o elemento do contador, aplicar o rótulo não lança', () => {
    expect(() => applyCounterLabel(translate, null, OBJ(1, 2))).not.toThrow();
    expect(() => applyCounterLabel(translate, { querySelector: () => null }, OBJ(1, 2))).not.toThrow();
  });

  it('[Interface] a classe do contador é a do OBJETIVO, não a do que este jogo junta', () => {
    // A NEGATIVE assertion ("does not contain the old class") would have to write the word the module dropped — and the
    // fixtures gate rightly flags it. The protection against the old name coming back lives where it must: in
    // `engine-boundary`, which fails ANY code line of `ui/hud` that talks about coins. Here the positive assertion is
    // enough.
    expect(vphudHtml(OBJ(0, 10), ICONE)).toContain('class="vphud-obj"');
  });

  it('[Right] o HUD nasce com o `have` declarado e sem poder', () => {
    const html = vphudHtml(OBJ(0, 10), ICONE);
    expect(html).toContain('<b class="vphud-n">0</b>');
    expect(html).toContain('<span class="vphud-pw">—</span>');
  });

  it('[Interface] carrega os TRÊS ganchos que updateGameHud consulta (.vphud-n, .vphud-pw e .vphud-obj)', () => {
    const html = vphudHtml(OBJ(0, 10), ICONE);
    expect(html).toContain('class="vphud-n"');
    expect(html).toContain('class="vphud-pw"');
    expect(html).toContain('class="vphud-obj"');
  });
});

describe('ui/hud · contadorLabel', () => {
  it('[Right] nomeia o que se junta, e o nome vem do JOGO — não de uma tabela da engine', () => {
    expect(counterLabel(translate, OBJ(3, 10, 'palavras'))).toContain('palavras');
    expect(counterLabel(translate, OBJ(3, 10, 'contas'))).toContain('contas');
    expect(counterLabel(translate, OBJ(3, 10, 'estrelas'))).toContain('estrelas');
  });

  it('[Right] os dois números aparecem', () => {
    const txt = counterLabel(translate, OBJ(3, 10));
    expect(txt).toContain('3');
    expect(txt).toContain('10');
  });

  it('[Zero] objetivo zerado ainda produz frase, e não "undefined de undefined"', () => {
    expect(counterLabel(translate, OBJ(0, 0, 'itens'))).toMatch(/0.*0.*itens/);
  });
});

// ---------------------------------------------------------------------------------------------
// waitBadgeHtml — the "press a button to join" badge
// ---------------------------------------------------------------------------------------------

describe('ui/hud · waitBadgeHtml', () => {
  it('[One] o índice é 0-based mas o texto fala com o jogador em 1-based', () => {
    expect(waitBadgeHtml(translate, 0)).toContain('Jogador 1:');
    expect(waitBadgeHtml(translate, 3)).toContain('Jogador 4:');
  });

  it('[Interface] carrega a classe .vp-wait, que é por onde clearWaitingBadge acha e remove o selo', () => {
    expect(waitBadgeHtml(translate, 1)).toContain('class="vphud-quit vp-wait"');
  });

  it('[Right] o convite nomeia as DUAS entradas possíveis (teclado próprio ou controle livre)', () => {
    const html = waitBadgeHtml(translate, 1);
    expect(html).toContain('teclado');
    expect(html).toContain('controle livre');
  });

  it('🔴 o selo sai do DICIONÁRIO e não de um literal — e os três casos acima não distinguem os dois', async () => {
    /*
     * 🔴 THIS CASE EXISTS BECAUSE THE THREE ABOVE STAY GREEN WITH THE DEFECT BACK. The active dictionary here is pt,
     * and the key's sentence is the SAME a literal in the module would carry — so «contém Jogador 1» does not separate
     * «lê o dicionário» from «tem um literal em português». It is the trap of a gate covered only by golden values.
     *
     * 🎯 What separates the two is REPLACING the entry: a literal does not change, a key does. A translator's
     * `registerDict` writes the game's dictionary, which the resolver consults BEFORE the engine's (that is how a game
     * overrides any key, ADR-0083) — and it is a translator of this case's own, so nothing leaks to the others.
     */
    const { createTranslator: ownTranslator } = await import('../app/js/core/i18n.js');
    const pt = (await import('../app/js/i18n/pt.js')).default;
    expect(pt['hud.waitBadge'], 'a chave saiu do dicionário pt; o caso mediria o nada').toBeTruthy();

    const overridden = ownTranslator();
    overridden.registerDict('pt', { 'hud.waitBadge': 'ENTRADA TROCADA {n}' });
    const html = waitBadgeHtml(overridden.t, 2);
    expect(html, 'o selo ignorou o dicionário — o texto está colado no módulo').toContain('ENTRADA TROCADA 3');
    expect(html, 'o literal antigo continua lá').not.toContain('aperte um botão do SEU teclado');
    expect(waitBadgeHtml(translate, 0), 'the override leaked into another translator').toContain('Jogador 1:');
  });
});

// ---------------------------------------------------------------------------------------------
// hudRowView — the projection of ONE player's HUD
// ---------------------------------------------------------------------------------------------

describe('ui/hud · hudRowView', () => {
  it('[Zero] jogador recém-nascido: nada juntado, sem poder, sem selo de abandono, HUD visível', () => {
    const v = hudRowView(translate, { activePower: 'off', quit: false }, POWERS, OBJ(0, 10));
    expect(v.have).toBe('0');
    expect(v.power).toBe('—');
    expect(v.quitHidden).toBe(true);
    expect(v.visibility).toBe('visible');
    expect(v.label).toContain('itens');
  });

  it('[Interface] o PROGRESSO vem do objetivo, e não mais do jogador', () => {
    // The case that measures the boundary: the same player, two objectives, two counters. If the number came from
    // `p.collected`, the HUD would know players GATHER things — and a quiz game does not.
    const pl = { activePower: 'off', quit: false };
    expect(hudRowView(translate, pl, POWERS, OBJ(2, 10)).have).toBe('2');
    expect(hudRowView(translate, pl, POWERS, OBJ(9, 10)).have).toBe('9');
  });

  it('[Right] poder conhecido vira o rótulo curto da tabela injetada', () => {
    expect(hudRowView(translate, { activePower: 'fly', quit: false }, POWERS, OBJ(3, 10)).power).toBe('🎈 Voo');
  });

  it('[Interface] o resolvedor de poderes é INJETADO: o mesmo jogador rotula diferente com outro resolvedor', () => {
    const pl = { activePower: 'fly', quit: false };
    expect(hudRowView(translate, pl, POWERS, OBJ(3, 10)).power).toBe('🎈 Voo');
    expect(hudRowView(translate, pl, () => 'FLY', OBJ(3, 10)).power).toBe('FLY');
  });

  it('[Error] poder fora da tabela cai no travessão em vez de vazar a chave crua', () => {
    expect(hudRowView(translate, { activePower: 'jetpack', quit: false }, POWERS, OBJ(1, 10)).power).toBe('—');
  });

  it('[Boundary] resolvedor que devolve VAZIO ainda vira travessão (o HUD nunca fica em branco)', () => {
    // With the `|| '—'` in the injector, a resolver returning '' would leave the power field blank on screen. The guard
    // lives in `hudRowView`, where it does not depend on every future consumer remembering it.
    expect(hudRowView(translate, { activePower: 'fly', quit: false }, () => '', OBJ(1, 10)).power).toBe('—');
  });

  it('[Many] o contador NÃO é limitado ao alvo: passar de 10/10 mostra 12', () => {
    expect(hudRowView(translate, { activePower: 'off', quit: false }, POWERS, OBJ(12, 10)).have).toBe('12');
  });

  it('[Right] quem desistiu perde o contador (visibility hidden) e ganha o selo (hidden=false)', () => {
    const v = hudRowView(translate, { activePower: 'fly', quit: true }, POWERS, OBJ(5, 10));
    expect(v.have).toBe('5');
    expect(v.power).toBe('🎈 Voo');
    expect(v.quitHidden).toBe(false);
    expect(v.visibility).toBe('hidden');
  });

  it('[Cross-check] selo e contador são sempre opostos: quitHidden === (visibility === "visible")', () => {
    for (const quit of [false, true]) {
      const v = hudRowView(translate, { activePower: 'off', quit }, POWERS, OBJ(0, 10));
      expect(v.quitHidden).toBe(v.visibility === 'visible');
    }
  });

  it('[Exercise] projetar não mexe no jogador (o HUD é leitor, o loop de jogo é o dono do estado)', () => {
    const pl = { activePower: 'superjump', quit: false };
    const obj = OBJ(4, 10);
    hudRowView(translate, pl, POWERS, obj);
    expect(pl).toEqual({ activePower: 'superjump', quit: false });
    expect(obj).toEqual(OBJ(4, 10)); // nor the objective: projecting is READING
  });
});
