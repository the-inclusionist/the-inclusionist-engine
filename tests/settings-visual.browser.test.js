// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-visual (project BROWSER: usa document). Contrato: initSettingsVisual(ctx) NUNCA importa
// game.js nem toca localStorage direto — todo estado que não é dele (lq/ownerColors/cbSafe/outlines/role colors/
// selVizPlayer/setPlayerViz) chega por injeção; só numPlayers/players vêm de core/state.js (binding vivo, como o
// próprio game.js usa). DI por closure — modelo: tests/debug-panel.browser.test.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, ui/settings-visual).
import { describe, it, expect, beforeEach } from 'vitest';
import { eixosHtml } from '../app/js/ui/visual-axes-panel.js';
import { PADRAO, migrarVisual } from '../app/js/render/viz-axes.js';
import { t } from '../app/js/core/i18n.js'; // VIZ_MODES guarda CHAVE desde o item 14
import { initSettingsVisual } from '../app/js/ui/settings-visual.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const PANEL_HTML =
  '<div id="visual"><div id="visual-modes"></div><div id="visual-list"></div>' +
  // Os dois selects de contorno vivem dentro de `.ctrl-row` no documento real. O fixture os tinha soltos, e
  // isso bastava enquanto ninguém procurava a linha deles — a marca do ADR-0029 procura, e um fixture menos
  // fiel que o documento não testaria justamente o que passou a existir.
  '<div class="ctrl-row"><span>Contorno de 1º plano</span>' +
  '<select id="opt-outline-fg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select></div>' +
  '<div class="ctrl-row"><span>Contorno de 2º plano</span>' +
  '<select id="opt-outline-bg"><option value="0">Nenhum</option><option value="1">Fino</option><option value="2">Grosso</option></select></div>' +
  '<button id="visual-reset" type="button">Restaurar</button></div>' +
  '<button data-act="visual" class="pm-btn" type="button">Acessibilidade visual</button>';

function makeCtx(overrides = {}) {
  const state = {
    lq: 0, ownerColors: true, cbSafe: false, outlineFg: 0, outlineBg: 1,
    roleColors: { hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212] },
  };
  let selected = 0;
  const calls = {
    setPlayerViz: [], setLq: [], setOwnerColors: [], setCbSafe: [],
    setOutlineFg: [], setOutlineBg: [], setRoleColor: [], resetRoleColors: 0, srSay: [], setSelectedPlayer: [],
    renderVizGroup: [],
    renderEixosVisuais: [],
  };
  const ctx = {
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    $: (sel) => document.querySelector(sel),
    srSay: (t) => calls.srSay.push(t),
    getVisualSettings: () => ({ ...state, roleColors: { ...state.roleColors } }),
    getSelectedPlayer: () => selected,
    setSelectedPlayer: (i) => { selected = i; calls.setSelectedPlayer.push(i); },
    setPlayerViz: (i, mode) => calls.setPlayerViz.push([i, mode]),
    // ⚠️ DUBLÊ DOS DOIS EIXOS (#104). Este painel deixou de usar o `renderVizGroup` — que fica com o menu de
    // EMPATIA, cuja lista de simulações continua a ser mesmo exclusiva — e passou a montar dois rádios, um
    // por eixo. O dublê usa o gerador DE VERDADE (`eixosHtml`), e não uma imitação: um dublê que inventa o
    // markup deixa de reprovar quando o markup real muda.
    renderEixosVisuais: (listSel, tabsSel) => {
      calls.renderEixosVisuais.push([listSel, tabsSel]);
      const el = document.querySelector(listSel);
      if (!el) return;
      el.innerHTML = eixosHtml(players[selected]?.visual ?? PADRAO, t);
    },
    // Dublê do renderizador de linhas compartilhado com o painel de empatia (render/viz-setters). Ele desenha
    // as MESMAS linhas de rádio nos dois menus — é por isso que as correções de daltonismo mantêm a aparência
    // que a criança já conhecia ao mudar de casa (#60).
    renderVizGroup: (listSel, tabsSel, modes) => {
      calls.renderVizGroup.push([listSel, tabsSel, modes]);
      const el = document.querySelector(listSel);
      if (!el) return;
      const cur = players[selected] ? players[selected].viz : 'normal';
      el.innerHTML = modes.map((m) =>
        `<div class="ctrl-row"><span><strong>${t(m.nome)}</strong> ${t(m.desc)}</span>` +
        `<button data-viz="${m.key}" type="button" aria-pressed="${m.key === cur}"></button></div>`).join('');
      el.querySelectorAll('button[data-viz]').forEach((b) => b.addEventListener('click', () => {
        calls.setPlayerViz.push([selected, b.dataset.viz]);
      }));
    },
    setLq: (t) => { state.lq = t; calls.setLq.push(t); },
    setOwnerColors: (on) => { state.ownerColors = on; calls.setOwnerColors.push(on); },
    setCbSafe: (on) => { state.cbSafe = on; calls.setCbSafe.push(on); },
    setOutlineFg: (v) => { state.outlineFg = v; calls.setOutlineFg.push(v); },
    setOutlineBg: (v) => { state.outlineBg = v; calls.setOutlineBg.push(v); },
    setRoleColor: (k, hex) => calls.setRoleColor.push([k, hex]),
    resetRoleColors: () => { calls.resetRoleColors++; },
    ...overrides,
  };
  return { ctx, calls, state, getSelected: () => selected };
}

beforeEach(() => {
  document.body.innerHTML = PANEL_HTML;
  players.length = 0;
  setNumPlayersValue(1);
});

describe('ui/settings-visual — initSettingsVisual', () => {
  it('[Zero] sem #visual-list no DOM, render() não quebra', () => {
    document.querySelector('#visual-list').remove();
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    expect(() => panel.render()).not.toThrow();
  });

  it('[Interface] wireOutlineControls sincroniza os selects de contorno já na criação (antes do 1º render)', () => {
    const { ctx } = makeCtx();
    initSettingsVisual(ctx);
    expect(document.querySelector('#opt-outline-fg').value).toBe('0');
    expect(document.querySelector('#opt-outline-bg').value).toBe('1');
  });

  it('[Interface] render() monta o slider L→Q, os toggles e os 4 seletores de cor', () => {
    players.push({ viz: 'hc-direto-45' });
    const { ctx } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const list = document.querySelector('#visual-list');
    expect(list.querySelector('#opt-lq')).toBeTruthy();
    expect(list.querySelector('#opt-ownercolors')).toBeTruthy();
    expect(list.querySelector('#opt-cbsafe')).toBeTruthy();
    for (const k of ['hazard', 'climb', 'water', 'gate']) expect(list.querySelector('#opt-role-' + k)).toBeTruthy();
    expect(list.querySelector('#opt-role-reset')).toBeTruthy();
  });

  // ===================== A MARCA DE «SAIU DO PADRÃO», POR EIXO (ADR-0029 · #61) =====================
  // 🔴 REGRESSÃO INTRODUZIDA PELA #104 ETAPA 4D, e é minha. Antes dela o `#visual-modes` era UM rádio de sete
  // opções, então marcar o contentor era marcar a escolha. Com dois eixos lá dentro, UMA marca no contentor
  // não diz QUAL saiu do padrão — e é exactamente o terceiro canal do ADR-0029 a perder informação: «a criança
  // cega percorre o menu e OUVE, em ordem, o que saiu do padrão». Ouvir «mudado» sem saber de quê manda-a
  // procurar em oito linhas.
  //
  // ⚠️ E A MARCA ERA CALCULADA DO ESPELHO OBSOLETO (`resolveVisualMode(playerViz(...))` → `p.viz`), o campo que
  // a #104 etapa 1a marcou `@deprecated`. O predicado que responde a esta pergunta exacta já existe no modelo
  // novo, e é o `PADRAO` do `render/viz-axes`.
  const linhaDoEixo = (eixo) => document.querySelector(`#visual-modes button[data-eixo="${eixo}"][aria-checked="true"]`)
    ?.closest('.ctrl-row') ?? null;
  const marcada = (el) => !!el && el.classList.contains('is-changed');

  it('🎯 [Right] só o eixo que SAIU do padrão fica marcado — o outro não', () => {
    players.push({ viz: 'hc7', visual: { ...PADRAO, tema: 'hc7' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema')), 'o tema saiu do padrão e não foi marcado').toBe(true);
    expect(marcada(linhaDoEixo('correcao')), 'a correção está no padrão e foi marcada').toBe(false);
  });

  it('🎯 [Right] e ao contrário: só a correção', () => {
    players.push({ viz: 'fix-deuter', visual: { ...PADRAO, correcao: 'deuter' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('correcao'))).toBe(true);
    expect(marcada(linhaDoEixo('tema'))).toBe(false);
  });

  it('⚠️ [Boundary] os DOIS ao mesmo tempo — o caso que o campo único não exprimia', () => {
    // `hc7 + deuter` é o par que a #104 inteira existiu para tornar possível. Se a marca continuasse a vir do
    // espelho, ela teria de escolher um dos dois para reportar.
    players.push({ viz: 'hc7', visual: { tema: 'hc7', correcao: 'deuter', simulacao: null } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema'))).toBe(true);
    expect(marcada(linhaDoEixo('correcao'))).toBe(true);
  });

  it('⚠️ [Zero] uma SIMULAÇÃO não marca este menu — a marca é do menu de empatia', () => {
    // A regra estava escrita no comentário do `refreshMarks` e vinha do `resolveVisualMode`. Com os dois
    // eixos ela deixa de ser derivada e passa a ser ESTRUTURAL: a simulação vive noutro campo do
    // `VisualState`, então perguntar pelo tema e pela correcção nunca a alcança.
    players.push({ viz: 'sim-deuter', visual: migrarVisual('sim-deuter') });
    initSettingsVisual(makeCtx().ctx).render();
    expect(marcada(linhaDoEixo('tema')), 'a simulação marcou o menu errado').toBe(false);
    expect(marcada(linhaDoEixo('correcao')), 'a simulação marcou o menu errado').toBe(false);
  });

  it('⚠️ [Right] o botão que ABRE o menu fica marcado quando qualquer um dos eixos saiu', () => {
    // O canal que leva a criança até aqui: sem ele, ela teria de abrir cada menu para descobrir onde mexeu.
    players.push({ viz: 'normal', visual: { ...PADRAO, correcao: 'protan' } });
    initSettingsVisual(makeCtx().ctx).render();
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('⚠️ [Right] o modo visual é desenhado em DOIS rádios — um por eixo (#104)', () => {
    // O que este caso protege continua a ser a ACHABILIDADE: as correções de daltonismo estavam no menu de
    // empatia como linhas visíveis, e a primeira tentativa de as trazer para cá pô-las num `<select>`, onde
    // sumiram. Para um controle feito para ser achado por quem enxerga mal, isso é quase não ter movido.
    //
    // ⚠️ E O QUE MUDOU: os sete numa lista só contavam uma exclusividade que DEIXOU DE EXISTIR. Agora são
    // dois eixos, e cada um pode estar fora do padrão ao mesmo tempo que o outro.
    players.push({ viz: 'normal', visual: PADRAO });
    const { ctx, calls } = makeCtx();
    initSettingsVisual(ctx).render();
    const [listSel] = calls.renderEixosVisuais.at(-1);
    expect(listSel).toBe('#visual-modes');
    const html = document.querySelector('#visual-modes').innerHTML;
    for (const v of ['padrao', 'hc3', 'hc45', 'hc7']) expect(html, `tema ${v}`).toContain(`data-valor="${v}"`);
    for (const v of ['tricro', 'protan', 'deuter', 'tritan']) expect(html, `correção ${v}`).toContain(`data-valor="${v}"`);
    expect(html, 'voltou a ser uma caixa fechada').not.toContain('<select');
    // OITO linhas: quatro temas + quatro correcoes. Eram sete numa lista so.
    expect(document.querySelectorAll('#visual-modes .ctrl-row')).toHaveLength(8);
    expect(document.querySelector('#visual-modes').textContent).toContain('Correção deuteranopia');
  });

  it('⚠️ [Boundary] com uma SIMULAÇÃO ligada, os dois eixos aparecem no PADRÃO (#104)', () => {
    // ⚠️ MUDOU DE FORMA COM A DIVISÃO, e a nova é mais verdadeira. Antes, uma simulação ocupava o campo único
    // e NENHUMA linha deste menu ficava marcada — o menu ficava mudo sobre o estado dos ajustes, quando a
    // criança podia estar a olhar para ele justamente para saber onde estava. Agora a simulação é coisa à
    // parte, e os dois eixos dizem o que dizem: estão no padrão — que é exactamente a condição que o
    // ADR-0076 exige para uma simulação poder correr.
    players.push({ viz: 'sim-deuter', visual: migrarVisual('sim-deuter') });
    const { ctx } = makeCtx();
    initSettingsVisual(ctx).render();
    const marcadas = [...document.querySelectorAll('#visual-modes button[aria-checked="true"]')]
      .map((b) => b.dataset.valor);
    expect(marcadas).toEqual(['padrao', 'tricro']);
  });

  it('[Boundary] jogador selecionado além da contagem atual é reclampado para 0 (jogador saiu)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls, getSelected } = makeCtx();
    ctx.getSelectedPlayer = () => 3; // sobrou de quando havia mais jogadores
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(calls.setSelectedPlayer).toContain(0);
  });

  it('⚠️ [Interface] o painel DELEGA o desenho e a escrita ao renderizador dos eixos (#104)', () => {
    // O clique deixou de ser deste painel: quem liga o botão ao escritor POR EIXO é o `renderEixosVisuais`,
    // em `render/viz-setters`, e é lá que ele tem caso próprio. O que ESTE painel ainda promete é chamá-lo
    // com o seletor certo — e é isso que se afirma aqui, em vez de reimplementar a fiação dentro do dublê e
    // acabar a medir o dublê.
    players.push({ viz: 'normal', visual: PADRAO });
    const { ctx, calls } = makeCtx();
    initSettingsVisual(ctx).render();
    expect(calls.renderEixosVisuais.at(-1)).toEqual(['#visual-modes', '#visual-players']);
  });

  it('[Interface] mexer no slider L→Q chama setLq com t=0..1 e atualiza o rótulo ao vivo', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const lq = document.querySelector('#opt-lq');
    lq.value = '70';
    lq.dispatchEvent(new Event('input'));
    expect(calls.setLq).toEqual([0.7]);
    expect(document.querySelector('#opt-lq-val').textContent).toBe('quadrático');
  });

  it('[Interface] soltar o slider (change) anuncia o rótulo via srSay', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const lq = document.querySelector('#opt-lq');
    lq.value = '20';
    lq.dispatchEvent(new Event('change'));
    expect(calls.srSay).toEqual(['Realce de contraste: linear.']);
  });

  it('[Interface] clicar em "Itens na cor do dono" alterna e re-renderiza refletindo o novo estado', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const btn = document.querySelector('#opt-ownercolors');
    expect(btn.getAttribute('aria-pressed')).toBe('true'); // default ligado
    btn.click();
    expect(calls.setOwnerColors).toEqual([false]);
    expect(document.querySelector('#opt-ownercolors').getAttribute('aria-pressed')).toBe('false');
  });

  it('[Interface] clicar em "Paleta segura para daltonismo" alterna e re-renderiza', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const btn = document.querySelector('#opt-cbsafe');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(calls.setCbSafe).toEqual([true]);
    expect(document.querySelector('#opt-cbsafe').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] mudar a cor de um papel chama setRoleColor(chave, hex)', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    const inp = document.querySelector('#opt-role-water');
    inp.value = '#123456';
    inp.dispatchEvent(new Event('change'));
    expect(calls.setRoleColor).toEqual([['water', '#123456']]);
  });

  it('[Interface] clicar em restaurar cores padrão chama resetRoleColors()', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    document.querySelector('#opt-role-reset').click();
    expect(calls.resetRoleColors).toBe(1);
  });

  it('[Interface] os selects de contorno chamam setOutlineFg/setOutlineBg — o listener é anexado só uma vez', () => {
    players.push({ viz: 'normal' });
    const { ctx, calls } = makeCtx();
    const panel = initSettingsVisual(ctx);
    panel.render();
    panel.render(); // um 2º render NÃO deve duplicar o listener dos selects estáticos
    const fg = document.querySelector('#opt-outline-fg');
    fg.value = '2';
    fg.dispatchEvent(new Event('change'));
    expect(calls.setOutlineFg).toEqual([2]); // se tivesse duplicado, viria [2, 2]
  });

  it('[Interface] render() re-sincroniza os selects de contorno com o estado atual', () => {
    players.push({ viz: 'normal' });
    const { ctx, state } = makeCtx();
    state.outlineFg = 2; state.outlineBg = 0;
    const panel = initSettingsVisual(ctx);
    panel.render();
    expect(document.querySelector('#opt-outline-fg').value).toBe('2');
    expect(document.querySelector('#opt-outline-bg').value).toBe('0');
  });
});

describe('ui/settings-visual — restaurar padrões DESTE menu (ADR-0028) + marca (ADR-0029)', () => {
  // O beforeEach zera `players` — ele é o array VIVO de core/state, compartilhado com o resto da suíte —,
  // então cada caso planta o jogador de que precisa em vez de assumir que existe um.
  // ⚠️ ESCREVE OS DOIS CAMPOS, como o `setPlayerViz` de produção faz — e derivando o novo pelo MESMO
// `migrarVisual`, que é o que impede a tradução de existir em duas versões. O fixture criava um jogador só com
// o `viz` obsoleto, e a #104 etapa 1a tornou o `visual` OBRIGATÓRIO: era um jogador que o programa não
// consegue produzir, e um teste que contorna a API mede um estado que o jogo nunca alcança. Mesmo defeito que
// a etapa 2b já tinha apanhado em três fixtures.
const comViz = (viz) => { players.length = 0; players.push({ viz, visual: migrarVisual(viz) }); };

  it('[Right] devolve realce, cores de dono, paleta segura, contornos e cores de papel', () => {
    const { ctx, calls, state } = makeCtx();
    state.lq = 0.6; state.ownerColors = false; state.cbSafe = true; state.outlineFg = 2; state.outlineBg = 0;
    state.roleColors.hazard = [1, 2, 3];
    initSettingsVisual(ctx).render();

    document.querySelector('#visual-reset').click();

    expect(calls.setLq).toEqual([0]);
    expect(calls.setOwnerColors).toEqual([true]);
    expect(calls.setCbSafe).toEqual([false]);
    expect(calls.setOutlineFg).toEqual([1]);
    expect(calls.setOutlineBg).toEqual([1]);
    expect(calls.resetRoleColors).toBe(1);
    expect(calls.srSay.at(-1)).toContain('visual');
  });

  it('[Right] devolve o contraste ao normal quando é um NÍVEL DE CONTRASTE', () => {
    const { ctx, calls } = makeCtx();
    comViz('hc-direto-7');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setPlayerViz).toEqual([[0, 'normal']]);
  });

  it('[Right] a correção de daltonismo AGORA é zerada — ela mudou para este menu (#60)', () => {
    // Desfazê-la é legítimo aqui, e só aqui: a criança a reencontra no MESMO seletor que acabou de usar.
    // A regra continua sendo "um reset só pode desfazer o que ele também consegue refazer".
    const { ctx, calls } = makeCtx();
    comViz('fix-deuter');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setPlayerViz).toEqual([[0, 'normal']]);
  });

  it('[Interface] NÃO apaga as SIMULAÇÕES — essas são do menu de empatia, e `viz` é um campo só', () => {
    for (const modo of ['lv-tunnel', 'blind', 'sim-deuter']) {
      const { ctx, calls } = makeCtx();
      comViz(modo);
      initSettingsVisual(ctx).render();
      document.querySelector('#visual-reset').click();
      expect(calls.setPlayerViz).toEqual([]);
    }
  });

  it('[Interface] a correção é ESCOLHÍVEL daqui, numa linha visível — a prova de que ela mudou de casa', () => {
    // Antes da #60 uma criança daltônica não achava a correção dela sem abrir o menu de empatia. Depois da
    // primeira tentativa, achava-a só abrindo um `<select>`. Este caso exige a linha.
    const { ctx, calls } = makeCtx();
    comViz('normal');
    initSettingsVisual(ctx).render();
    // ⚠️ A LINHA CONTINUA A EXISTIR, e é isso que o caso protege — o que mudou é que ela vive agora no EIXO
    // da correção, ao lado das outras três, em vez de misturada com os níveis de contraste numa lista onde
    // escolher uma apagava o outro.
    const linha = document.querySelector('#visual-modes button[data-valor="deuter"]').closest('.ctrl-row');
    expect(linha.textContent).toContain('Correção deuteranopia');
    // ⚠️ O CLIQUE não é afirmado aqui: quem o liga ao escritor por eixo é o `renderEixosVisuais`, e ele tem
    // caso próprio em `viz-setters`. Afirmá-lo pelo dublê mediria o dublê.
    expect(linha.querySelector('button').dataset.eixo).toBe('correcao');
  });

  it('⚠️ [Interface] com a correção ligada, a LINHA DELA fica marcada — e já não a lista inteira', () => {
    // ⚠️ ESTE CASO FOI VIRADO, e o que ele afirmava era o defeito escrito como garantia. Marcar
    // `#visual-modes` estava certo enquanto aquele contentor tinha UM rádio de sete opções: marcar o
    // contentor era marcar a escolha. A #104 etapa 4d pôs DOIS eixos lá dentro e a mesma asserção passou a
    // certificar uma marca que já não diz QUAL deles saiu do padrão.
    //
    // 📌 E a marca desceu para o sítio que tem NOME: o contentor não tem nome acessível, a linha tem. É o
    // terceiro canal do ADR-0029 — «a criança cega percorre o menu e ouve, em ordem, o que saiu do padrão» —
    // a voltar a funcionar.
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('fix-tritan');
    initSettingsVisual(ctx).render();
    const linhaDaCorrecao = document.querySelector('#visual-modes button[data-eixo="correcao"][aria-checked="true"]')
      .closest('.ctrl-row');
    expect(linhaDaCorrecao.classList.contains('is-changed'), 'a linha da correção não foi marcada').toBe(true);
    expect(linhaDaCorrecao.textContent, 'marcou a linha errada').toContain('tritanopia');
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Zero] com tudo no padrão, nenhum setter é chamado', () => {
    const { ctx, calls, state } = makeCtx();
    state.outlineFg = 1; // o fixture nasce fora do padrão neste campo
    comViz('normal');
    initSettingsVisual(ctx).render();
    document.querySelector('#visual-reset').click();
    expect(calls.setLq).toEqual([]);
    expect(calls.setOutlineFg).toEqual([]);
    expect(calls.resetRoleColors).toBe(0);
    expect(calls.setPlayerViz).toEqual([]);
  });

  it('[Right] a marca aparece só nas linhas fora do padrão, e sobe para o botão do menu', () => {
    const { ctx, state } = makeCtx();
    state.outlineFg = 1; state.cbSafe = true;
    comViz('normal');
    initSettingsVisual(ctx).render();
    const linha = (sel) => document.querySelector(sel).closest('.ctrl-row');
    expect(linha('#opt-cbsafe').classList.contains('is-changed')).toBe(true);
    expect(linha('#opt-ownercolors').classList.contains('is-changed')).toBe(false);
    expect(linha('#opt-outline-fg').classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Boundary] cor de papel IGUAL ao padrão não marca — comparar arrays por identidade diria "alterado"', () => {
    // `[255,110,45] === [255,110,45]` é false em JS. Esse false mandaria a criança desfazer o que não fez.
    const { ctx, state } = makeCtx();
    state.outlineFg = 1;
    comViz('normal');
    initSettingsVisual(ctx).render();
    const linha = document.querySelector('#opt-role-reset').closest('.ctrl-row');
    expect(linha.classList.contains('is-changed')).toBe(false);
    expect(document.querySelector('[data-act="visual"]').classList.contains('is-changed')).toBe(false);
  });
});
