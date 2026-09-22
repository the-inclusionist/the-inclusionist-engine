// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de input/gamepad — lógica PURA de leitura (stdDirs/bindActive/padActions) + a máquina de estados do
// wizard de mapeamento via initGamepad(ctx) (project node, sem document real: ctx.$ devolve elementos FAKE).
// Contrato: DI por closure (ctx.getGamepads/$/srSay/srAlert/frontOverlay/phase/attract/touch/players/nav/
// quiz/join/respawn/spriteBase), nenhum acesso a `document`/`navigator` fora do ctx. ZOMBIES + Right-BICEP.
// Cobre em especial (pedido da tarefa): botão repetido (release-gate), Escape no meio (_skip sentinel), muitos
// ticks ociosos sem avançar passo ("timeout" — não existe timeout real no original; isso prova que não há
// avanço espúrio), e controle desconectado durante o wizard (tick vira no-op sem lançar).
import { GAMEPAD_STANDARD } from '../app/js/input/default-bindings.js';
import { ACTIONS } from '../app/js/core/actions.js';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  stdDirs, bindActive, padActions, PADWIZ_ORDER, initGamepad, oneButtonAtOnce,
} from '../app/js/input/gamepad.js';
import { padCur, padPrevAct, padPrevStart } from '../app/js/input/state.js';
// `oneButton` e' binding vivo de `core/state` (nao do ctx): estes casos ligam-no e desligam-no de verdade.
import * as estado from '../app/js/core/state.js';
// Só o último bloco os usa: ele afere a FONTE do módulo, porque o buraco que ele tapa é de escrita e não
// de execução — uma frase crua corre sem erro nenhum.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// padCur/padPrevAct/padPrevStart (input/state.ts) são estado GENUINAMENTE compartilhado — não fazem parte do
// ctx, e persistem entre chamadas de initGamepad() dentro do mesmo processo (é assim que o game.js real os
// usa: um só, a vida toda). Sem resetar entre testes, uma borda (`edge`) capturada num teste "vaza" pro
// próximo que reusa o mesmo índice de gamepad. Reset global — nenhum teste depende de estado de outro.
beforeEach(() => {
  for (const k of Object.keys(padCur)) delete padCur[k];
  for (const k of Object.keys(padPrevAct)) delete padPrevAct[k];
  for (const k of Object.keys(padPrevStart)) delete padPrevStart[k];
  estado.setOneButtonValue(false); // senao um caso da empatia motora vaza para os 50 de cima
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
  const naBarra = over.naBarra || new Set();
  const calls = { setPhase: [], navTitle: [], navPause: [], navDialog: [], joinPlayer: [], respawnPlayer: [], setPauseActor: [], modalInput: [], clearWaitingBadge: [], hideTouchControls: 0, stopAttract: 0, navBar: [], arestas: [] };
  return {
    $: (sel) => dom.get(sel) ?? null,
    getGamepads: () => pads,
    // ⚠️ O RÓTULO VEM DO 'JOGO', e num teste o jogo é o fixture. Antes o assistente lia as palavras
    // de uma constante em português dentro de `input/gamepad.ts`; agora pergunta, e este objeto é a
    // resposta. `leftShoulder` fica de fora de propósito: prova que uma posição não nomeada é SALTADA.
    rotuloDaAcao: (a) => ({
      up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA',
      action1: 'CORRER', action2: 'PULAR', action3: 'ESPECIAL', action4: 'TROCAR', start: 'START',
    })[a] || null,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    frontOverlay: (el) => fronted.push(el),
    // 2026-08-26: o ctx deixou de pedir a FASE e passou a pedir dois booleanos e dois verbos (ADR-0030 C3).
    // O falso segue guardando a string por dentro — é como os casos se leem —, e traduz aqui.
    mundoRodando: () => phase === 'playing',
    menuDePausa: () => phase === 'paused',
    pausar: () => { calls.setPhase.push('paused'); phase = 'paused'; },
    retomar: () => { calls.setPhase.push('playing'); phase = 'playing'; },
    isAttractActive: () => false,
    stopAttract: () => { calls.stopAttract++; },
    isTouchMode: () => false,
    hideTouchControls: () => { calls.hideTouchControls++; },
    getPlayers: () => players,
    getNumPlayers: () => players.length || 1,
    navTitle: (k) => calls.navTitle.push(k),
    // O MODO `accessibility` (ADR-0044, item 7): com o jogo andando, o direcional dirige a barra do HUD e não
    // o personagem. Por padrão ninguém está nele — os casos que o exercitam alimentam `naBarra`.
    naBarraDe: (i) => naBarra.has(i),
    navBar: (i, k, temStart) => calls.navBar.push([i, k, temStart]),
    sharedDialogOpen: () => null,
    navDialog: (dlg, k) => calls.navDialog.push([dlg, k]),
    getPauseMenu: () => null,
    navPause: (menu, pi, k) => calls.navPause.push([menu, pi, k]),
    setPauseActor: (i) => calls.setPauseActor.push(i),
    // A aresta por jogador (ADR-0113 cláusula 4). Guarda a LISTA e não um contador: a pergunta «que aparelho
    // produz as arestas» é por assento, e um número não distingue dois controles de dois jogadores.
    playerEdge: (jogador, origem) => calls.arestas.push([jogador, origem]),
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
    expect(a.action2).toBe(true); expect(a.action3).toBe(false); expect(a._pause).toBe(true); expect(a._start).toBe(true);
  });
  it('⚠️ R1 e R2 DEIXARAM de correr: agora são os ombros/gatilhos da direita (ADR-0086)', () => {
    // Isto AFIRMAVA o contrário até 2026-09-06, e a mudança é real e sentida: `action1` era
    // `b(2) || b(5) || b(7)`, ou seja X, R1 e R2 todos a correr. Com os quatro ombros a existirem como
    // posições próprias, `run` perde dois dos seus três botões — é o asterisco que o ADR-0086 pôs no
    // seu próprio «zero movimento»: nenhum VERBO muda de botão, mas este perde alternativas.
    expect(padActions(makePad({ pressed: [5] }), null).action1).toBe(false);
    expect(padActions(makePad({ pressed: [5] }), null).rightShoulder).toBe(true);
    expect(padActions(makePad({ pressed: [7] }), null).rightTrigger).toBe(true);
    expect(padActions(makePad({ pressed: [2] }), null).action1, 'X continua a correr').toBe(true);
  });

  it('⚠️ o mapa LIDO é o mapa DECLARADO — a asserção que a divergência exigia', () => {
    // O defeito que este caso fecha durou vários dias sem ninguém notar: `padActions` trazia os índices
    // como literais e `input/default-bindings` declarava outros, e nada comparava os dois. É a mesma
    // forma do defeito que o gate do toque apanhou — duas tabelas que concordam entre si não provam nada
    // sobre um terceiro que as lê. Aqui não há terceiro: a leitura SAI da tabela.
    for (const [acao, indice] of Object.entries(GAMEPAD_STANDARD)) {
      if (typeof indice !== 'number') continue;
      if (['up', 'down', 'left', 'right'].includes(acao)) continue; // vêm do stick/D-pad, não de `at()`
      const a = padActions(makePad({ pressed: [indice] }), null);
      expect(a[acao], `botão ${indice} devia levantar "${acao}"`).toBe(true);
    }
  });
  it('[Right] custom presente e sem _skip: usa os bindings do usuário para as AÇÕES', () => {
    const gp = makePad({ pressed: [8] });
    const custom = { action2: { b: 8 } };
    expect(padActions(gp, custom).action2).toBe(true);
    expect(padActions(gp, null).action2).toBe(false); // botão 8 não é pulo no mapa padrão
  });
  it('[Interface] custom com _skip:true é tratado como "sem custom" (cai no mapa padrão)', () => {
    const gp = makePad({ pressed: [0] });
    const custom = { _skip: true, action2: { b: 5 } }; // se fosse respeitado, pulo dependeria do botão 5
    expect(padActions(gp, custom).action2).toBe(true); // pulo padrão (botão 0), não o custom ignorado
  });
  it('[Boundary] direções custom caem de volta em stdDirs quando o binding do usuário não está ativo', () => {
    const gp = makePad({ axes: [-0.9, 0, 0, 0, 0, 0, 1.3, 1.3] }); // stick esquerda (D-pad físico não mapeado no custom)
    const custom = { action2: { b: 0 } }; // custom não define 'left' -> stdDirs cobre
    expect(padActions(gp, custom).left).toBe(true);
  });
  it('[Zero] nenhum botão/eixo ativo -> todas as ações false', () => {
    const a = padActions(makePad(), null);
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });
});

describe('PADWIZ_STEPS', () => {
  it('⚠️ o assistente alcança TODAS as quatorze posições — nem uma a menos', () => {
    // ISTO FALTAVA, e a falta era um buraco de acessibilidade. A lista tinha nove entradas e omitia os
    // quatro ombros e o `select`; um jogo que declarasse `leftShoulder` não tinha por onde a criança o
    // mapear. E o assistente existe PARA controles que não são «standard» — genéricos, adaptados, de uma
    // mão —, ou seja, cinco posições eram inalcançáveis exatamente para quem mais precisa dele.
    //
    // A asserção é de COBERTURA e não de tamanho: comparar com `ACTIONS` faz uma posição nova nascer
    // coberta ou fazer este caso reprovar, que é a única forma de a lista não voltar a ficar para trás.
    expect([...PADWIZ_ORDER].sort()).toEqual([...ACTIONS].sort());
  });

  it('a ordem é de ERGONOMIA: direções, losango, ombros, sistema', () => {
    // A ordem é o que sobra de decisão da engine aqui — as palavras são do jogo. Direções primeiro porque
    // a criança as encontra sem pensar; sistema por último porque `start` e `select` costumam ser os
    // botões mais pequenos e escondidos.
    expect(PADWIZ_ORDER.slice(0, 4)).toEqual(['up', 'down', 'left', 'right']);
    expect(PADWIZ_ORDER.slice(-2)).toEqual(['start', 'select']);
  });

  it('⚠️ nenhum RÓTULO sobrou na tabela — era português cru dentro da engine', () => {
    // A tabela dizia `['action2', 'PULAR']` e `['action1', 'CORRER / INTERAGIR']`: vocabulário de plataforma
    // dentro do motor E num idioma só, à frente de uma criança, num ficheiro que o pilar 3 obriga a ser
    // localizável. Agora cada entrada é uma posição e nada mais.
    for (const passo of PADWIZ_ORDER) expect(typeof passo).toBe('string');
    expect(PADWIZ_ORDER.some((p) => /[a-z]{2,}\s/.test(p))).toBe(false); // nenhuma frase
  });
});

// ---------------------------------------------------------------------------------------------
// initGamepad — o wizard (máquina de estados) via ctx totalmente injetado, sem document/navigator reais
// ---------------------------------------------------------------------------------------------

describe('initGamepad — wizard: fluxo completo', () => {
  let ctx; let api;
  beforeEach(() => { ctx = buildCtx(); api = initGamepad(ctx); });

  it('[Right] identifica o controle no 1º botão pressionado, espera soltar, e faz os passos NOMEADOS até fechar sozinho', () => {
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

    // ⚠️ PERCORRE AS POSIÇÕES QUE O JOGO NOMEIA, e não a lista inteira. O preset falso deste ficheiro
    // nomeia nove das quatorze, e o assistente SALTA as cinco que este jogo não usa — perguntar por elas
    // produziria um passo mudo. Até 2026-09-06 a lista tinha exatamente nove entradas e as duas coisas
    // coincidiam por acidente; agora não coincidem, e é a primeira que importa.
    const NOMEADAS = PADWIZ_ORDER.filter((a) => ctx.rotuloDaAcao(a) !== null);
    expect(NOMEADAS).toHaveLength(9);
    for (let i = 0; i < NOMEADAS.length; i++) {
      ctx.setPads([makePad({ id: 'DirectInput X', index: 0, pressed: [i] })]);
      api.padWizTick(); // captura o botão i para o passo atual
      if (i < NOMEADAS.length - 1) {
        expect(api.getPadWiz().map[NOMEADAS[i]]).toEqual({ b: i });
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
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ b: 7 });
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);

    // continua segurando o MESMO botão 7 por vários ticks: não deve capturar o passo 1 nem avançar
    for (let i = 0; i < 10; i++) api.padWizTick();
    expect(api.getPadWiz().step).toBe(1);
    expect(api.getPadWiz().release).toBe(true);
    expect(api.getPadWiz().map[PADWIZ_ORDER[1]]).toBeUndefined();

    // solta -> libera o prompt do passo 1; pressiona o MESMO botão 7 de novo -> É aceito para o novo passo
    // (o original não deduplica bindings entre ações — documentado, não é bug desta extração)
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [] })]);
    api.padWizTick(); // release=false, prompta o passo 1
    expect(api.getPadWiz().release).toBe(false);
    ctx.setPads([makePad({ id: 'pad-rep', index: 0, pressed: [7] })]);
    api.padWizTick();
    expect(api.getPadWiz().map[PADWIZ_ORDER[1]]).toEqual({ b: 7 });
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
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ b: 3 });
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
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ ax: 2, s: 1 });
  });
  it('[Right] eixo que salta e FICA CONSTANTE por 8 ticks -> binding de hat {av,v}', () => {
    const ctx = buildCtx(); const api = initGamepad(ctx);
    api.openPadWizFor(makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] }));
    ctx.setPads([makePad({ id: 'pad-hat', index: 0, pressed: [], axes: [0, 0, 0, 0, 0, 0, 1.3, 1.3] })]);
    api.padWizTick(); // passo 0
    // mesmo detalhe: 1 tick para DETECTAR (inicia o rastreio) + 8 ticks de processamento (ticks>=8)
    for (let i = 0; i < 9; i++) { ctx.setPads([makePad({ id: 'pad-hat', index: 0, axes: [0, 0, 0.7143, 0, 0, 0, 1.3, 1.3] })]); api.padWizTick(); }
    expect(api.getPadWiz().map[PADWIZ_ORDER[0]]).toEqual({ av: 2, v: 0.7143 });
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
  // nada aqui reagisse.
  //
  // 🔴 E DURANTE UM TEMPO ELE MEDIU O VÁCUO, o que só se soube em 2026-09-09 por mutação. O comentário dizia
  // «`run` no mapa padrão é o botão 5 (ombro direito)» e o caso premia o 5 — mas o **ADR-0086 tirou o `run`
  // dos ombros**, e o próprio `input/gamepad` regista isso ao lado da tabela: «`action1` perde dois dos seus
  // três». Com o botão 5, `runEdge` fica falso por não haver borda NENHUMA, e o caso passava sem exercitar a
  // guarda: apagar `edgeAllowed` do laço do controle deixava-o VERDE.
  // 📌 O botão certo é o 2, que é o que o caso [Inverse] logo abaixo já prova levantar `runEdge` sem o Fácil.
  it('[Right] Fácil: o botão de correr do controle NÃO levanta runEdge (mesma regra do teclado e do toque)', () => {
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge, 'a guarda do Fácil não está a valer no caminho do controle').toBe(false);
  });
  it('[Inverse] SEM Fácil, o mesmo botão levanta runEdge — prova que a guarda é o `easy`, não o mapa', () => {
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge).toBe(true);
  });
  it('🎯 a aresta do CONTROLE chega ao autómato, por assento (ADR-0113 cláusula 4)', () => {
    // 🔴 Medido em 2026-09-09: `playerEdge` tinha ZERO chamadores em produção, logo a alternância lida
    // era a do TECLADO mesmo com o controle na mão. ⚠️ E o gamepad era o único transporte que já sobrevivia
    // identificável (passa por `padCur`, não pelo conjunto de teclas) — o que tornava esta falta invisível:
    // o módulo sabe de que controle veio a aresta, e o autómato não sabia.
    const p = makePlayer({ pad: 0, easy: false });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(ctx.calls.arestas, 'a aresta do controle não chegou ao autómato').toEqual([[0, 'gamepad']]);

    api.pollPads(); // mesmo botão ainda premido: não há borda nova, e não há aresta nova
    expect(ctx.calls.arestas.length, 'segurar o botão contou como uma segunda aresta').toBe(1);
  });

  it('⚠️ e ela conta MESMO com o Modo Fácil a filtrar a bandeira — a criança carregou no botão', () => {
    // 📌 A distinção que esta linha compra: ler a mesma condição do `p[flag]` deixaria uma criança em Modo
    // Fácil com a alternância do TECLADO enquanto joga no controle. O Fácil decide o que o JOGO faz com o
    // botão; não decide que aparelho está na mão dela.
    const p = makePlayer({ pad: 0, easy: true });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    // 📌 O BOTÃO 2 e não o 5, e a escolha é medida: é o botão que o caso [Inverse] acima prova levantar
    // `runEdge` sem o Fácil. Com o 5, `runEdge` fica falso por não haver borda NENHUMA, e o caso mediria o
    // vazio — que é o defeito que ele existe para apanhar noutro sítio.
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [2] })]);
    api.pollPads();
    expect(p.runEdge, 'o Fácil devia ter filtrado a bandeira').toBe(false);
    expect(ctx.calls.arestas, 'o aparelho em uso passou a depender do Modo Fácil').toEqual([[0, 'gamepad']]);
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

  /*
   * ============== OS CINCO RAMOS QUE NINGUÉM VIA (2026-09-22, ADR-0221 passo 7c) ==============
   *
   * 🔴 ESTES CASOS NASCERAM DE UMA MEDIÇÃO E NÃO DE UMA LEITURA. O `pollPads` tem profundidade 11 e ia ser reestruturado; antes
   * de lhe tocar, cada um dos nove ramos de topo foi DESLIGADO, um de cada vez, para perguntar à suíte se ela reparava.
   * 📏 Quatro reprovaram (assistente, título, controle sem assento, modal) e **cinco ficaram VERDES**: o modo de demonstração,
   * o modal de vitória, a navegação do cartão de pausa, a barra rápida e o START que pausa. Cinco ramos que se podiam apagar
   * inteiros com a suíte verde — e um deles, a barra, é o que impede o botão de virar acção de jogo.
   *
   * 📌 Reestruturar código que nenhum caso vê não é refactor, é reescrita às cegas. Estes cinco vêm primeiro, e é por isso que
   * eles afirmam o EFEITO de cada ramo e não a forma dele: a seguir a forma vai mudar.
   */
  it('🔴 [Right] na DEMONSTRAÇÃO, um botão de controle encerra a demo e mais nada acontece', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], isAttractActive: () => true });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('title');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]);
    api.pollPads();
    expect(ctx.calls.stopAttract, 'o botão do controle não encerrou a demonstração').toBe(1);
    expect(ctx.calls.navTitle, 'a demo encerrou E o menu andou: a criança perdeu uma escolha que não viu').toHaveLength(0);
  });

  it('🔴 [Right] com a tela de VITÓRIA aberta, o START carrega «jogar de novo» e não chega ao jogo', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.dom.get('#win-overlay').hidden = false;
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]); // START
    api.pollPads();
    expect(ctx.dom.get('#btn-again').clicked, 'o START não fechou a tela de vitória').toBe(1);
    expect(ctx.calls.setPhase, 'o mesmo START que fechou a vitória também pausou o jogo por baixo dela').toEqual([]);
  });

  it('🔴 [Right] no CARTÃO DE PAUSA, o direcional navega o menu do próprio assento', () => {
    const menu = { hidden: false };
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })], getPauseMenu: () => menu });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('paused');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [13] })]); // D-pad baixo
    api.pollPads();
    expect(ctx.calls.navPause, 'o cartão de pausa ficou surdo ao controle').toHaveLength(1);
    expect(ctx.calls.navPause[0][0]).toBe(menu);
    expect(ctx.calls.navPause[0][1], 'o menu navegado não é o do assento deste controle').toBe(0);
    expect(ctx.calls.navPause[0][2].down).toBe(true);
  });

  it('🔴 [Right] no cartão de pausa, o START retoma o jogo', () => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('paused');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]);
    api.pollPads();
    expect(ctx.calls.setPhase, 'o START não retomou — a pausa aberta pelo controle não fecha pelo controle').toEqual(['playing']);
  });

  it('🔴 [Right] na BARRA RÁPIDA, o botão dirige a barra e NÃO vira acção de jogo (ADR-0044 item 7)', () => {
    // ⚠️ É a segunda expectativa que carrega o assunto: enquanto o modo está ligado, nada deste controle é de jogo. Sem ela,
    // uma barra que navegasse e deixasse o personagem saltar ao mesmo tempo passaria.
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p], naBarra: new Set([0]) });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [0] })]); // o botão de pular
    api.pollPads();
    expect(ctx.calls.navBar, 'a barra rápida não recebeu o controle').toHaveLength(1);
    expect(ctx.calls.navBar[0][0]).toBe(0);
    expect(ctx.calls.navBar[0][1].yes).toBe(true);
    expect(p.jumpEdge, 'o mesmo botão dirigiu a barra E fez o personagem saltar').toBe(false);
  });

  it('🔴 [Right] a jogar, o START pausa e diz QUEM pausou', () => {
    const p = makePlayer({ pad: 0 });
    const ctx = buildCtx({ players: [p] });
    const api = initGamepad(ctx);
    ctx.setPhaseValue('playing');
    ctx.setPads([makePad({ id: 'std', index: 0, mapping: 'standard', pressed: [9] })]);
    api.pollPads();
    expect(ctx.calls.setPhase, 'o START do controle não pausa').toEqual(['paused']);
    expect(ctx.calls.setPauseActor, 'pausou sem dizer de quem é o cartão que abre').toEqual([0]);
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

// ===================================================================================================
// O MODO DE UM BOTÃO TEM DE VALER NO CONTROLE TAMBÉM (issue #120)
// ===================================================================================================
// ⚠️ O DEFEITO QUE ESTE BLOCO EXISTE PARA FECHAR, medido em 2026-09-07: `grep oneButton` em
// `input/gamepad.ts` devolvia ZERO. `input/keydown.ts` honra a empatia motora — quando uma tecla de jogo
// chega e o modo está ligado, TODAS as outras teclas de jogo seguras são soltas (`releaseKeys`, :407) —
// e o `pollPads` não tinha nada equivalente.
//
// ⚠️ E A CRIANÇA NÃO TEM COMO SABER. Ela liga o modo porque precisa dele, e ele funciona — até alguém
// ligar um controle. Sem erro, sem aviso, sem sintoma: as definições dizem que está ligado e o aparelho
// comporta-se como se não estivesse. É o pilar 2 do ADR-0010 a falhar em silêncio, e é mais velho que o
// registro que o encontrou.
//
// ⚠️ AS DIREÇÕES CONTAM, e é isso que torna a regra o que ela é. No teclado, `isGameKeyCode` inclui as
// teclas de `p.ctrl`, que são as quatro direções — então andar e pular NÃO coexistem com o modo ligado.
// Um filtro que poupasse as direções seria mais confortável e simularia outra deficiência.
describe('empatia motora no CONTROLE: um botão por vez (issue #120)', () => {
  const nada = {
    left: false, right: false, up: false, down: false,
    action1: false, action2: false, action3: false, action4: false,
    leftShoulder: false, leftTrigger: false, rightShoulder: false, rightTrigger: false,
    start: false, select: false,
  };
  const ligadas = (a) => Object.keys(a).filter((k) => a[k] === true && !k.startsWith('_')).sort();

  it('[Zero] com o modo DESLIGADO nada é filtrado — duas posições continuam a valer', () => {
    const atual = { ...nada, right: true, action2: true };
    expect(ligadas(oneButtonAtOnce(nada, atual, false))).toEqual(['action2', 'right']);
  });

  it('⚠️ [Right] com o modo ligado, duas ao mesmo tempo viram UMA', () => {
    const atual = { ...nada, right: true, action2: true };
    expect(ligadas(oneButtonAtOnce(nada, atual, true))).toHaveLength(1);
  });

  it('⚠️ [Right] a que já estava em baixo MANTÉM-SE — a nova não a rouba', () => {
    // No teclado a chegada nova ganha porque HÁ uma chegada. Num controle lido por sondagem não há
    // "nova": há um retrato. Manter a que já valia é o que faz o botão de correr não ser cortado
    // porque o polegar encostou noutro — e é a leitura que o ADR-0077 dá ao segurar.
    const antes = { ...nada, action2: true };
    const atual = { ...nada, action2: true, right: true };
    expect(ligadas(oneButtonAtOnce(antes, atual, true))).toEqual(['action2']);
  });

  it('⚠️ [Right] quando a activa solta, a próxima em baixo assume', () => {
    const antes = { ...nada, action2: true };
    const atual = { ...nada, right: true };
    expect(ligadas(oneButtonAtOnce(antes, atual, true))).toEqual(['right']);
  });

  it('⚠️ [Interface] as DIREÇÕES contam — andar e pular não coexistem', () => {
    const atual = { ...nada, left: true, action2: true };
    const saida = oneButtonAtOnce(nada, atual, true);
    expect(ligadas(saida), 'um filtro que poupe as direções simula outra deficiência').toHaveLength(1);
  });

  it('[Zero] nada apertado continua nada apertado', () => {
    expect(ligadas(oneButtonAtOnce(nada, { ...nada }, true))).toEqual([]);
  });

  it('[Interface] START e SELECT NÃO são cortados — pausar é a saída, não uma jogada', () => {
    // Cortar o START prenderia a criança dentro da partida: é o mesmo raciocínio do ADR-0044 («a saída
    // primeiro») e da armadilha de foco do ADR-0090. Uma acomodação que tranca não é acomodação.
    const atual = { ...nada, action2: true, start: true, select: true };
    const saida = oneButtonAtOnce(nada, atual, true);
    expect(saida.start).toBe(true);
    expect(saida.select).toBe(true);
  });

  it('[Interface] não muta o retrato que recebeu', () => {
    const atual = { ...nada, right: true, action2: true };
    const copia = { ...atual };
    oneButtonAtOnce(nada, atual, true);
    expect(atual).toEqual(copia);
  });
});

// ⚠️ E O FIO TEM DE ESTAR LIGADO, não só existir. O ADR-0090 registra três facilidades que a engine
// MONTAVA e nunca ligava — «ausência seria visível; o objeto TEM uma `nav`, o laço TEM um campo
// `aoFalhar`, e os dois parecem prontos». Uma função pura testada e nunca chamada é a quarta.
describe('e o modo de um botão está LIGADO no laço de sondagem (issue #120)', () => {
  const comPad = (pressed) => {
    const ctx = buildCtx({ players: [makePlayer({ pad: 0 })] });
    ctx.setPads([makePad({ pressed })]);
    return ctx;
  };

  it('⚠️ [Right] com o modo ligado, duas posições no mesmo quadro deixam UMA no estado', () => {
    estado.setOneButtonValue(true);
    const ctx = comPad([0, 15]); // action2 (A) + D-pad direita
    initGamepad(ctx).pollPads();
    const ligadas = Object.keys(padCur[0]).filter((k) => padCur[0][k] === true && !k.startsWith('_'));
    expect(ligadas, 'o pad ignorou a empatia motora').toHaveLength(1);
  });

  it('[Zero] e com o modo desligado as duas continuam a valer', () => {
    estado.setOneButtonValue(false);
    const ctx = comPad([0, 15]);
    initGamepad(ctx).pollPads();
    const ligadas = Object.keys(padCur[0]).filter((k) => padCur[0][k] === true && !k.startsWith('_'));
    expect(ligadas.length).toBeGreaterThan(1);
  });
});

// ==========================================================================================================
// ⚠️ O QUE O ASSISTENTE DE MAPEAMENTO FALA PASSA POR `t()` — TODO ELE, E NÃO SÓ O QUE TEM ACENTO (#123)
//
// Este é um gate de FONTE dentro de um ficheiro de comportamento, e a razão é medida: o crivo de
// `tests/engine-i18n.node.test.js` procura prosa por ACENTO ou por palavra funcional de pt-BR, e o próprio
// cabeçalho dele declara o que isso deixa passar. Neste módulo deixou passar três de cinco —
// `' — aperte: '`, `'Mapeados: '` e `'. Agora SOLTE tudo.'` não têm acento nem palavra da lista.
//
// A propriedade aqui não depende de como a frase se escreve: **tudo o que chega ao `wizSay` vem de `t(`**.
// O `wizSay` é o único caminho pelo qual este assistente fala — ele escreve no `#padwiz-prompt` E anuncia ao
// leitor de tela —, então prendê-lo prende as duas saídas de uma vez.
//
// ⚠️ E há uma causa a lembrar: o parâmetro do `wizSay` chamava-se `t` e SOMBREAVA o `t` do `core/i18n` dentro
// da função inteira. Não é um esquecimento que se evite com atenção; é um nome que fecha a porta sem avisar.
// O caso `[Interface]` abaixo é o que impede o nome de voltar.
//
// MUTAÇÕES CONFERIDAS:
//   · devolvendo `wizSay('Aperte QUALQUER botão…')` ao lugar → "[Zero] tudo o que o assistente fala" reprova
//     nomeando a linha. (E o crivo do `engine-i18n` também reprova nesta, porque ela tem acento.)
//   · devolvendo `wizSay((padWiz.step + 1) + ' de ' + …)` → "[Zero]" reprova, e o `engine-i18n` TAMBÉM.
//     ⚠️ Eu tinha previsto que não, e a previsão estava errada: aquela linha contém `' de '`, e `de` é
//     palavra funcional da lista do crivo. O que passa por ele é o pedaço `' — aperte: '` sozinho.
//   · devolvendo `'Mapeados: ' + (…)` ao rodapé de progresso → "[Right] e o rodape de progresso" reprova e
//     o `engine-i18n` fica VERDE. Este é o buraco medido em vez de suposto: sem acento e sem palavra
//     funcional, uma frase inteira atravessa o crivo de prosa sem tocar em nada.
//   · renomeando o parâmetro do `wizSay` de volta para `t` → "[Interface] o `wizSay` não sombreia" reprova.
// ==========================================================================================================
describe('input/pad-wizard — o assistente de mapeamento fala por t(), sem excepção (#123, pilar 3)', () => {
  // 📌 The wizard moved to `input/pad-wizard` (issue #182): its sentences are said THERE, through `ctx.dizer` and
  // `ctx.progresso`, and the host only shows them. Each rule below first finds its subject, so a move cannot leave it green
  // measuring nothing.
  const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'input', 'pad-wizard.ts'), 'utf8')
    .split(String.fromCharCode(13)).join('');
  const CODIGO = FONTE.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => !/^\s*(\/\/|\*|\/\*)/.test(l));

  it('⚠️ [Zero] tudo o que o assistente fala vem de t( — nenhuma chamada com literal', () => {
    const falas = CODIGO.filter(([, l]) => /ctx\.dizer\s*\(/.test(l));
    expect(falas.length, 'ninguem fala pelo assistente; rever este caso').toBeGreaterThan(0);
    const crus = falas
      .filter(([, l]) => !/ctx\.dizer\s*\(\s*t\s*\(/.test(l) && !/ctx\.dizer\s*\(\s*frase\s*\)/.test(l))
      .map(([n, l]) => `${n}: ${l.trim()}`);
    expect(crus, 'o assistente fala uma frase que nao passa por t()').toEqual([]);
    // the one `ctx.dizer(frase)` is `comecar`'s, and every caller of `comecar` hands it a `t(`
    const comecos = CODIGO.filter(([, l]) => /comecar\s*\(/.test(l) && !/function comecar/.test(l));
    expect(comecos.length).toBeGreaterThan(0);
    for (const [n, l] of comecos) expect(l, `linha ${n}`).toMatch(/t\s*\(\s*'pad\.wiz\./);
  });

  it('[Right] e o rodape de progresso tambem — ou apaga, ou passa por t(', () => {
    const escritas = CODIGO.filter(([, l]) => /ctx\.progresso\s*\(/.test(l));
    expect(escritas.length, 'ninguem escreve no rodape de progresso; rever este caso').toBeGreaterThan(0);
    const crus = escritas
      .filter(([, l]) => !/ctx\.progresso\s*\(\s*''\s*\)/.test(l) && !/ctx\.progresso\s*\(\s*t\s*\(/.test(l))
      .map(([n, l]) => `${n}: ${l.trim()}`);
    expect(crus, 'o rodape de progresso recebe texto que nao passa por t()').toEqual([]);
    expect(escritas.some(([, l]) => /t\s*\(\s*'pad\.wiz\.mapped'/.test(l)),
      'a frase do progresso deixou de usar a chave').toBe(true);
  });

  it('⚠️ [Interface] nada no assistente sombreia o t do core/i18n', () => {
    // A parameter or a local named `t` makes translating impossible where it is in scope — and nothing errors.
    expect(FONTE, 'o assistente deixou de importar t').toMatch(/import \{ t \} from '\.\.\/core\/i18n\.js'/);
    const sombras = CODIGO.filter(([, l]) => /\(\s*t\s*[:,)]|\bconst t\b|\blet t\b/.test(l)).map(([n, l]) => `${n}: ${l.trim()}`);
    expect(sombras, 'um t local fecha a porta outra vez').toEqual([]);
  });

  it('[Interface] as cinco chaves existem nos tres dicionarios', () => {
    const CHAVES = ['pad.wiz.step', 'pad.wiz.mapped', 'pad.wiz.pressAny', 'pad.wiz.detected', 'pad.wiz.releaseAll'];
    for (const lang of ['pt', 'en', 'es']) {
      const d = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', lang + '.ts'), 'utf8');
      for (const k of CHAVES) expect(d, `${lang} nao tem ${k}`).toContain("'" + k + "'");
    }
  });
});
