// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/pause-icons — a CASCA de DOM (project BROWSER: buildScreenPause usa document.createElement +
// innerHTML, coisa que o project node não consegue exercitar). A lógica pura (rótulos, ciclos, plano do TEA,
// markup como string) está em pause-icons.node.test.js e NÃO é repetida aqui — aqui provamos só o que só o
// navegador prova: a árvore construída, a delegação de clique, e a legenda que segue o foco/mouse.
//
// `players`/`numPlayers` são os módulos REAIS (core/state.ts) — os mesmos bindings vivos que o
// game.js usa; o resto do ctx é falso (spies).
import { describe, it, expect, beforeEach } from 'vitest';
import { PAUSE_ICONS, initPauseIcons } from '../app/js/ui/pause-icons.js';
import { migrarVisual, PADRAO } from '../app/js/render/viz-axes.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const PM_BTNS = [
  { act: 'resume', lbl: '▶ Continuar' },
  { act: 'letra', lbl: '🔠 ABC', letra: true },
  { act: 'quit', lbl: '🚪 Sair do jogo' },
];
const PM_OPTS = [
  { act: 'pmback' },
  { act: 'caa' },
];
const QL_NAME = { 1: 'pré-silábico', 2: 'silábico', 3: 'silábico-alfabético', 4: 'escritor', 5: 'escritor cego' };
const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];
const RM_CHAR = [{ prop: 'rmWalk' }, { prop: 'rmBreath' }, { prop: 'rmFlavor' }];

function makeCtx(over = {}) {
  const said = [], alerted = [];
  const state = {
    modoCego: false, libras: false, pauseActor: -1, screens: [], ran: [],
    audioCat: { tts: { on: false, vol: 1 }, ambient: { on: true, vol: 1 }, music: { on: true, vol: 1 }, earcons: { on: true, vol: 1 }, other: { on: true, vol: 1 }, interact: { on: true, vol: 1 } },
    rm: { parallax: false, decor: false, items: false, particles: false },
  };
  const acts = {
    resume: () => state.ran.push('resume'),
    letra: () => state.ran.push('letra'),
    // 'quit' de propósito AUSENTE: prova que um data-act sem entrada na tabela não quebra o clique.
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    srSay: (m) => said.push(m),
    srAlert: (m) => alerted.push(m),
    pmButtons: PM_BTNS,
    optionsButtons: PM_OPTS,
    // O RÓTULO DINÂMICO chega pronto do jogo (item 19). Este fixture não tem botão de nível, então `null` é
    // a resposta certa — e é a que exercita o caminho estático, que é o que os casos daqui medem.
    dynLabel: () => null,
    getPauseActs: () => acts,
    setPauseActor: (i) => { state.pauseActor = i; },
    getPauseScreens: () => state.screens,
    // As BARRAS RÁPIDAS (ADR-0044, item 7): desde que elas saíram do cartão, é aqui que os ícones vivem, e é
    // por aqui que `reflectPauseIcons` os encontra. Os testes que exercitam o reflexo alimentam `state.bars`;
    // os que só olham o markup do cartão deixam a lista vazia — e o reflexo então não faz nada, corretamente.
    getA11yBars: () => state.bars || state.screens,
    getModoCego: () => state.modoCego,
    setModoCego: (on) => { state.modoCego = on; },
    getAudioCat: () => state.audioCat,
    setCatGain: () => {},
    reflectTtsPanel: () => {},
    reflectTtsPanelEnabled: false,
    isLibrasOn: () => state.libras,
    toggleLibras: () => { state.libras = !state.libras; },
    rm: state.rm, rmKeys: RM_KEYS, rmChar: RM_CHAR, saveRM: () => {},
    setToggleMove: (i, on) => { if (players[i]) players[i].toggleMove = on; },
    setPlayerViz: (i, mode) => { if (players[i]) { players[i].viz = mode; players[i].visual = migrarVisual(mode); } },
    // Os escritores POR EIXO (#104): cada icone escreve no seu, e o outro fica onde estava.
    setTemaDoJogador: (i, tema) => { if (players[i]) players[i].visual = { ...(players[i].visual ?? PADRAO), tema }; },
    setCorrecaoDoJogador: (i, correcao) => { if (players[i]) players[i].visual = { ...(players[i].visual ?? PADRAO), correcao }; },
    // Este duplo é de forma de PLATAFORMA — segura direcção — logo a barra dele tem o `altmove` (ADR-0115).
    // A metade que prova a AUSÊNCIA vive no project node, onde a regra mora.
    seguraTeclas: () => true,
    // 📌 O 11.º ícone (ADR-0149) só é montado por quem sabe andar no ciclo de tipografia — a mesma regra dos
    // dois escritores visuais acima. Este ficheiro mede as INVARIANTES da barra montada e não o filtro, que
    // vive no project node; sem esta linha ele mediria uma barra com um ícone a menos.
    ciclarTipografia: () => 'Atkinson Hyperlegible',
    ...over,
  };
  return { ctx, state, said, alerted };
}

function setPlayers(list) {
  players.length = 0;
  // DERIVA o estado de dois eixos da chave antiga — mesma regra do espelho que a producao mantem (#104).
  list.forEach((p) => players.push(
    p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrarVisual(p.viz) } : p,
  ));
  setNumPlayersValue(list.length || 1);
}

beforeEach(() => {
  document.body.innerHTML = '';
  setPlayers([{ viz: 'normal', toggleMove: false }]);
});

// Monta uma tela de pausa e a PLUGA no documento (o clique precisa de árvore de verdade p/ o closest()).
/**
 * Monta a tela `i` INTEIRA: a barra rápida e o cartão de pausa, irmãos, como o `ui/hud` os pendura.
 *
 * Desde o item 7 do ADR-0044 os ícones NÃO moram mais dentro do cartão — montar só a pausa deixaria metade
 * dos casos deste arquivo medindo uma árvore que a produção não tem.
 */
/**
 * Os itens VISÍVEIS do cartão — os .pm-btn que não estão hidden.
 *
 * ⚠️ VISÍVEIS e não PRESENTES, e a diferença é a correcção de 2026-09-08: o cartão passou a montar a lista
 * inteira e a ESCONDER o que este jogo não acciona, em vez de filtrar no arranque. Filtrar cedo decidia com
 * uma tabela que o próprio campo declara chegar TARDE, e o item cuja acção só existisse depois do boot nunca
 * mais aparecia. Para o §5 o que conta é o que a criança VÊ, e hidden não é focável nem lido.
 */
// 🔴 DESDE O ADR-0161 (2026-09-12) nenhum item se esconde: o que o jogo não acciona fica TRAVADO (`aria-disabled`) e diz o
// motivo. «Vivo» passa a ser «não escondido E não travado» — a pergunta do §5 («este item faz alguma coisa?») continua
// a mesma; o que mudou é a resposta visível para o «não».
const actsVisiveis = (sp) => [...sp.querySelectorAll('.pm-btn')]
  .filter((b) => !b.hidden && b.getAttribute('aria-disabled') !== 'true').map((b) => b.dataset.act);

function mount(i = 0, over = {}) {
  const { ctx, state, said, alerted } = makeCtx(over);
  const api = initPauseIcons(ctx);
  const bar = api.buildQuickBar(i);
  const sp = api.buildScreenPause(i);
  document.body.append(bar, sp);
  state.screens = [sp];
  state.bars = [bar];
  return { api, sp, bar, ctx, state, said, alerted };
}

describe('buildScreenPause — a árvore construída', () => {
  it('nasce ESCONDIDA, com a classe e o dono marcados (o menu é por tela, não global)', () => {
    const { sp, bar } = mount(2);
    expect(sp.className).toBe('screen-pause');
    expect(sp.hidden).toBe(true);
    expect(sp.dataset.player).toBe('2');
  });

  it('o cartão é um diálogo MODAL nomeado pelo jogador dono', () => {
    const { sp, bar } = mount(1);
    const card = sp.querySelector('.pause-card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-label')).toBe('Menu de pausa do jogador 2');
  });

  it('a barra de ícones é um group nomeado, com um botão por ícone declarado', () => {
    const { bar } = mount();
    const grupo = bar.querySelector('.pause-icons');
    expect(grupo.getAttribute('role')).toBe('group');
    expect(grupo.getAttribute('aria-label')).toBe('Atalhos de acessibilidade');
    expect(grupo.querySelectorAll('.pi-btn')).toHaveLength(PAUSE_ICONS.length);
  });

  it('INVARIANTE: todo .pi-btn tem aria-label NÃO-VAZIO, type=button e data-pi', () => {
    const { sp, bar } = mount();
    const btns = [...bar.querySelectorAll('.pi-btn')];
    expect(btns).toHaveLength(PAUSE_ICONS.length);
    for (const b of btns) {
      expect((b.getAttribute('aria-label') || '').trim().length).toBeGreaterThan(0);
      expect(b.getAttribute('type')).toBe('button');
      expect(b.dataset.pi).toBeTruthy();
    }
  });

  it('os ícones EM CONSTRUÇÃO se declaram como tal — no rótulo e na classe', () => {
    const { sp, bar } = mount();
    for (const ic of PAUSE_ICONS) {
      const b = bar.querySelector(`.pi-btn[data-pi="${ic.k}"]`);
      expect(b.classList.contains('pi-soon')).toBe(!!ic.soon);
      expect(b.getAttribute('aria-label').includes(', em construção')).toBe(!!ic.soon);
    }
  });

  it('a legenda dos ícones é uma região aria-live "polite" e começa VAZIA', () => {
    const { sp, bar } = mount();
    const cap = bar.querySelector('.pause-icons-cap');
    expect(cap.getAttribute('aria-live')).toBe('polite');
    expect(cap.textContent).toBe('');
  });

  it('🔴 `quit` sem tabela FICA no menu, travado e com o motivo — não escondido (ADR-0161, supersede o §5 aqui)', () => {
    const { sp } = mount();
    const quit = sp.querySelector('.pause-menu .pm-btn[data-act="quit"]');
    expect(quit.hidden, 'the locked item vanished: the card changes shape per game again').toBe(false);
    expect(quit.getAttribute('aria-disabled')).toBe('true');
    expect((quit.dataset.motivo ?? '').length, 'a locked item without its reason').toBeGreaterThan(0);
  });

  it('⚠️ o menu só OFERECE vivo o que o jogo ACCIONA — `quit` sem tabela fica travado (ADR-0106 §5 → ADR-0161)', () => {
    // ⚠️ ESTE CASO DIZIA O CONTRÁRIO, E O CONTRÁRIO ERA O DEFEITO ESCRITO COMO GARANTIA. Ele esperava
    // `['resume','letra','quit']`, e o fixture omite `quit` da tabela DE PROPÓSITO — o comentário lá diz que
    // isso «prova que um data-act sem entrada na tabela não quebra o clique». Não quebrava mesmo: o despacho
    // faz `if (fn) fn()`. O que ficava institucionalizado é que o menu MOSTRA um botão que não faz nada, e
    // quem navega por leitor de tela ouve um item que não existe.
    const { sp } = mount();
    const menu = sp.querySelector('.pause-menu');
    expect(menu.getAttribute('role')).toBe('menu');
    const items = [...menu.querySelectorAll('.pm-btn')].filter((b) => !b.hidden && b.getAttribute('aria-disabled') !== 'true');
    expect(items.map((b) => b.dataset.act)).toEqual(['resume', 'letra']);
    for (const b of items) expect(b.getAttribute('role')).toBe('menuitem');
  });

  it('o botão de rótulo DINÂMICO (ABC) não ganha data-i18n — senão o applyDom o apagaria', () => {
    const { sp } = mount();
    const letra = sp.querySelector('.pm-btn[data-act="letra"]');
    expect(letra.classList.contains('pm-letra')).toBe(true);
    expect(letra.hasAttribute('data-i18n')).toBe(false);
    // O contraste continua a ser feito, com um item que o jogo ACCIONA — antes era o `quit`, que já não monta.
    expect(sp.querySelector('.pm-btn[data-act="resume"]').getAttribute('data-i18n')).toBe('pause.resume');
  });

  it('o título traduz pelo i18n REAL (pt) e é marcado para retradução', () => {
    const { sp, bar } = mount();
    const h = sp.querySelector('h2 span[data-i18n="pause.title"]');
    expect(h.textContent).toBe('Pausado');
  });

  it('UM jogador: sem sufixo no título. MUITOS: com "· Jogador N"', () => {
    const um = mount().sp;
    expect(um.querySelector('h2').textContent).not.toContain('Jogador');
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const dois = mount(1).sp;
    expect(dois.querySelector('h2').textContent).toContain('· Jogador 2');
  });

  it('o rodapé de legenda de sim/não existe e NÃO é mais escondido do leitor (ADR-0044, item 4)', () => {
    // A versão anterior deste caso afirmava o contrário, e afirmava com um motivo escrito — "é dica visual de
    // botão físico". O motivo estava errado pela metade: a dica é visual, mas a INFORMAÇÃO ("qual botão
    // confirma") é de todo mundo, e a XAG 106 manda narrá-la. Quem fica mudo agora são os chips, porque `✕`
    // lido em voz alta é "sinal de multiplicação"; a frase equivalente em palavras vive num `.sr-only`.
    const { sp, bar } = mount();
    const lg = sp.querySelector('.pause-legend');
    expect(lg.getAttribute('aria-hidden')).toBe(null);
    expect(lg.textContent).toBe(''); // nasce vazia: quem a preenche é o `renderPauseLegend` da raiz
  });
});

describe('buildScreenPause — delegação de clique nos .pm-btn', () => {
  it('clicar num item registra o jogador que agiu E roda a ação da tabela', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { sp, bar, state } = mount(1);
    sp.querySelector('.pm-btn[data-act="resume"]').click();
    expect(state.pauseActor).toBe(1);
    expect(state.ran).toEqual(['resume']);
  });

  it('⚠️ EXCEÇÃO: um `data-act` desconhecido NO DOM registra o ator e não lança', () => {
    // A robustez continua a valer e é afirmada; o que mudou é o CENÁRIO. O menu já não monta item sem acção
    // (o caso acima), então um `data-act` órfão só chega aqui vindo de fora — markup de um hospedeiro, uma
    // extensão, um teste. Nesse caso a pausa não pode cair: regista quem carregou e não faz mais nada.
    const { sp, state } = mount(0);
    const menu = sp.querySelector('.pause-menu');
    const intruso = document.createElement('button');
    intruso.className = 'pm-btn';
    intruso.dataset.act = 'inexistente';
    menu.appendChild(intruso);
    expect(() => intruso.click()).not.toThrow();
    expect(state.pauseActor).toBe(0);
    expect(state.ran).toEqual([]);
  });

  it('⚠️ [Zero] sem tabela de ações NENHUMA, o cartão não oferece porta que não abre', () => {
    // O caso extremo do §5, e o que ele protege é o `options`: ele é accionado pela ENGINE, então sobrevive a
    // um filtro item-a-item — e abriria um submenu vazio cuja única saída (`pmback`) desapareceu com ele.
    //
    // ⚠️ E USA A LISTA PADRÃO DA ENGINE de propósito (`pmButtons: undefined`). A primeira versão deste caso
    // usava a lista do fixture, que não tem `options` nenhum — então ele passava por VÁCUO, e a mutação que
    // tira a regra da porta SOBREVIVEU. Um caso sobre um item que a lista não contém não afirma nada.
    const { sp } = mount(0, { pmButtons: undefined, optionsButtons: undefined, getPauseActs: () => ({}) });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados, 'a porta para o submenu vazio ficou').not.toContain('options');
    expect(actsMontados.filter((a) => a !== 'acessibilidade' && a !== 'pmback')).toEqual([]);
  });

  it('⚠️ [Right] uma acção que chega DEPOIS do boot faz o item APARECER na abertura seguinte', () => {
    // ⚠️ ESTE CASO É A CORRECÇÃO DE 2026-09-08, e o defeito que ele prende foi achado a ler e não a testar.
    // O cartão era FILTRADO no `buildScreenPause`, e o `getPauseActs` é um getter precisamente porque a
    // tabela chega TARDE — «`pauseActs` is a `const` declared far below the init site», diz o próprio campo.
    // O `createGame` monta durante o próprio `createGame(...)`, então um consumidor que siga esse padrão
    // documentado perdia PARA SEMPRE todo item cuja acção só existiu depois do boot.
    //
    // 📌 O `ui/shell` chama `reflectPauseIcons()` quando a fase vira `pause-menu` — quando a pausa ABRE —, e
    // é aí que a decisão passou a ser tomada: o último instante possível antes de a criança ver o cartão.
    let acts = {};                       // vazio no arranque, como no cartucho
    const { api, sp } = mount(0, { getPauseActs: () => acts });
    expect(actsVisiveis(sp), 'com a tabela vazia, só o que a engine acciona').not.toContain('quit');

    acts = { quit: () => {} };           // a tabela chega DEPOIS — que é o que a laziness existe para permitir
    api.reflectPauseIcons();             // o que o shell faz quando a pausa abre

    expect(actsVisiveis(sp), 'a acção chegou e o item continuou escondido para sempre').toContain('quit');
  });

  it('⚠️ [Right] e o inverso também: uma acção que DESAPARECE esconde o item outra vez', () => {
    // A outra direcção, e ela importa: um jogo pode retirar «sair» durante um tutorial. Se o refresco só
    // soubesse mostrar, o botão morto voltaria pela porta de trás.
    let acts = { quit: () => {} };
    const { api, sp } = mount(0, { getPauseActs: () => acts });
    expect(actsVisiveis(sp)).toContain('quit');
    acts = {};
    api.reflectPauseIcons();
    expect(actsVisiveis(sp)).not.toContain('quit');
  });

  it('⚠️ [Right] com UM painel accionável, a porta `options` volta — a regra não é «esconder sempre»', () => {
    // O outro lado, e é o que impede a correcção de custar o submenu a quem o tem: basta um painel vivo para
    // a porta valer a pena. Sem este caso, filtrar `options` SEMPRE também passaria.
    const { sp } = mount(0, {
      pmButtons: undefined, optionsButtons: undefined,
      getPauseActs: () => ({ audio: () => {} }),
    });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados).toContain('options');
    expect(actsMontados).toContain('audio');
  });

  it('⚠️ [Right] a LISTA PADRÃO da engine existe — um jogo que não contribui com nada tem menu', () => {
    // O §4 do ADR-0106 fecha com esta frase: «a engine entrega uma lista padrão, para que um jogo que não
    // contribui com nada tenha uma». Antes desta mudança, `pmButtons` era OBRIGATÓRIO — um jogo que não a
    // passasse não compilava, e os cinco jogos sem menu de pausa são o resultado de ninguém a passar.
    const { sp } = mount(0, {
      pmButtons: undefined, optionsButtons: undefined,
      getPauseActs: () => ({ resume: () => {}, ajuda: () => {} }),
    });
    const actsMontados = actsVisiveis(sp);
    expect(actsMontados.length, 'a lista padrão não montou nada').toBeGreaterThan(1);
    expect(actsMontados, 'sem `resume` a pausa é uma armadilha — ADR-0044 §2').toContain('resume');
    expect(actsMontados).toContain('ajuda');
  });

  it('clique fora de qualquer botão não faz nada', () => {
    const { sp, bar, state } = mount();
    sp.querySelector('.pause-legend').click();
    expect(state.pauseActor).toBe(-1);
    expect(state.ran).toEqual([]);
  });
});

/**
 * O que a legenda de um ícone deve dizer AGORA: o `aria-label` (que já conta o estado) seguido da POSIÇÃO na
 * barra — item 3 do ADR-0044, XAG 106, e o número vai no FIM.
 *
 * A posição é recontada AQUI, a partir do DOM, e não lida da implementação: se as duas contas divergirem, é
 * porque uma delas está errada, e é justamente isso que o caso existe para descobrir.
 */
function legendaEsperada(bar, b) {
  const icones = [...bar.querySelectorAll('.pi-btn')];
  return b.getAttribute('aria-label') + ', ' + (icones.indexOf(b) + 1) + ' de ' + icones.length;
}

describe('buildScreenPause — delegação de clique nos .pi-btn', () => {
  it('clicar num ícone age, REFLETE e escreve na legenda o estado NOVO (não o antigo)', () => {
    const { sp, bar, state } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    expect(b.getAttribute('aria-label')).toBe('Modo cego'); // rótulo cru do markup
    b.click();
    expect(state.modoCego).toBe(true);
    expect(state.pauseActor).toBe(0);
    expect(b.getAttribute('aria-label')).toBe('Modo cego: ligado');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: ligado');
  });

  it('clicar de novo desliga e a legenda acompanha (Right-BICEP: inverso)', () => {
    const { sp, bar } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.click(); b.click();
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: desligado');
  });

  it('BORDA do TEA: 3 cliques passam por .pi-calm → .pi-on → base, com a legenda certa em cada passo', () => {
    // ⚠️ O NÍVEL TEA PERSISTE, e o `localStorage` de um navegador é partilhado pelos ficheiros que correm em paralelo:
    // este caso falhou cinco vezes sob a suíte inteira (o primeiro clique não dava `.pi-calm`) e passava sozinho — o
    // nível de partida vinha de outro ficheiro. Parte-se do nível 0, escrito antes de montar.
    try { localStorage.setItem('incl_tea', '0'); } catch { /* sem storage, o padrão já é 0 */ }
    const { sp, bar } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="tea"]');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(true);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo TEA: calmo');
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(true);
    b.click();
    expect(b.classList.contains('pi-calm')).toBe(false);
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('EXCEÇÃO: clicar num ícone EM CONSTRUÇÃO alerta e NÃO o marca como ligado', () => {
    const { sp, bar, alerted } = mount(0);
    const b = bar.querySelector('.pi-btn[data-pi="voice"]');
    b.click();
    expect(alerted).toHaveLength(1);
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.classList.contains('pi-on')).toBe(false);
    expect(b.getAttribute('aria-label')).toBe('Comando de voz, em construção'); // o reflexo não sobrescreve
  });

  it('MUITAS telas: o clique numa tela reflete TODAS (o estado de daltonismo é por jogador)', () => {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state } = makeCtx();
    const api = initPauseIcons(ctx);
    // Desde o item 7 do ADR-0044 os ícones vivem na BARRA de cada tela, e não no cartão — o que este caso
    // mede (o daltonismo é por jogador) continua sendo exatamente o mesmo, um nível de árvore ao lado.
    const b0 = api.buildQuickBar(0), b1 = api.buildQuickBar(1);
    const s0 = api.buildScreenPause(0), s1 = api.buildScreenPause(1);
    document.body.append(b0, s0, b1, s1);
    state.screens = [s0, s1];
    state.bars = [b0, b1];
    b0.querySelector('.pi-btn[data-pi="cvd"]').click();
    expect(b0.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(true);
    expect(b1.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(false);
    expect(b1.querySelector('.pi-btn[data-pi="cvd"]').getAttribute('aria-label')).toBe('Correção de daltonismo: desligado');
  });
});

describe('buildScreenPause — a legenda segue o foco e o mouse', () => {
  it('focar um ícone copia o aria-label para a legenda (mesma verdade p/ quem vê e p/ quem ouve)', () => {
    const { sp, bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="contrast"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent.startsWith(b.getAttribute('aria-label'))).toBe(true);
  });

  it('passar o mouse faz o mesmo', () => {
    const { sp, bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="libras"]');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo pessoa surda');
  });

  it('depois de um reflexo, o foco mostra o estado ATUAL — não o rótulo cru do markup', () => {
    const { api, sp, bar, state } = mount();
    state.modoCego = true;
    api.reflectPauseIcons();
    const b = bar.querySelector('.pi-btn[data-pi="blind"]');
    b.dispatchEvent(new FocusEvent('focus'));
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe(legendaEsperada(bar, b));
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('Modo cego: ligado');
  });
});

describe('modo `accessibility` — entrar, andar e SAIR (ADR-0044, item 7)', () => {
  // O ADR listou este modo entre as consequências NEGATIVAS da própria decisão: "um modo em que se entra e
  // não se sabe sair é a própria armadilha de que este registro trata". Por isso os casos de SAÍDA são mais
  // do que os de entrada, e por isso o primeiro deles é o anúncio — a frase que diz como sair, dita na hora
  // de entrar, é a única coisa que separa o modo da armadilha para quem não vê a tela.

  it('[Right] entrar ANUNCIA como sair, põe o cursor no 1º ícone — e NÃO retoma o jogo (ADR-0155)', () => {
    const { api, bar, said, ctx } = mount();
    let retomou = 0;
    ctx.getPauseActs = () => ({ resume: () => { retomou++; } });
    api.entrarNaBarra(0);
    expect(api.naBarraDe(0)).toBe(true);
    // 🔴 ATÉ AO ADR-0155 ERA O CONTRÁRIO: entrar despausava, porque o modo era para usar com o jogo a andar.
    // Agora a barra é a metade da PAUSA RÁPIDA, e retomar ao entrar descongelaria o mundo que a criança parou.
    expect(retomou, 'entrar na barra retomou o jogo que a pausa rápida acabou de congelar').toBe(0);
    expect(said.some((f) => /volt|back/i.test(f)), 'o anúncio de entrada tem de dizer como sair: ' + said.join(' | ')).toBe(true);
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(1);
  });

  it('[Right] VOLTAR sai do modo, limpa o cursor e anuncia a devolução', () => {
    const { api, bar, said } = mount();
    api.entrarNaBarra(0);
    said.length = 0;
    api.navBar(0, { no: true });
    expect(api.naBarraDe(0)).toBe(false);
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
    expect(bar.querySelector('.pause-icons-cap').textContent).toBe('');
    expect(said.length, 'a devolução do controle também é informação').toBeGreaterThan(0);
  });

  it('[Right] START sai também — a segunda porta, e é ela que a pausa ensinou', () => {
    const { api } = mount();
    api.entrarNaBarra(0);
    api.navBar(0, {}, true);
    expect(api.naBarraDe(0)).toBe(false);
  });

  it('🔴 TODA saída chama `aoSairDaBarra` — e a silenciosa não diz «de volta ao jogo» (ADR-0155)', () => {
    // ⚠️ É o gancho por onde a raiz descongela o jogo. Uma saída que não o chamasse deixava o mundo parado com a
    // criança de volta ao personagem; e o SELECT sai em silêncio porque vai para o cartão, não para o jogo.
    const { api, said, ctx } = mount();
    const saidas = [];
    ctx.aoSairDaBarra = (i, silencioso) => saidas.push([i, silencioso]);
    api.entrarNaBarra(0);
    api.navBar(0, { no: true });
    api.entrarNaBarra(0);
    said.length = 0;
    api.sairDaBarra(0, true);
    expect(saidas, 'uma das saídas não avisou a raiz').toEqual([[0, false], [0, true]]);
    expect(said, 'a saída silenciosa anunciou a volta ao jogo').toEqual([]);
    api.sairDaBarra(0);
    expect(saidas, 'sair de um modo em que não se estava avisou a raiz').toHaveLength(2);
  });

  it('[Boundary] depois de sair, a direção NÃO mexe mais na barra', () => {
    // O caso que prova que a saída SAI. Sem ele, `sairDaBarra` poderia limpar o cursor e deixar o modo ligado
    // — e a criança teria "saído" para um jogo em que o personagem continua sem andar.
    const { api, bar } = mount();
    api.entrarNaBarra(0);
    api.navBar(0, { no: true });
    api.navBar(0, { right: true });
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Right] a direção anda na barra, em ANEL', () => {
    const { api, bar } = mount();
    api.entrarNaBarra(0);
    const icones = [...bar.querySelectorAll('.pi-btn')];
    api.navBar(0, { right: true });
    expect(icones[1].classList.contains('pi-sel')).toBe(true);
    api.navBar(0, { left: true });
    api.navBar(0, { left: true });
    expect(icones[icones.length - 1].classList.contains('pi-sel'), 'antes do primeiro está o último').toBe(true);
  });

  it('[Right] confirmar ATIVA o ícone sob o cursor, e a legenda conta o estado NOVO', () => {
    const { api, bar, state } = mount();
    api.entrarNaBarra(0);
    // anda até o modo cego para ter um alternador com estado observável
    const icones = [...bar.querySelectorAll('.pi-btn')];
    const alvo = icones.findIndex((b) => b.dataset.pi === 'blind');
    for (let i = 0; i < alvo; i++) api.navBar(0, { right: true });
    api.navBar(0, { yes: true });
    expect(state.modoCego).toBe(true);
    expect(bar.querySelector('.pause-icons-cap').textContent).toContain('ligado');
  });

  it('[Zero] fora do modo, `navBar` não faz nada — nem cursor, nem clique', () => {
    // O roteamento pergunta a cada quadro; uma chamada que agisse sem o modo ligado seria o direcional
    // mexendo na barra durante o jogo normal.
    const { api, bar } = mount();
    api.navBar(0, { right: true });
    expect(bar.querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Interface] os ícones do HUD ficam FORA da ordem de tabulação', () => {
    // Dez paradas entre a criança e o jogo seria o preço de deixá-los lá. O alcance por teclado não se perde:
    // ele passa a ser este modo, que se abre pela pausa.
    const { bar } = mount();
    for (const b of bar.querySelectorAll('.pi-btn')) expect(b.tabIndex).toBe(-1);
  });
});

describe('a legenda da barra do HUD · aparece ao apontar e SOME ao sair', () => {
  // O Dev viu a barra na tela de jogo e disse o que estava errado: "é para aparecer somente os botões, nada
  // de explicação". A legenda ficava pendurada até alguém apontar outra coisa — uma faixa de texto parada em
  // cima da partida. Numa barra que vive na TELA DE JOGO isso não é ajuda, é obstrução.

  it('[Right] apontar mostra, tirar o mouse limpa', () => {
    const { bar } = mount();
    const b = bar.querySelector('.pi-btn[data-pi="contrast"]');
    const cap = bar.querySelector('.pause-icons-cap');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    expect(cap.textContent).not.toBe('');
    b.dispatchEvent(new MouseEvent('mouseleave'));
    expect(cap.textContent, 'a explicação ficou parada em cima do jogo').toBe('');
  });

  it('[Boundary] com o cursor do modo pousado num ícone, a legenda NÃO some', () => {
    // A exceção que impede o conserto de cegar o modo `accessibility`: ali a legenda é a ÚNICA coisa que diz
    // onde o cursor está. Apagá-la porque o mouse passou por perto tiraria a orientação de quem não usa mouse.
    const { api, bar } = mount();
    api.entrarNaBarra(0);
    const cap = bar.querySelector('.pause-icons-cap');
    const antes = cap.textContent;
    expect(antes).not.toBe('');
    bar.querySelector('.pi-btn[data-pi="contrast"]').dispatchEvent(new MouseEvent('mouseleave'));
    expect(cap.textContent, 'o mouse apagou a orientação de quem navega sem ele').toBe(antes);
  });
});

describe('MUITAS TELAS · a barra e o modo são POR JOGADOR (ADR-0044, item 7)', () => {
  // A regra do Dev, e ela é anterior a este ADR: "Nunca unificar multi tela. Correções / melhorias são por
  // tela. Modos multi são por tela." O único que força solo é o modo cego, por causa do limite de canais de
  // áudio — este aqui não é ele.
  //
  // O item 7 mexeu em TUDO o que é por tela ao mesmo tempo: a barra saiu do cartão, virou irmã dele, passou a
  // ser encontrada por índice (`getA11yBars()[i]`) e ganhou um modo indexado pelo mesmo número. Um erro de
  // índice em qualquer um desses pontos só apareceria com dois jogadores — e apareceria como "o ajuste da
  // minha irmã mudou a minha tela", que é a forma mais confusa possível de um defeito de acessibilidade.
  //
  // MEDIDO no jogo construído antes de existir este bloco (1600×900, dois jogadores): ligar a correção de
  // daltonismo na tela 2 não tocou a tela 1, e entrar no modo pela pausa da tela 2 pôs o cursor só na barra
  // dela. Estes casos prendem os dois.

  function duasTelas() {
    setPlayers([{ viz: 'normal' }, { viz: 'normal' }]);
    const { ctx, state, said } = makeCtx();
    const api = initPauseIcons(ctx);
    const bars = [api.buildQuickBar(0), api.buildQuickBar(1)];
    const sps = [api.buildScreenPause(0), api.buildScreenPause(1)];
    document.body.append(bars[0], sps[0], bars[1], sps[1]);
    state.screens = sps;
    state.bars = bars;
    return { api, bars, sps, state, said, ctx };
  }

  it('[Right] entrar no modo pela tela 1 NÃO põe cursor na tela 0', () => {
    const { api, bars } = duasTelas();
    api.entrarNaBarra(1);
    expect(api.naBarraDe(1)).toBe(true);
    expect(api.naBarraDe(0), 'o modo de uma tela não pode ligar o da outra').toBe(false);
    expect(bars[1].querySelectorAll('.pi-sel')).toHaveLength(1);
    expect(bars[0].querySelectorAll('.pi-sel'), 'a tela 0 ficou com cursor sem ninguém o ter pedido').toHaveLength(0);
  });

  it('[Right] com AS DUAS no modo, a direção de cada jogador anda só na barra dele', () => {
    // O caso que encena o defeito de índice, e ele precisa das DUAS no modo para morder. Com só uma dentro,
    // a guarda `naBarra.has(i)` já barraria a chamada da outra e o caso passaria sem nunca ter olhado para o
    // índice da BUSCA da barra — verde pelo motivo errado.
    //
    // E o passo tem de sair da TELA 1, não da 0. A primeira versão deste caso pedia o passo para a tela 0 e
    // PASSAVA com a mutação aplicada: com `getA11yBars()[0]` fixo no lugar de `[i]`, um passo pedido para a
    // tela 0 cai na barra certa por acidente. Fica anotado porque uma mutação que não falha é pior que
    // nenhuma — dá a sensação de rigor sem o rigor.
    const { api, bars } = duasTelas();
    api.entrarNaBarra(0);
    api.entrarNaBarra(1);
    const inicio = bars.map((b) => b.querySelector('.pi-sel').dataset.pi);
    // O jogador 1 anda DUAS casas; o jogador 0, nenhuma. Se a busca da barra ignorasse o índice, os dois
    // passos cairiam na mesma barra e as duas asserções abaixo trocariam de lado ao mesmo tempo.
    api.navBar(1, { right: true });
    api.navBar(1, { right: true });
    expect(bars[1].querySelector('.pi-sel').dataset.pi, 'a barra de quem andou ficou parada').not.toBe(inicio[1]);
    expect(bars[0].querySelector('.pi-sel').dataset.pi, 'a barra da OUTRA tela andou junto').toBe(inicio[0]);
  });

  it('[Zero] a direção de quem NÃO está no modo não mexe em barra nenhuma', () => {
    const { api, bars } = duasTelas();
    api.entrarNaBarra(1);
    const antes = bars[1].querySelector('.pi-sel').dataset.pi;
    api.navBar(0, { right: true }); // o jogador 0 não entrou
    expect(bars[1].querySelector('.pi-sel').dataset.pi).toBe(antes);
    expect(bars[0].querySelectorAll('.pi-sel')).toHaveLength(0);
  });

  it('[Right] sair numa tela deixa a outra como estava', () => {
    const { api, bars } = duasTelas();
    api.entrarNaBarra(0);
    api.entrarNaBarra(1);
    api.navBar(1, { no: true });
    expect(api.naBarraDe(1)).toBe(false);
    expect(api.naBarraDe(0), 'sair de uma tela derrubou o modo da outra').toBe(true);
    expect(bars[0].querySelectorAll('.pi-sel'), 'a tela que continua no modo perdeu o cursor').toHaveLength(1);
  });

  it('[Interface] cada barra se declara da SUA tela, e reflete o estado do SEU jogador', () => {
    // `data-player` não é enfeite: é por ele que uma auditoria (e um humano lendo o DOM) sabe qual barra é de
    // quem. E o daltonismo é por jogador — é o ajuste que expõe uma troca de índice na hora.
    const { api, bars } = duasTelas();
    expect(bars.map((b) => b.dataset.player)).toEqual(['0', '1']);
    bars[1].querySelector('.pi-btn[data-pi="cvd"]').click();
    expect(bars[1].querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(true);
    expect(bars[0].querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-protan')).toBe(false);
    expect(bars[0].querySelector('.pause-icons-cap').textContent, 'a legenda da outra tela falou sem ser chamada').toBe('');
  });
});

describe('reflectIconsIn — a barra do SPLASH (#title-icons) usa a mesma casca', () => {
  it('a mesma marcação de ícones reflete no escopo do jogador 1', () => {
    setPlayers([{ viz: 'fix-tritan', toggleMove: true }]);
    const { ctx } = makeCtx();
    const api = initPauseIcons(ctx);
    document.body.innerHTML = '<div id="title-icons"></div>';
    const ti = document.querySelector('#title-icons');
    ti.innerHTML = api.buildQuickBar(0).querySelector('.pause-icons').innerHTML;
    api.reflectIconsIn(ti, 0);
    expect(ti.querySelector('.pi-btn[data-pi="cvd"]').classList.contains('pi-cvd-tritan')).toBe(true);
    expect(ti.querySelector('.pi-btn[data-pi="altmove"]').getAttribute('aria-pressed')).toBe('true');
    expect(ti.querySelector('.pi-btn[data-pi="face"]').getAttribute('aria-pressed')).toBe('false');
  });
});

// ---------------------------------------------------------------------------------------------
// ⚠️ O NÍVEL TEA PERSISTE (issue #61) — e é aqui que se prova, porque precisa de `localStorage` real
// ---------------------------------------------------------------------------------------------
//
// Até 2026-09-07 não persistia: era um `let calmMode = 0` com o comentário «deliberately NOT persisted —
// verbatim: game.js never wrote it to storage». O «verbatim» é o que o desqualificava como decisão — foi
// preservado na extração do monólito, não escolhido —, e o ADR-0028 diz que todo menu persiste.
//
// O custo era da criança que mais precisa dele: quem usa o modo SILENCIOSO voltava a pô-lo a cada sessão, e
// é para quem o barulho inesperado custa mais. Um ajuste que se esquece não é um ajuste, é uma tarefa diária.
describe('o nível TEA sobrevive ao fecho da aba (#61, ADR-0028)', () => {
  const CHAVE = 'incl_tea';

  it('⚠️ [Right] o ciclo do ícone GRAVA, e o arranque seguinte LÊ', () => {
    localStorage.removeItem(CHAVE);
    setPlayers([{ viz: '', toggleMove: false }]);

    // sessão 1: a criança põe em «calmo» e depois em «silencioso»
    const primeira = initPauseIcons(makeCtx().ctx);
    expect(primeira.getCalmMode(), 'não começou no padrão').toBe(0);
    primeira.iconAct('tea', 0);
    primeira.iconAct('tea', 0);
    expect(primeira.getCalmMode()).toBe(2);
    expect(localStorage.getItem(CHAVE), 'o nível não foi gravado').toBe('2');

    // sessão 2: outra instância, como um recarregamento da página
    const segunda = initPauseIcons(makeCtx().ctx);
    expect(segunda.getCalmMode(), 'o nível não sobreviveu ao recarregamento').toBe(2);
  });

  it('[Interface] o `setCalmMode` também grava — é a outra porta para o mesmo valor', () => {
    // Se só o ciclo do ícone gravasse, um nível posto por aqui viveria a sessão e morreria no fecho da aba,
    // que é a metade pior do defeito: o ajuste parece ter pegado e some depois.
    localStorage.removeItem(CHAVE);
    setPlayers([{ viz: '', toggleMove: false }]);
    const api = initPauseIcons(makeCtx().ctx);
    api.setCalmMode(1);
    expect(localStorage.getItem(CHAVE)).toBe('1');
    expect(initPauseIcons(makeCtx().ctx).getCalmMode()).toBe(1);
  });

  it('⚠️ [Error] um nível inválido guardado no navegador não chega ao anúncio', () => {
    // O anúncio ao leitor de tela é `t(CALM_NAMES[calmMode])`. Um `3` guardado — dado corrompido, uma versão
    // futura, um dedo no devtools — daria `undefined` e a criança cega carregaria no botão e não ouviria
    // nada. Volta ao padrão, que é audível.
    localStorage.setItem(CHAVE, '3');
    setPlayers([{ viz: '', toggleMove: false }]);
    expect(initPauseIcons(makeCtx().ctx).getCalmMode()).toBe(0);
    localStorage.removeItem(CHAVE);
  });
});

describe('a barra montada obedece ao §5 do ADR-0106 — nenhum botão morto', () => {
  it('⚠️ [Interface] SEM escritor visual, o contraste e a cor não são MONTADOS', () => {
    // A metade pura (`iconesQueAccionam`) vive no project node; este caso é a prova de que a regra alcança o
    // DOM de verdade — que é onde uma criança encontra, ou não encontra, o botão.
    const { bar } = mount(0, { setTemaDoJogador: undefined, setCorrecaoDoJogador: undefined });
    const chaves = [...bar.querySelectorAll('.pi-btn')].map((b) => b.dataset.pi);
    expect(chaves).not.toContain('contrast');
    expect(chaves).not.toContain('cvd');
    // ⚠️ E o resto da barra fica INTEIRO: perder os oito por causa de dois seria a troca errada.
    expect(chaves).toContain('blind');
    expect(chaves).toContain('tts');
    expect(chaves).toContain('libras');
  });

  it('[Right] COM escritor visual, os dois estão lá — é o caso de hoje e continua a ser', () => {
    const { bar } = mount(0);
    const chaves = [...bar.querySelectorAll('.pi-btn')].map((b) => b.dataset.pi);
    expect(chaves).toContain('contrast');
    expect(chaves).toContain('cvd');
  });
});

// ========================= MUTACOES CONFERIDAS (ADR-0106 §5) =========================
//   · fazendo `iconesQueAccionam` devolver sempre `PAUSE_ICONS` -> reprovam os casos SEM escritor, no node e
//     aqui. E a mutacao que devolve o defeito: a barra volta a oferecer um caminho que nao leva a lado nenhum.
//   · filtrando os dois SEMPRE (ignorando o booleano) -> reprova "COM escritor visual, os dois estao la", que
//     e a metade que impede a correccao de custar os icones a quem os tinha.
// ========================= MUTACOES DA LISTA PADRAO DE `.pm-btn` (ADR-0106 §4/§5) =========================
//   · tirando o filtro por ACCAO (`itensQueAccionam` a devolver tudo) -> reprovam DOIS. E o defeito que estava
//     institucionalizado: o menu mostrava `quit` sem tabela, e o fixture omitia-o DE PROPOSITO com um
//     comentario a dizer que isso «prova que um data-act sem entrada nao quebra o clique». Nao quebrava mesmo
//     — so nao fazia nada, e quem navega por leitor de tela ouvia um item que nao existe.
//   · ⚠️ tirando a regra da PORTA VAZIA -> SOBREVIVEU na primeira volta, e a sobrevivencia era um caso vazio e
//     nao um buraco de logica: o `[Zero]` usava a lista do FIXTURE, que nao tem `options` nenhum, entao
//     afirmava sobre um item que a lista nao continha. Refeito com a lista PADRAO DA ENGINE (que tem
//     `options`), a mesma mutacao reprova.
//   · escondendo `options` SEMPRE -> reprova o caso do painel unico. E a metade que impede a correccao de
//     custar o submenu a quem o tem: basta UM painel vivo para a porta valer a pena.
//   · trocando a lista padrao por `[]` -> reprovam DOIS. E a prova de que o padrao da engine existe: antes
//     desta mudanca o `pmButtons` era OBRIGATORIO, e os cinco jogos sem menu de pausa sao o resultado de
//     ninguem o passar.
//
//   · ⚠️ trocando o `&&` por `||` na deteccao -> SOBREVIVEU, e a sobrevivencia apontou um defeito de DESENHO
//     em vez de um buraco de cobertura: com UMA bandeira para os dois icones, os dois operadores dao o mesmo
//     resultado sempre que faltam os dois escritores — e erram em direccoes opostas quando falta so um (o
//     `&&` esconde um icone que funciona; o `||` mostra um que nao funciona). A pergunta passou a ser por
//     ICONE (`EscritoresVisuais`), e o caso `[Boundary] com UM escritor so` vive no project node.

describe('o ctx MÍNIMO — o que o `createGame` conseguiria responder sozinho (ADR-0106 etapa 2)', () => {
  /** Só campos que a ENGINE sabe responder. Nenhum `rm`, `dynLabel`, `getPauseActs` ou `setPauseActor`. */
  function ctxMinimo(over = {}) {
    const bars = [];
    return {
      getPlayers: () => [{ visual: PADRAO, toggleMove: false, walkDir: 0 }],
      getNumPlayers: () => 1,
      srSay: () => {}, srAlert: () => {},
      getA11yBars: () => bars,
      getModoCego: () => false,
      // ⚠️ ESTE CAMPO PERTENCE AO MÍNIMO, e faltava. A engine SABE respondê-lo — lê-o da declaração —, então
      // omiti-lo nunca foi «mínimo», foi esquecimento. E o esquecimento sustentava um caso: com `undefined`,
      // que é falso, o `altmove` sumia e o teste do §5 passava POR ACIDENTE. Agora a resposta é declarada —
      // um jogo mínimo não segura teclas — e o caso passa pelo motivo que diz ter.
      seguraTeclas: () => false,
      getAudioCat: () => ({ tts: { on: false, vol: 1 } }),
      setCatGain: () => {},
      reflectTtsPanel: () => {}, reflectTtsPanelEnabled: false,
      isLibrasOn: () => false, toggleLibras: () => {},
      ...over,
    };
  }

  it('⚠️ [Zero] com o ctx MÍNIMO a pausa monta — é a pré-condição da etapa 2', () => {
    // ⚠️ ESTE CASO É A ETAPA 2 EM FORMA DE AFIRMAÇÃO. Enquanto `rm`, `dynLabel`, `getPauseActs` e
    // `setPauseActor` fossem OBRIGATÓRIOS, o `createGame` não podia montar a pausa sem inventar respostas por
    // um jogo que ele não conhece. Agora pode: o que falta é ele MONTAR, não ele PODER.
    const api = initPauseIcons(ctxMinimo());
    const sp = api.buildScreenPause(0);
    const bar = api.buildQuickBar(0);
    expect(sp.querySelector('.pause-card'), 'o cartão não montou').toBeTruthy();
    expect(bar.querySelectorAll('.pi-btn').length, 'a barra montou vazia').toBeGreaterThan(0);

    // ⚠️ E O MODO TEA TEM DE CORRER, que é onde o `rm` é mesmo lido. Sem esta linha o caso montava a árvore e
    // nunca tocava nos quatro campos de movimento reduzido — uma mutação que os voltasse a exigir do jogo
    // sobreviveria a ele. (Foi o que aconteceu na primeira volta.)
    expect(() => api.applyCalm(), 'o modo TEA rebentou sem `rm` injetado').not.toThrow();
    expect(typeof api.getCalmMode()).toBe('number');
  });

  it('⚠️ [Zero] e o cartão mínimo NÃO oferece item que não acciona (§5)', () => {
    // Sem tabela de acções, sobra o que a engine acciona sozinha — e nada mais. Um cartão com `quit` que não
    // sai, ou `ajuda` que não abre, seria pior do que um cartão curto.
    const api = initPauseIcons(ctxMinimo());
    const sp = api.buildScreenPause(0);
    const acts = actsVisiveis(sp);
    expect(acts).not.toContain('quit');
    expect(acts).not.toContain('options'); // a porta cai porque a sala está vazia
    expect(acts.every((a) => a === 'acessibilidade' || a === 'pmback'), 'sobrou item sem acção: ' + acts.join(',')).toBe(true);
  });

  it('⚠️ [Interface] trocar `getPauseActs` DEPOIS do init continua a valer — a ligação é tardia', () => {
    // ⚠️ ESTE CASO NASCEU DE UM ERRO MEU QUE UM TESTE APANHOU. Ao dar padrão aos campos, resolvi
    // `ctx.getPauseActs` UMA vez no arranque — e isso congelou a referência, partindo quem troca a tabela
    // depois. Trocar depois é legítimo: a laziness deste campo existe porque a tabela chega tarde (no
    // cartucho é um `const` ~1200 linhas abaixo do `init`). Um padrão não pode custar a ligação tardia.
    const ctx = ctxMinimo();
    const api = initPauseIcons(ctx);
    let saiu = 0;
    ctx.getPauseActs = () => ({ quit: () => { saiu++; } });
    const sp = api.buildScreenPause(0);
    const botao = sp.querySelector('.pm-btn[data-act="quit"]');
    expect(botao, 'a tabela trocada depois do init não foi lida').toBeTruthy();
    botao.click();
    expect(saiu).toBe(1);
  });
});
