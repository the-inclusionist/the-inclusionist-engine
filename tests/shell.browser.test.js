// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/shell — the DOM SHELL (BROWSER project): real focus (document.activeElement), the `dataset` of
// `#touch-controls`, the innerHTML of the title legend and the two CAPTURE listeners of Print mode. The pure projection
// (`phaseView`, `touchControlsPlan`, the chips) is in shell.node.test.js and is NOT repeated here.
//
// `numPlayers`/`players` come from the file's local round double; the rest of the ctx is fake (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // the legend comes from the dictionary (item 14)
import { initShell } from '../app/js/ui/shell.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
// THE SCENE BELONGS TO THE TEST: the phase is not in `core/state` — it is the `core/scenes` stack, and the three names
// live in the composition root (ADR-0030 C3). What is engine receives BOOLEANS. This `let` plays the root's part, and
// the cases stay written as they were.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };
/** The current shell. `setPhase` below plays the ROOT's part: it swaps the scene and tells the shell to re-project. */
let shellAtual = null;
const setPhase = (p) => { faseFalsa = p; if (shellAtual) shellAtual.applyScene(); };
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0228): `core/run-state` went with the tile-world stack to `game-platformer`. This
 * file never tested the round — it HANDS one to what it measures —, and the three members below are exactly the ones it
 * reads. A factory and not a literal: two rounds have to be two objects.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// The round is local to this file (ADR-0038, phase B); the aliases below keep the cases' bodies written as they always were.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// Faithful to the page where the shell touches it: the splash, the retired global pause, the pause button, the touch
// controls, the canvas region and the per-screen pause menus (which the shell hides/shows, but does NOT build).
const MARKUP = `
  <div id="game-region" tabindex="-1">
    <div id="title-overlay" class="overlay">
      <div id="tm-main"><button id="tm-first" type="button">Jogar</button></div>
      <p id="title-wait" hidden>Aguarde o Jogador 1</p>
      <div class="title-legend" id="title-legend" aria-live="polite"></div>
    </div>
    <div id="pause-overlay" hidden></div>
    <div class="screen-pause" id="sp0" hidden><div class="pause-card">
      <div class="pause-menu" role="menu" data-sub="raiz">
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
        <button class="pm-btn" data-act="quit" type="button">Sair</button>
      </div>
      <div class="pause-menu" role="menu" data-sub="opcoes" hidden>
        <button class="pm-btn" data-act="caa" type="button">Comunicação</button>
      </div>
    </div></div>
    <div class="screen-pause" id="sp1" hidden><div class="pause-card">
      <div class="pause-menu" role="menu" data-sub="raiz">
        <button class="pm-btn" data-act="resume" type="button">Continuar</button>
      </div>
    </div></div>
  </div>
  <div id="touch-controls" hidden></div>
  <!-- O botão de pausa que EXISTE. O fixture declarava um id (btn-pause) que a produção nunca teve, e por
       isso o caso passava provando que o código escreve num botão que só o teste tem. Quem pausa por toque
       — e num tablet é o ÚNICO caminho, porque não há teclado — é o touch-start. -->
  <button id="touch-start" type="button" aria-label="Pausar ou iniciar (START)">START</button>
`;

function boot(over = {}) {
  document.body.innerHTML = MARKUP;
  setPhaseValue('title');
  setNumPlayersValue(1);
  players.length = 0;
  players.push({ i: 0, pad: -1 });

  const log = { muted: [], hidTouch: 0, reflect: 0, said: [], alerted: [], acts: [] };
  const listeners = { keydown: [], pointerdown: [] };
  let pending = null; // Print mode's 80ms setTimeout, fired by hand by the test

  const ctx = {
    t: translate,
    // The shell does not switch scenes: it PROJECTS the scene the root has already switched (ADR-0030 C3). The fake
    // plays the root — it keeps the phase and answers the three facts. The TRANSITION rules (pausing pushes, the title
    // does not toggle) belong to the root's scene stack, not to the shell.
    sceneFacts: () => ({ titleScreen: faseFalsa === 'title', worldRunning: faseFalsa === 'playing', pauseMenu: faseFalsa === 'paused' }),
    resumeGame: () => { setPhase('playing'); },
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $,
    win: {
      addEventListener: (t, fn) => listeners[t].push(fn),
      removeEventListener: (t, fn) => { listeners[t] = listeners[t].filter((f) => f !== fn); },
      setTimeout: (fn) => { pending = fn; },
    },
    setMasterMuted: (m) => log.muted.push(m),
    srSay: (m) => log.said.push(m),
    srAlert: (m) => log.alerted.push(m),
    getPauseScreens: () => $$('.screen-pause'),
    getPauseActor: () => 0,
    hideTouchControls: () => { log.hidTouch++; const tc = $('#touch-controls'); if (tc && !tc.hidden) tc.hidden = true; },
    reflectPauseIcons: () => { log.reflect++; },
    getGamepads: () => [],
    isTouchMode: () => false,
    padLayoutFromId: () => 'generic',
    padMapFor: () => null,
    kbFor: () => ({ up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action2: ['Space'], action3: ['KeyL'], action1: ['ShiftLeft'], action4: ['KeyQ'] }),
    keyName: (c) => 'K:' + c,
    // The SHORT word comes from the 'game' — in a test, the fixture. A position with no name does not become a chip.
    shortLabel: (a) => ({ action1: 'correr', action2: 'pular', action3: 'especial', action4: 'trocar' })[a] || null,
    openCaa: () => log.acts.push('caa'),
    setQuizLevel: (n, a) => log.acts.push('nivel:' + n + ':' + a),
    getQuizLevel: () => 5,
    openTypo: () => log.acts.push('typo'),
    openAudio: () => log.acts.push('audio'),
    openMovement: () => log.acts.push('movement'),
    openVisual: () => log.acts.push('visual'),
    openHelp: () => log.acts.push('help'),
    quitGame: () => log.acts.push('quit'),
    fitsN: () => true,
    joinPlayer: () => { players.push({ i: players.length, pad: -1 }); setNumPlayersValue(players.length); return true; },
    showWaitingBadge: (i) => log.acts.push('badge:' + i),
    setMobilityPlayer: (i) => log.acts.push('motor:' + i),
    setMotionPlayer: (i) => log.acts.push('motionPlayer:' + i),
    openMotion: () => log.acts.push('motion'),
    openEmpathy: () => log.acts.push('empathy'),
    setSelVizPlayer: (i) => log.acts.push('selViz:' + i),
    ...over,
  };
  const shell = initShell(ctx);
  shellAtual = shell;
  return { shell, log, listeners, flush: () => { const f = pending; pending = null; if (f) f(); } };
}

beforeEach(() => { document.body.innerHTML = ''; setPhaseValue('title'); setNumPlayersValue(1); });

describe('setPhase — a casca inteira, no documento', () => {
  it('"playing": splash some, pausas somem, som volta e o foco vai para a região do canvas', () => {
    const { shell, log } = boot();
    setPhase('playing');
    expect(faseFalsa).toBe('playing');
    expect($('#title-overlay').hidden).toBe(true);
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(false);
    expect(log.hidTouch).toBe(0);
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement.id).toBe('game-region');
  });

  it('"paused": TODAS as telas de pausa aparecem, o som cala, o toque some e os ícones se refletem', () => {
    const { shell, log } = boot();
    setPhase('playing');
    setPhase('paused');
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect(log.muted.at(-1)).toBe(true);
    expect(log.hidTouch).toBe(1);
    expect(log.reflect).toBe(1);
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('true');
  });

  // The case a dead line used to hide: the reflect aimed at `#btn-pause`, an id production never had, and a fixture
  // that invented the element made the test prove the code writes to a button only the test has. It aims at the real
  // button, which on a tablet is the ONLY way to pause (there is no keyboard).
  //
  // And on the TITLE the attribute is REMOVED instead of becoming `false`: there the button means "start", and
  // `aria-pressed` on a button that toggles nothing makes the screen reader announce a state that does not exist.
  //
  // MUTATION CHECKED: replacing `removeAttribute` with `setAttribute(..., 'false')` in `ui/shell`, this case fails with
  // "expected 'false' to be null".
  it('no TÍTULO o botão não tem aria-pressed — lá ele é "iniciar", não alterna nada', () => {
    boot();
    setPhase('playing');
    expect($('#touch-start').getAttribute('aria-pressed')).toBe('false');
    setPhase('title');
    expect($('#touch-start').getAttribute('aria-pressed')).toBe(null);
  });

  it('"paused" selecciona Continuar em CADA tela — ninguém fica sem cursor', () => {
    const { shell } = boot();
    setPhase('paused');
    for (const sp of $$('.screen-pause')) {
      const sel = sp.querySelectorAll('.pm-sel');
      expect(sel.length).toBe(1);
      expect(sel[0].dataset.act).toBe('resume');
    }
  });

  it('"title": o splash volta, a legenda é repintada e o foco vai para o 1º botão do menu', () => {
    const { shell } = boot();
    setPhase('playing');
    setPhase('title');
    expect($('#title-overlay').hidden).toBe(false);
    expect($('#title-legend').innerHTML).not.toBe('');
    expect(document.activeElement.id).toBe('tm-first');
  });

  it('⚠️ um `#pause-overlay` no documento é IGNORADO — a casca não o toca (2026-09-08)', () => {
    // What matters is that the shell does not know the element: a document may hold a VISIBLE `#pause-overlay` on
    // purpose, and the shell passes by it without touching it. It is the proof that the global pause left the engine
    // (retired in Step 2), and not that the shell hides it well.
    const { shell } = boot();
    const pa = $('#pause-overlay');
    pa.hidden = false;
    for (const p of ['playing', 'paused', 'title']) {
      setPhase(p);
      expect(pa.hidden, `a casca ainda mexe no #pause-overlay na fase ${p}`).toBe(false);
    }
  });

  // (`togglePause` is not the shell's. Toggling is not projecting: it is a decision about the STACK, and the stack
  //  belongs to the game — including the rule that it does nothing on the title.)
});

describe('setPhase e os controles de toque', () => {
  // The whole cycle, which is what the person does on a phone: playing with the on-screen d-pad, pause, resume. It
  // matters that the shell reads the state BEFORE `hideTouchControls()`: read after, the `wasOn` mark was never stored
  // and the d-pad did not come back — a defect that only showed on the device. This file's `boot()` has one screen,
  // which is the condition in which the virtual pad exists.
  it('[Right] pausar com o direcional visível guarda a marca, e retomar o devolve', () => {
    const { shell } = boot();
    setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = false; // as if the person were playing on touch
    setPhase('paused');
    expect(tc.hidden).toBe(true);              // in the pause it gets out of the way
    expect(tc.dataset.wasOn).toBe('1');        // but it is noted that it was on
    setPhase('playing');
    expect(tc.hidden).toBe(false);             // and it comes back on resume
    expect(tc.dataset.wasOn).toBe(undefined);  // the mark is consumed
  });

  it('[Inverse] quem NÃO estava com o direcional na tela não o ganha ao retomar', () => {
    const { shell } = boot();
    setPhase('playing');
    const tc = $('#touch-controls');
    tc.hidden = true; // jogando no teclado
    setPhase('paused');
    expect(tc.dataset.wasOn).toBe(undefined);
    setPhase('playing');
    expect(tc.hidden).toBe(true);              // stays hidden: pausing turns nobody's touch on
  });

  it('com a marca presente na mão, retomar em tela única devolve o direcional (o ramo existe)', () => {
    const { shell } = boot();
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    setPhase('playing');
    expect(tc.hidden).toBe(false);
    expect(tc.dataset.wasOn).toBe(undefined); // the mark is consumed
  });

  it('em multitela a marca é descartada sem devolver o direcional (o virtual é só de tela única)', () => {
    const { shell } = boot();
    setNumPlayersValue(2);
    const tc = $('#touch-controls');
    tc.dataset.wasOn = '1';
    setPhase('playing');
    expect(tc.hidden).toBe(true);
    expect(tc.dataset.wasOn).toBe(undefined);
  });
});

describe('updateTitleLegend — a legenda por dispositivo', () => {
  it('sem toque e sem controle, mostra as TECLAS CONFIGURADAS (o remap vale na legenda)', () => {
    const { shell } = boot();
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('K:KeyW');   // it came from kbFor, not from a literal
    expect(html).toContain('K:Space');
    expect(html).toContain(t('legend.move')); // from the dictionary, not from the code
    expect(html).not.toMatch(/legend\./);      // and the key never leaks onto the screen
    expect($('#title-legend').querySelectorAll('.lg-row').length).toBe(2);
  });

  it('em modo toque, mostra o joystick virtual (✜ + START) e os 4 botões genéricos', () => {
    const { shell } = boot({ isTouchMode: () => true });
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('✜');
    expect(html).toContain('START');
    expect(html).not.toContain('K:KeyW');
    expect(html, 'the touch legend lost the word for the d-pad (ADR-0232 D3: the t the shell is given)').toContain('movimentar-se');
    expect(html).not.toMatch(/legend\./);
  });

  it('com um gamepad no padrão, mostra os rótulos do MODELO', () => {
    const { shell } = boot({
      getGamepads: () => [{ index: 0, id: 'Xbox', mapping: 'standard' }],
      padLayoutFromId: () => 'microsoft',
    });
    shell.updateTitleLegend();
    const html = $('#title-legend').innerHTML;
    expect(html).toContain('#2fae4e'); // a cor do A no design microsoft
    expect(html).not.toContain('K:KeyW');
    expect(html, 'the pad legend lost the word for the d-pad (ADR-0232 D3: the t the shell is given)').toContain('movimentar-se');
    expect(html).not.toMatch(/legend\./);
  });

  it('o aviso "Aguarde o Jogador 1" só aparece em multitela', () => {
    const { shell } = boot();
    shell.updateTitleLegend();
    expect($('#title-wait').hidden).toBe(true);
    setNumPlayersValue(3);
    shell.updateTitleLegend();
    expect($('#title-wait').hidden).toBe(false);
  });
});

describe('printMode — ver a tela sem menus', () => {
  it('esconde TODAS as pausas, anuncia como voltar, e só arma os ouvintes depois do adiamento', () => {
    const { shell, log, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
    expect(log.said.at(-1)).toContain('Modo Print');
    // BEFORE the delay there is no listener: that is what stops the very event that opened Print from closing it.
    expect(listeners.keydown.length + listeners.pointerdown.length).toBe(0);
    flush();
    expect(listeners.keydown.length).toBe(1);
    expect(listeners.pointerdown.length).toBe(1);
  });

  it('qualquer tecla traz as pausas de volta, com Continuar selecionado, e desarma os dois ouvintes', () => {
    const { shell, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    flush();
    listeners.keydown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => !sp.hidden)).toBe(true);
    expect($('#sp0').querySelectorAll('.pm-sel').length).toBe(1);
    expect(listeners.keydown.length + listeners.pointerdown.length).toBe(0);
  });

  it('se o jogo já saiu da pausa, o retorno NÃO reabre os menus (só desarma)', () => {
    const { shell, listeners, flush } = boot();
    setPhase('paused');
    shell.printMode();
    flush();
    setPhase('playing');
    listeners.pointerdown[0]({ preventDefault() {} });
    expect($$('.screen-pause').every((sp) => sp.hidden)).toBe(true);
  });
});

describe('pauseActs — a tabela do menu de pausa', () => {
  it('"Continuar" volta ao jogo', () => {
    const { shell } = boot();
    setPhase('paused');
    shell.pauseActs.resume();
    expect(faseFalsa).toBe('playing');
  });

  it('o nível do quiz cicla 1..5 e volta ao 1 (nunca sai da faixa)', () => {
    const { shell, log } = boot({ getQuizLevel: () => 5 });
    shell.pauseActs.nivel();
    expect(log.acts).toEqual(['nivel:1:true']);
  });

  it('os quatro submenus de a11y escopam no jogador que abriu (pauseActor)', () => {
    const { shell, log } = boot({ getPauseActor: () => 2 });
    shell.pauseActs.motora(); shell.pauseActs.anim(); shell.pauseActs.visual(); shell.pauseActs.empatia();
    expect(log.acts).toEqual(['motor:2', 'movement', 'motionPlayer:2', 'motion', 'selViz:2', 'visual', 'selViz:2', 'empathy']);
  });

  it('"Mais um jogador" cria a tela, marca o novo como esperando e volta ao jogo', () => {
    const { shell, log } = boot();
    setPhase('paused');
    shell.pauseActs.addplayer();
    expect(players.length).toBe(2);
    expect(players[1].waiting).toBe(true);
    expect(log.acts).toEqual(['badge:1']);
    expect(faseFalsa).toBe('playing');
    expect(log.alerted.at(-1)).toContain('Jogador 2');
  });

  it('no 4º jogador, avisa o teto e NÃO cria tela nenhuma', () => {
    const { shell, log } = boot();
    setNumPlayersValue(4);
    shell.pauseActs.addplayer();
    // One sentence per event: adding a player when there are already four is announced the same way wherever it happens.
    expect(log.alerted.at(-1)).toBe('Já são 4 jogadores.');
    expect(log.acts).toEqual([]);
  });

  it('se a tela nova não couber na janela, avisa e NÃO cria — o jogo não fica ilegível', () => {
    const { shell, log } = boot({ fitsN: () => false });
    shell.pauseActs.addplayer();
    // One sentence says both things: the 640×360 minimum each screen needs, and the actionable half (make the window
    // bigger or use full screen).
    expect(log.alerted.at(-1)).toContain('cada tela precisa de ao menos 640×360');
    expect(log.alerted.at(-1)).toContain('Aumente a janela ou use tela cheia');
    expect(log.acts).toEqual([]);
  });

  it('se joinPlayer recusar, nada acontece depois dele', () => {
    const { shell, log } = boot({ joinPlayer: () => false });
    shell.pauseActs.addplayer();
    expect(log.acts).toEqual([]);
    expect(log.alerted).toEqual([]);
  });

  it('todo `data-act` do menu tem ação, e nenhuma ação é órfã', () => {
    const { shell } = boot();
    setPhase('paused');
    const usados = new Set($$('.screen-pause .pm-btn').map((b) => b.dataset.act));
    for (const a of usados) expect(typeof shell.pauseActs[a], a).toBe('function');
    // and the table covers exactly the acts a root declares (the live list, for the day they diverge)
    expect(Object.keys(shell.pauseActs).sort()).toEqual(
      ['addplayer', 'ajuda', 'anim', 'audio', 'caa', 'empatia', 'motora', 'nivel', 'print', 'quit', 'resume', 'tipo', 'visual'],
    );
  });
});
