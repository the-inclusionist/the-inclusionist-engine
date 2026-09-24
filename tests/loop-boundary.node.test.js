// SPDX-License-Identifier: AGPL-3.0-or-later
// O LAÇO DE QUADRO PRECISA FALHAR ALTO — um jogo que lança não pode virar tela congelada e silêncio.
//
// ========================= O DEFEITO QUE ISTO FECHA =========================
// `startLoop` registra a função de quadro no ticker e nunca mais olha para ela. Se ela lançar, ela lança OUTRA
// VEZ no quadro seguinte, e no seguinte, para sempre: a tela congela, o console enche, e nada na tela diz o que
// aconteceu.
//
// É a D16 do spec do `demos`, e a razão de lá é de escala: "across 383 games, one bad game has to be
// distinguishable from a broken engine". A razão daqui é outra e é mais urgente — **criança cega não vê tela
// congelada**. Sem anúncio, o modo cego não distingue "o jogo travou" de "o jogo está pensando", e a única
// informação que ela tem é o silêncio.
//
// ========================= FALHAR ALTO, E NÃO FALHAR QUIETO =========================
// A tentação é `try { frame() } catch { /* segue */ }`, e ela é pior que o defeito: transforma queda dura em
// jogo silenciosamente errado, que roda para sempre computando lixo. A regra aqui é a mesma que o ADR-0047
// aplicou ao CRT: pega UMA vez, PARA, e ANUNCIA.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { startLoop, registerCrashNotice } from '../app/js/core/loop.js';

/** Um ticker mínimo com a forma que `startLoop` pede, e com `remove` para provar que o laço se desregistra. */
function fakeTicker(deltaTime = 1) {
  const fns = [];
  return {
    deltaTime,
    add: (fn) => fns.push(fn),
    remove: (fn) => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); },
    /** Roda um quadro. Devolve quantas funções ainda estão registradas. */
    tick() { [...fns].forEach((f) => f()); return fns.length; },
    get inscritas() { return fns.length; },
  };
}

describe('core/loop · o laço para e anuncia quando o quadro lança', () => {
  it('[Right] sem exceção, nada muda — o quadro roda a cada tick, com o dt clampado', () => {
    const t = fakeTicker(5);
    const dts = [];
    startLoop(t, (dt) => dts.push(dt), 2);
    t.tick(); t.tick();
    expect(dts, 'dt clampado em maxDt').toEqual([2, 2]);
  });

  it('[Right] quando o quadro lança, o laço PARA de chamá-lo', () => {
    const t = fakeTicker();
    let chamadas = 0;
    startLoop(t, () => { chamadas++; throw new Error('jogo quebrou'); }, 2, { onFailure: () => {} });
    t.tick();
    t.tick();
    t.tick();
    expect(chamadas, 'chamou uma vez e nunca mais').toBe(1);
  });

  it('[Right] e ANUNCIA, com o erro, uma vez só', () => {
    // O anúncio é o ponto: é o único canal de quem não vê a tela congelar.
    const t = fakeTicker();
    const falhas = [];
    const boom = new Error('jogo quebrou');
    startLoop(t, () => { throw boom; }, 2, { onFailure: (e) => falhas.push(e) });
    t.tick(); t.tick();
    expect(falhas).toEqual([boom]);
  });

  it('[Boundary] o laço se DESREGISTRA do ticker, não fica rodando um no-op', () => {
    // Diferença que importa em hardware fraco: um callback que roda 60 vezes por segundo para não fazer nada
    // ainda custa. E deixa o ticker mentindo sobre quantas coisas o jogo tem.
    const t = fakeTicker();
    startLoop(t, () => { throw new Error('x'); }, 2, { onFailure: () => {} });
    expect(t.inscritas).toBe(1);
    t.tick();
    expect(t.inscritas, 'saiu do ticker').toBe(0);
  });

  it('[Boundary] ticker SEM `remove` também para — degrada, não quebra', () => {
    // O tipo pede só `add` e `deltaTime`. Um ticker sem `remove` não pode desregistrar, mas ainda assim não
    // pode chamar o quadro de novo.
    const fns = [];
    const t = { deltaTime: 1, add: (fn) => fns.push(fn) };
    let chamadas = 0;
    startLoop(t, () => { chamadas++; throw new Error('x'); }, 2, { onFailure: () => {} });
    fns[0](); fns[0](); fns[0]();
    expect(chamadas).toBe(1);
  });

  it('[Zero] sem `onFailure`, o laço ainda para — o anúncio é opcional, parar não é', () => {
    const t = fakeTicker();
    let chamadas = 0;
    expect(() => {
      startLoop(t, () => { chamadas++; throw new Error('x'); }, 2);
      t.tick(); t.tick();
    }, 'a exceção não pode escapar para o ticker').not.toThrow();
    expect(chamadas).toBe(1);
  });

  // STUDY ITEM D1 (ADR-0054). 📏 Measured on 2026-09-13: `game-soccer` calls `startLoop` WITHOUT `onFailure`, so a frame
  // that throws there stops in silence — the announcement depended on each game remembering. The root registers its own.
  it('🔴 [Right] a loop started without `onFailure` announces through the one the root REGISTERED', () => {
    const t = fakeTicker();
    const erros = [];
    registerCrashNotice((e) => erros.push(e));
    try {
      startLoop(t, () => { throw new Error('quadro'); }, 2);
      t.tick(); t.tick();
    } finally { registerCrashNotice(null); }
    expect(erros.map((e) => e.message), 'the registered notice was not called exactly once').toEqual(['quadro']);
  });

  it('🎯 [Right] a game\'s own `onFailure` wins over the registered one — the engine\'s is a default', () => {
    const t = fakeTicker();
    const doRegisto = [];
    const doJogo = [];
    registerCrashNotice((e) => doRegisto.push(e));
    try {
      startLoop(t, () => { throw new Error('x'); }, 2, { onFailure: (e) => doJogo.push(e) });
      t.tick();
    } finally { registerCrashNotice(null); }
    expect([doJogo.length, doRegisto.length]).toEqual([1, 0]);
  });

  it('🎯 [Zero] with the registration withdrawn, nothing is called — and the loop still stops', () => {
    const t = fakeTicker();
    const erros = [];
    registerCrashNotice((e) => erros.push(e));
    registerCrashNotice(null);
    startLoop(t, () => { throw new Error('x'); }, 2);
    t.tick();
    expect(erros).toEqual([]);
    expect(t.inscritas).toBe(0);
  });

  it('[Interface] o que `onFailure` lançar não pode ressuscitar o problema', () => {
    // Se o próprio anúncio quebrar (o leitor de tela não existe, o DOM sumiu), isso não pode virar exceção
    // dentro do ticker — que é onde ela seria invisível outra vez.
    const t = fakeTicker();
    expect(() => {
      startLoop(t, () => { throw new Error('x'); }, 2, { onFailure: () => { throw new Error('o anúncio também'); } });
      t.tick();
    }).not.toThrow();
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o `parado = true` (só chamando `remove`) → "[Boundary] ticker SEM `remove`" reprova, e o efeito
//     real é o laço continuar chamando o quadro quebrado em qualquer ticker que não saiba remover.
//   · trocando o `catch` por `catch { /* segue */ }` sem parar → "[Right] o laço PARA" reprova, e o efeito real
//     é o pior dos dois mundos: jogo rodando para sempre computando lixo, sem ninguém saber.
//   · chamando `onFailure` a cada quadro em vez de uma vez → "[Right] e ANUNCIA... uma vez só" reprova, e o
//     efeito real é o leitor de tela repetindo a mesma frase 60 vezes por segundo.
