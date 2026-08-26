// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de input/gamepad — lógica PURA de leitura (stdDirs/bindActive/padActions) + a máquina de estados do
// wizard de mapeamento via initGamepad(ctx) (project node, sem document real: ctx.$ devolve elementos FAKE).
// Contrato: DI por closure (ctx.getGamepads/$/srSay/srAlert/frontOverlay/phase/attract/touch/players/nav/
// quiz/join/respawn/spriteBase), nenhum acesso a `document`/`navigator` fora do ctx. ZOMBIES + Right-BICEP.
// Cobre em especial (pedido da tarefa): botão repetido (release-gate), Escape no meio (_skip sentinel), muitos
// ticks ociosos sem avançar passo ("timeout" — não existe timeout real no original; isso prova que não há
// avanço espúrio), e controle desconectado durante o wizard (tick vira no-op sem lançar).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  stdDirs, bindActive, padActions, PADWIZ_STEPS, initGamepad,
} from '../app/js/input/gamepad.js';
import { padCur, padPrevAct, padPrevStart } from '../app/js/input/state.js';

// padCur/padPrevAct/padPrevStart (input/state.ts) são estado GENUINAMENTE compartilhado — não fazem parte do
// ctx, e persistem entre chamadas de initGamepad() dentro do mesmo processo (é assim que o game.js real os
// usa: um só, a vida toda). Sem resetar entre testes, uma borda (`edge`) capturada num teste "vaza" pro
// próximo que reusa o mesmo índice de gamepad. Reset global — nenhum teste depende de estado de outro.
beforeEach(() => {
  for (const k of Object.keys(padCur)) delete padCur[k];
  for (const k of Object.keys(padPrevAct)) delete padPrevAct[k];
  for (const k of Object.keys(padPrevStart)) delete padPrevStart[k];
});

// ---------------------------------------------------------------------------------------------
// Fábricas de fixtures (pad falso + ctx falso — nenhuma delas toca document/navigator)
// ---------------------------------------------------------------------------------------------

function makePad({ id = 'pad-1', index = 0, mapping = 'standard', pressed = [], axes = [0, 0, 0, 0, 0, 0, 1.3, 1.3] } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) }));
  return { id, index, mapping, buttons, axes: axes.slice() };
}

// Elemento DOM falso mínimo — só os campos que gamepad.ts efetivamente lê/escreve. `hidden:true` por padrão:
// overlays (#padwiz, #win-overlay) começam escondidos no HTML real; um fake com hidden:false faria o
// pollPads achar a tela de vitória sempre aberta e pular toda a lógica de fase.
function fakeEl() {
  return { textContent: '', hidden: true, className: '', style: {}, src: '', clicked: 0, click() { this.clicked++; }, _listeners: {}, addEventListener(ev, fn) { (this._listeners[ev] ??= []).push(fn); } };
}

function buildCtx(over = {}) {
  const dom = new Map([
    ['#padwiz-prompt', fakeEl()], ['#padwiz', fakeEl()], ['#padwiz-demo', fakeEl()],
    ['#padwiz-demo-img', fakeEl()], ['#padwiz-demo-fx', fakeEl()], ['#padwiz-progress', fakeEl()],
    ['#padwiz-cancel', fakeEl()], ['#win-overlay', fakeEl()], ['#btn-again', fakeEl()],
  ]);
  const said = []; const alerted = []; const fronted = [];
  let pads = [];
  let phase = 'playing';
  const players = over.players ?? [];
  const calls = { setPhase: [], navTitle: [], navPause: [], navDialog: [], joinPlayer: [], respawnPlayer: [], setPauseActor: [], modalInput: [], clearWaitingBadge: [], hideTouchControls: 0, stopAttract: 0 };
  return {
    $: (sel) => dom.get(sel) ?? null,
    getGamepads: () => pads,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    frontOverlay: (el) => fronted.push(el),
    getPhase: () => phase,
    setPhase: (p) => { calls.setPhase.push(p); phase = p; },
    isAttractActive: () => false,
    stopAttract: () => { calls.stopAttract++; },
    isTouchMode: () => false,
    hideTouchControls: () => { calls.hideTouchControls++; },
    getPlayers: () => players,
    getNumPlayers: () => players.length || 1,
    navTitle: (k) => calls.navTitle.push(k),
    sharedDialogOpen: () => null,
    navDialog: (dlg, k) => calls.navDialog.push([dlg, k]),
    getPauseMenu: () => null,
    navPause: (menu, pi, k) => calls.navPause.push([menu, pi, k]),
    setPauseActor: (i) => calls.setPauseActor.push(i),
    // UMA entrada onde havia quatro (ADR-0033). O pad e o teclado tinham CÓPIAS da mesma decisão — a grade
    // de três colunas e o desvio de Braille — e duas cópias de uma regra são duas chances de divergir.
    modalInput: (p, intent) => calls.modalInput.push([p, intent]),
    hasModal: (i) => !!(players[i] && players[i].modalAberto),
    joinPlayer: (gi) => { calls.joinPlayer.push(gi); return true; },
    respawnPlayer: (i) => calls.respawnPlayer.push(i),
    clearWaitingBadge: (i) => calls.clearWaitingBadge.push(i),
    spriteBase: 'assets/sprites/menino/',
    // helpers de teste (não fazem parte do contrato GamepadCtx)
    dom, said, alerted, fronted, calls,
    setPads: (p) => { pads = p; },
    setPhaseValue: (p) => { phase = p; },
    ...over,
  };
}

function makePlayer(over = {}) {
  return { pad: -1, quit: false, waiting: false, easy: false, jumpEdge: false, runEdge: false, leftEdge: false, rightEdge: false, swapEdge: false, specialEdge: false, ...over };
}

// ---------------------------------------------------------------------------------------------
// stdDirs — direções pelas fontes padrão (stick, D-pad, hat)
// ---------------------------------------------------------------------------------------------

describe('stdDirs', () => {
  it('[Zero] pad em repouso -> nenhuma direção', () => {
    const d = stdDirs(makePad());
    expect(d).toEqual({ left: false, right: false, up: false, down: false });
  });
  it('[Right] stick 0 além da zona morta ativa esquerda/direita', () => {
    expect(stdDirs(makePad({ axes: [-0.9, 0, 0, 0, 0, 0, 1.3, 1.3] })).left).toBe(true);
    expect(stdDirs(makePad({ axes: [0.9, 0, 0, 0, 0, 0, 1.3, 1.3] })).right).toBe(true);
  });
  it('[Boundary] D-pad (botões 12-15) ativa direções mesmo com sticks parados', () => {
    const d = stdDirs(makePad({ pressed: [12, 15] })); // cima + direita
    expect(d.up).toBe(true); expect(d.right).toBe(true); expect(d.left).toBe(false); expect(d.down).toBe(false);
  });
  it('[Interface] stick E D-pad mapeados juntos: os dois ficam vivos (nenhum mata o outro)', () => {
    const d = stdDirs(makePad({ pressed: [14], axes: [0, -0.9, 0, 0, 0, 0, 1.3, 1.3] })); // D-pad esquerda + stick cima
    expect(d.left).toBe(true); expect(d.up).toBe(true);
  });
  it('[Right] hat (POV) no eixo 6: cada um dos 8 passos ativa a combinação certa de direções', () => {
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, -1, 1.3] }))).toMatchObject({ up: true, down: false, left: false, right: false });
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1, 1.3] }))).toMatchObject({ up: true, down: false, left: true, right: false });
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 0.4286, 1.3] }))).toMatchObject({ down: true, left: true });
  });
  it('[Error] eixo do hat fora do range de repouso (>1.001) é ignorado sem lançar', () => {
    expect(() => stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1.286, 1.3] }))).not.toThrow();
    expect(stdDirs(makePad({ axes: [0, 0, 0, 0, 0, 0, 1.286, 1.3] }))).toEqual({ left: false, right: false, up: false, down: false });
  });
});

// ---------------------------------------------------------------------------------------------
// bindActive — um binding do wizard (digital/analógico/hat) contra o frame atual
// ---------------------------------------------------------------------------------------------

describe('bindActive', () => {
  it('[Zero] binding ausente -> false', () => {
    expect(bindActive(makePad(), null)).toBe(false);
    expect(bindActive(makePad(), undefined)).toBe(false);
  });
  it('[Right] binding digital {b}: reflete gp.buttons[b].pressed', () => {
    const gp = makePad({ pressed: [3] });
    expect(bindActive(gp, { b: 3 })).toBe(true);
    expect(bindActive(gp, { b: 4 })).toBe(false);
  });
  it('[Right] binding analógico {ax,s}: limiar por SINAL na metade do curso', () => {
    const gp = makePad({ axes: [0.6, 0, 0, 0, 0, 0, 1.3, 1.3] });
    expect(bindActive(gp, { ax: 0, s: 1 })).toBe(true); // mesmo sinal, além de 0.5
    expect(bindActive(gp, { ax: 0, s: -1 })).toBe(false); // sinal oposto
  });
  it('[Boundary] binding hat {av,v}: só dentro de ±0.13 do valor exato do passo', () => {
    const gp = makePad({ axes: [0, 0, 0, 0, 0, 0, 0.43, 1.3] });
    expect(bindActive(gp, { av: 6, v: 0.4286 })).toBe(true);
    expect(bindActive(gp, { av: 6, v: -0.4286 })).toBe(false);
  });
  it('[Error] binding malformado (sem b/ax/av) -> false, não lança', () => {
    expect(() => bindActive(makePad(), {})).not.toThrow();
    expect(bindActive(makePad(), {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// padActions — mapa PADRÃO (Gamepad "standard") vs mapa CUSTOM salvo pelo wizard
// ---------------------------------------------------------------------------------------------

describe('padActions', () => {
  it('[Right] sem custom (null): usa o mapa padrão da Gamepad API standard (0=pulo,1=especial,3=troca,9=start)', () => {
    const gp = makePad({ pressed: [0, 9] });
    const a = padActions(gp, null);
    expect(a.jump).toBe(true); expect(a.especial).toBe(false); expect(a._pause).toBe(true); expect(a._start).toBe(true);
  });
  it('[Right] run também dispara por 2, 5 ou 7 (X-esquerda / RB / RT)', () => {
    expect(padActions(makePad({ pressed: [5] }), null).run).toBe(true);
    expect(padActions(makePad({ pressed: [7] }), null).run).toBe(true);
  });
  it('[Right] custom presente e sem _skip: usa os bindings do usuário para as AÇÕES', () => {
    const gp = makePad({ pressed: [8] });
    const custom = { jump: { b: 8 } };
    expect(padActions(gp, custom).jump).toBe(true);
    expect(padActions(gp, null).jump).toBe(false); // botão 8 não é pulo no mapa padrão
  });
  it('[Interface] custom com _skip:true é tratado como "sem custom" (cai no mapa padrão)', () => {
    const gp = makePad({ pressed: [0] });
    const custom = { _skip: true, jump: { b: 5 } }; // se fosse respeitado, pulo dependeria do botão 5
    expect(padActions(gp, custom).jump).toBe(true); // pulo padrão (botão 0), não o custom ignorado
  });
  it('[Boundary] direções custom caem de volta em stdDirs quando o binding do usuário não está ativo', () => {
    const gp = makePad({ axes: [-0.9, 0, 0, 0, 0, 0, 1.3, 1.3] }); // stick esquerda (D-pad físico não mapeado no custom)
    const custom = { jump: { b: 0 } }; // custom não define 'left' -> stdDirs cobre
    expect(padActions(gp, custom).left).toBe(true);
  });
  it('[Zero] nenhum botão/eixo ativo -> todas as ações false', () => {
    const a = padActions(makePad(), null);
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });
});

describe('PADWIZ_STEPS', () => {
  it('[Interface] 9 passos: as 8 ações do jogo + START, cada um com [ação, rótulo pt-BR]', () => {
    expect(PADWIZ_STEPS).toHaveLength(9);
    expect(PADWIZ_STEPS.map((s) => s[0])).toEqual(['up', 'down', 'left', 'right', 'jump', 'run', 'swap', 'especial', 'start']);
    for (const [, label] of PADWIZ_STEPS) expect(label).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
// initGamepad — o wizard (máquina de estados) via ctx totalmente injetado, sem document/navigator reais
// ---------------------------------------------------------------------------------------------

describe('initGamepad — wizard: fluxo completo', () => {
  let ctx; let api;
  beforeEach(() => { ctx = buildCtx(); api = initGamepad(ctx); });

  it('[Right] identifica o controle no 1º botão pressionado, espera soltar, e faz os 9 passos até fechar sozinho', () => {
    api.openPadWiz();
    expect(api.getPadWiz()).not.toBeNull();
    // ainda sem controle identificado: qualquer pad com botão pressionado é adotado (array indexado por
    // POSIÇÃO como a Gamepad API real: usa index:0 para casar com a posição 0 do array)
    ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [0] })]);
    api.padWizTick();
    expect(api.getPadWiz().gi).toBe(0);
    expect(api.getPadWiz().id).toBe('DirectInput X');
    // ainda segurando o botão 0 -> baseWait continua esperando soltar
    api.padWizTick();
    expect(api.getPadWiz().baseWait).toBe(true);
    // solta tudo -> captura o snapshot de repouso e entra no passo 0 ('up')
    ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [] })]);
    api.padWizTick();
    expect(api.getPadWiz().baseWait).toBe(false);
    expect(api.getPadWiz().step).toBe(0);

    // percorre os 9 passos apertando um botão distinto por passo (0..8), soltando entre cada um
    for (let i = 0; i < PADWIZ_STEPS.length; i++) {
      ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [i] })]);
      api.padWizTick(); // captura o botão i para o passo atual
      if (i < PADWIZ_STEPS.length - 1) {
        expect(api.getPadWiz().map[PADWIZ_STEPS[i][0]]).toEqual({ b: i });
        ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [] })]);
        api.padWizTick(); // solta -> libera o próximo prompt
      }
    }
    // último passo (start) fecha e SALVA sozinho (closePadWiz(true))
    expect(api.getPadWiz()).toBeNull();
    expect(ctx.alerted.some((m) => m.includes('Mapeamento salvo'))).toBe(true);
    const saved = api.padMapFor('DirectInput X');
    expect(saved.up).toEqual({ b: 0 });
    expect(saved.start).toEqual({ b: 8 });
  });
});

describe('initGamepad — wizard: botão repetido (release-gate)', () => {
  it('[Right] segurar o MESMO botão do passo anterior não captura o passo seguinte — precisa soltar antes', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-rep', index: 0, pressed: [] }));
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [] })]);
    api.padWizTick(); // baseWait termina (nada pressionado) -> passo 0
    expect(api.getPadWiz().step).toBe(0);

    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [7] })]);
    api.padWizTick(); // liga o passo 0 ao botão 7
    expect(api.getPadWiz().map[PADWIZ_STEPS[0][0]]).toEqual({ b: 7 });
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);

    // continua segurando o MESMO botão 7 por vários ticks: não deve capturar o passo 1 nem avançar
    for (let i = 0; i < 10; i++) api.padWizTick();
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);
    expect(api.getPadWiz().map[PADWIZ_STEPS[1][0]]).toBeUndefined();

    // solta -> libera o prompt do passo 1; pressiona o MESMO botão 7 de novo -> É aceito para o novo passo
    // (o original não deduplica bindings entre ações — documentado, não é bug desta extração)
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [] })]);
    api.padWizTick(); // release=false, prompta o passo 1
    expect(api.getPadWiz().release).toBe(false);
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [7] })]);
    api.padWizTick();
    expect(api.getPadWiz().map[PADWIZ_STEPS[1][0]]).toEqual({ b: 7 });
  });
});

describe('initGamepad — wizard: Escape no meio (cancelar)', () => {
  it('[Right] closePadWiz(false) fecha sem salvar; padMapFor devolve o sentinel _skip (mapa padrão, não persiste)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-esc', index: 0 }));
    expect(api.getPadWiz()).not.toBeNull();
    api.closePadWiz(false); // Esc
    expect(api.getPadWiz()).toBeNull();
    expect(ctx.alerted.some((m) => m.includes('salvo'))).toBe(false);
    expect(api.padMapFor('pad-esc')).toEqual({ _skip: true });
  });
  it('[Boundary] Esc sem nenhum wizard aberto é no-op (não lança)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    expect(() => api.closePadWiz(false)).not.toThrow();
    expect(api.getPadWiz()).toBeNull();
  });
  it('[Interface] o botão #padwiz-cancel já sai ligado a closePadWiz(false)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-btn', index: 0 }));
    ctx.dom.get('#padwiz-cancel')._listeners.click[0]();
    expect(api.getPadWiz()).toBeNull();
  });
});

describe('initGamepad — wizard: muitos ticks ociosos não avançam passo ("timeout")', () => {
  it('[Zero/Many] 200 ticks com o pad em repouso mantêm o wizard parado no MESMO passo, sem lançar', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-idle', index: 0, pressed: [] }));
    ctx.setPads([makePad({ id: 'pad-idle', index: 0, pressed: [] })]);
    api.padWizTick(); // sai do baseWait -> passo 0
    expect(api.getPadWiz().step).toBe(0);
    expect(() => { for (let i = 0; i < 200; i++) api.padWizTick(); }).not.toThrow();
    expect(api.getPadWiz().step).toBe(0); // nenhum avanço espúrio — o original não tem timeout de fato
  });
});

describe('initGamepad — wizard: controle desconectado durante o mapeamento', () => {
  it('[Right] índice do pad passa a devolver undefined -> tick vira no-op (não lança, não perde o passo)', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-dc', index: 1, pressed: [] }));
    ctx.setPads([undefined, makePad({ id: 'pad-dc', index: 1, pressed: [] })]);
    api.padWizTick();
    expect(api.getPadWiz().step).toBe(0);
    ctx.setPads([]); // desconectou: pads[1] agora é undefined
    expect(() => api.padWizTick()).not.toThrow();
    expect(api.getPadWiz()).not.toBeNull();
    expect(api.getPadWiz().step).toBe(0); // congelado, não perdeu progresso
    // reconecta -> volta a responder normalmente
    ctx.setPads([undefined, makePad({ id: 'pad-dc', index: 1, pressed: [3] })]);
    api.padWizTick();
    expect(api.getPadWiz().map[PADWIZ_STEPS[0][0]]).toEqual({ b: 3 });
  });
  it('[Boundary] getGamepads() devolvendo null/undefined inteiro não lança em nenhuma fase', () => {
    const ctx = buildCtx({ getGamepads: () => null }); const api = initGamepad(ctx);
    expect(() => api.openPadWiz()).not.toThrow();
    expect(() => api.padWizTick()).not.toThrow();
  });
});

describe('initGamepad — wizard: classificação de eixo (analógico vs D-pad/hat)', () => {
  it('[Right] eixo que VARIA continuamente por 8 ticks -> binding analógico {ax,s}', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-ax', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] }));
    ctx.setPads([makePad({ id: 'pad-ax', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.padWizTick(); // passo 0
    // eixo 2 sai do repouso além de 0.45 -> o tick que DETECTA a saída só INICIA o rastreio (não conta);
    // são precisos 8 ticks de rastreio DEPOIS disso (ticks>=8) para fechar a classificação.
    ctx.setPads([makePad({ id: 'pad-ax', index: 0, axes: [0, 0, 0.5, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); // inicia o rastreio
    const seq = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]; // 8 ticks de PROCESSAMENTO, variando a cada um (>2 mudanças)
    for (const v of seq) { ctx.setPads([makePad({ id: 'pad-ax', index: 0, axes: [0, 0, v, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); }
    expect(api.getPadWiz().map[PADWIZ_STEPS[0][0]]).toEqual({ ax: 2, s: 1 });
  });
  it('[Right] eixo que salta e FICA CONSTANTE por 8 ticks -> binding de hat {av,v}', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] }));
    ctx.setPads([makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.padWizTick(); // passo 0
    // mesmo detalhe: 1 tick para DETECTAR (inicia o rastreio) + 8 ticks de processamento (ticks>=8)
    for (let i = 0; i < 9; i++) { ctx.setPads([makePad({ id: 'pad-hat', index: 0, axes: [0, 0, 0.7143, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); }
    expect(api.getPadWiz().map[PADWIZ_STEPS[0][0]]).toEqual({ av: 2, v: 0.7143 });
  });
});

// ---------------------------------------------------------------------------------------------
// initGamepad — pollPads: dispatch por fase (title/paused/playing), auto-wizard, e persistência do mapa
// ---------------------------------------------------------------------------------------------

describe('initGamepad — pollPads', () => {
  it('[Right] controle DirectInput sem mapa salvo, apertando algo em "playing": pausa e abre o wizard sozinho', () => {
    const players = [makePlayer({ pad: 0 })];
    const ctx = buildCtx({ players });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'DirectInput Y', index: 0, mapping: '', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.setPhase).toContain('paused');
    expect(api.getPadWiz()).not.toBeNull();
    expect(api.getPadWiz().id).toBe('DirectInput Y');
  });
  it('[Right] durante o wizard, pollPads não processa nada (só o wizard fala com os pads)', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    api.openPadWiz();
    ctx.setPads([makePad({ id: 'x', index: 0, pressed: [0] })]);
    expect(() => api.pollPads()).not.toThrow();
    expect(ctx.calls.navTitle).toHaveLength(0);
  });
  it('[Right] fase "playing", mapa padrão: pulo do controle marca jumpEdge só na BORDA (subida)', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(p.jumpEdge).toBe(true);
    p.jumpEdge = false; // o jogo consome a borda a cada frame
    api.pollPads(); // botão 0 ainda pressionado -> sem NOVA borda
    expect(p.jumpEdge).toBe(false);
  });
  // A guarda do Fácil (input/edges.ts) vale nos TRÊS caminhos de entrada. Estes dois casos fecham o triângulo:
  // keydown e touch-bindings já a testavam, e o controle não — a regra podia ser desligada na folha sem que
  // nada aqui reagisse. `run` no mapa padrão é o botão 5 (ombro direito).
  it('[Right] Fácil: o botão de correr do controle NÃO levanta runEdge (mesma regra do teclado e do toque)', () => {
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [5] })]);
    api.pollPads();
    expect(p.runEdge).toBe(false);
  });
  it('[Inverse] SEM Fácil, o mesmo botão levanta runEdge — prova que a guarda é o `easy`, não o mapa', () => {
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [5] })]);
    api.pollPads();
    expect(p.runEdge).toBe(true);
  });
  it('[Right] fase "title": navTitle recebe as teclas quando algum jogador aciona', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]); // pulo = "yes"
    api.pollPads();
    expect(ctx.calls.navTitle).toHaveLength(1);
    expect(ctx.calls.navTitle[0].yes).toBe(true);
  });
  it('[Boundary] MP, controle de um jogador != J1 na tela de título: não navega, só avisa', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 1 }), makePlayer({ pad: 0 })] }); // owner do pad 0 é o índice 1 (J2)
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.navTitle).toHaveLength(0);
    expect(ctx.said.some((m) => m.includes('Aguarde o Jogador 1'))).toBe(true);
  });
  it('[Right] fase "playing", MODAL aberto: CIMA vira intenção e NÃO mexe jumpEdge', () => {
    // O caso dizia "quiz braille: CIMA anuncia a célula". Ditar a cela é o que a atividade de alfabetização
    // faz com `up`; o pad só entrega `up` (ADR-0033). O que continua sendo afirmado — e é o que importa —
    // é que a tecla vai para o modal em vez de virar borda de jogo.
    const p = makePlayer({ pad: 0, modalAberto: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [12] })]); // D-pad cima
    api.pollPads();
    expect(ctx.calls.modalInput).toEqual([[0, 'up']]); // o ÍNDICE do dono, não o objeto (ADR-0033/0039)
    expect(p.jumpEdge).toBe(false);
  });
  it('[Right] jogador ausente (owner<0) que aperta algo em "playing" e não há tela esperando: chama joinPlayer', () => {
    const ctx = buildCtx({ players: [] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 3, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.joinPlayer).toEqual([3]);
  });
});

describe('initGamepad — padMapFor', () => {
  it('[Right] sem mapa salvo (localStorage indisponível/vazio em node) -> null, sem lançar', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    expect(api.padMapFor('nunca-visto')).toBeNull();
  });
  it('[Interface] cacheia por id: chamadas repetidas devolvem a MESMA referência, sem reconsultar o store', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    const a = api.padMapFor('algum-pad');
    const b = api.padMapFor('algum-pad');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------------------------
// Demonstracao animada do assistente — regressao do `SPR` (ver render/sprites.ts)
// No game.js o caminho dos PNGs era escrito como `SPR`, um identificador que NUNCA foi declarado nem
// importado ali: existia so como const privado do render/sprites.ts. Abrir o assistente chamava
// padWizDemo(null), que caia no ramo do sprite parado e lancava ReferenceError — o remapeamento de
// controle inteiro estava morto, sem que build, tsc ou teste algum notasse (game.js nao e tipado nem
// coberto). Aqui a base entra como dependencia declarada, entao a falha e impossivel por construcao;
// estes testes fixam o VALOR para que ninguem a desligue por engano depois.
// ---------------------------------------------------------------------------------------------

describe('initGamepad — imagem da demonstracao', () => {
  it('[Right] abrir o assistente aponta a imagem para o sprite parado, a partir da base injetada', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWiz();
    expect(ctx.dom.get('#padwiz-demo-img').src).toBe('assets/sprites/menino/idle/0.png');
  });

  it('[Interface] a base vem do ctx, nao esta escrita no modulo', () => {
    const ctx = buildCtx({ spriteBase: 'x/y/' }); const api = initGamepad(ctx);
    api.openPadWiz();
    expect(ctx.dom.get('#padwiz-demo-img').src).toBe('x/y/idle/0.png');
  });
});
