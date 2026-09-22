// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-controls — render()/handleCaptureKeydown() (project BROWSER: usa document). Contrato: DI
// por closure (ctx.$/srSay/srAlert/store/kb/setKB/kbFor/getNumPlayers/applyControls/assignControls), nenhum
// acesso a globais fora do ctx. A lógica pura (keyName/keyUsedByOther) está coberta em settings-controls.node.test.js.
// Modelo: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsControls, drawKeys, ctrlControlId } from '../app/js/ui/settings-controls.js';
import { keyUsedByOther } from '../app/js/ui/control-choices.js';

const $ = (sel) => document.querySelector(sel);

// Um KB de teste com 2 jogadores (schemes distintos), como o input/keyboard.ts real (solo/p2/p3/p4).
function makeKB() {
  return {
    p2: [
      { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] },
      { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] },
    ],
  };
}

// Fábrica do ctx de teste. `kb` é mutável no closure (kbFor sempre lê o valor atual — o "setter" ctx.setKB troca
// essa referência, como o game.js reatribuindo seu `let KB`). said/alerted/applyCalls/store ficam expostos no
// objeto retornado para os testes inspecionarem os efeitos colaterais.
function buildCtx(over = {}) {
  const said = [];
  const alerted = [];
  const applyCalls = { applyControls: 0, assignControls: 0 };
  let kb = makeKB();
  const store = {
    saved: [],
    saveKB(k) { this.saved.push(k); },
    reposicoes: 0,
    resetKB() { this.reposicoes++; return makeKB(); },
  };
  return {
    $,
    // As posicoes que ESTE 'jogo' usa. Num teste, o jogo e o fixture — e e por isso que a lista
    // vive aqui e nao numa tabela da engine: era a engine a decidir que todo jogo tem quatro verbos.
    acoesDoJogo: () => [
      { acao: 'left', rotulo: 'Esquerda' }, { acao: 'right', rotulo: 'Direita' },
      { acao: 'up', rotulo: 'Subir' }, { acao: 'down', rotulo: 'Descer' },
      { acao: 'action1', rotulo: 'Correr' }, { acao: 'action2', rotulo: 'Pular' },
      { acao: 'action4', rotulo: 'Trocar' }, { acao: 'action3', rotulo: 'Especial' },
    ],
    srSay: (msg) => said.push(msg),
    srAlert: (msg) => alerted.push(msg),
    store,
    kb,
    kbFor: (i) => kb.p2[i] ?? kb.p2[0],
    // ⚠️ O ESQUEMA DE FÁBRICA DESTE ASSENTO, e ele é INJECTADO pela mesma razão que o `kbFor`: o mapeamento
    // «quantos jogadores → que balde» (`p2`/`p3`/`p4`) é do consumidor, e duplicá-lo dentro da engine seria a
    // segunda cópia de uma regra. O duplo usa o MESMO `makeKB()` que semeia o `kb`, que é o que faz «igual ao
    // padrão» significar aqui o que significa no jogo.
    kbPadraoFor: (i) => makeKB().p2[i] ?? makeKB().p2[0],
    getNumPlayers: () => 2,
    applyControls: () => { applyCalls.applyControls++; },
    assignControls: () => { applyCalls.assignControls++; },
    setKB: (next) => { kb = next; },
    said, alerted, applyCalls,
    ...over,
  };
}

describe('ui/settings-controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('[Zero] render() sem #ctrl-list no DOM não lança (só não desenha)', () => {
    document.body.innerHTML = '';
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    expect(() => api.render(0)).not.toThrow();
  });

  it('[Interface] render(0) preenche #ctrl-list com uma linha por ação e o hint de #ctrl-players', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const rows = $('#ctrl-list').querySelectorAll('.ctrl-row');
    expect(rows.length).toBe(8); // as 8 ações de ACT_LABEL
    expect($('#ctrl-players').innerHTML).toContain('2 jogadores');
    expect($('#ctrl-list').innerHTML).toContain('<kbd>A</kbd>'); // KeyA do jogador 0 -> "A"
  });

  it('🔴 [Boundary] uma posição INVENTADA não inicia captura — e o comentário já dizia porquê', () => {
    // O módulo escreve, ao lado do guarda: «uma captura iniciada sobre uma posição inventada gravaria uma
    // tecla numa chave que transporte nenhum lê — a criança carregaria a tecla nova e nada aconteceria».
    // O valor vem de um ATRIBUTO do DOM, e desde a #118 o esquema só aceita as catorze posições.
    //
    // ⚠️ HONESTIDADE SOBRE O QUE ESTE CASO PRENDE, medido por sonda em 22/09: há DOIS guardas neste caminho —
    // o `isAction` e a falta de PALAVRA para uma acção que o jogo não declara — e apagar qualquer um deles
    // sozinho ainda passa aqui. Ele prende o COMPORTAMENTO, não um guarda específico, e isso é o que se pode
    // afirmar: a mutação do `isAction` sozinha é EQUIVALENTE hoje. Ela deixa de ser no dia em que uma posição
    // fora do esquema tiver palavra — e é aí que este caso passa a segurar o primeiro guarda sozinho.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const falso = $('#ctrl-list').querySelector('button[data-act]');
    const rotuloAntes = falso.textContent;
    falso.dataset.act = 'action99';
    falso.click();
    expect(api.isCapturing(), 'a captura começou sobre uma posição que não existe').toBe(false);
    expect(ctx.alerted, 'nada foi anunciado: não há acção a mapear').toHaveLength(0);
    expect(falso.textContent, 'o botão não pode dizer «aperte» sem estar a capturar').toBe(rotuloAntes);
  });

  it('🔴 [Right] a linha «você edita o SEU controle» aparece — um painel que não diz de quem é confunde', () => {
    // Achado por sonda em 22/09: manter o `#ctrl-players` escondido passava verde. Num jogo de dois, quem
    // abre este menu precisa de saber que está a mexer no próprio controle e não no do colega — sem isso a
    // criança remapeia, testa no controle errado e conclui que o menu não funciona.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    const linha = $('#ctrl-players');
    expect(linha.hidden, 'a linha existe no documento mas ninguém a vê').toBe(false);
    expect(linha.textContent).toContain('2 jogadores');
  });

  it('[Right] ⚠️ a PALAVRA DO JOGO entra por texto, nunca por markup (issue #106)', () => {
    // `acoesDoJogo()` devolve os rótulos do PRESET — as palavras deste jogo —, e um jogo vive hoje noutro
    // repositório e consome a engine como pacote (ADR-0083). Esta árvore não revê esse texto.
    //
    // ⚠️ E A ASSIMETRIA COM `data-act` É A PROVA DE QUE A SEPARAÇÃO DO ADR-0086 SERVE PARA ALGUMA COISA: o
    // nome ABSTRATO (`action2`) é da engine, enumerado em `core/actions`, e continua a ir no atributo sem
    // risco; a PALAVRA (`Pular`) é do jogo, e é ela que tem de sair do markup.
    // ⚠️ O PAYLOAD ESCAPA DO CONTÊINER, e a escolha custou duas mutações sobreviventes até acertar.
    //
    // Um `<img onerror>` não serve aqui: o `onerror` é ASSÍNCRONO e o caso acaba antes de ele disparar. E
    // aferir o DOM final também não serve — repor a interpolação e deixar o `textContent` por cima produz o
    // MESMO DOM, embora o `innerHTML` já tenha analisado a marcação pelo caminho.
    //
    // O que discrimina é o que um atacante de facto faz: FECHAR as tags e sair. O elemento injetado aterra
    // FORA do `.ctrl-nome`, então nenhum `textContent` posterior o apaga — e ele fica visível ao caso.
    const ctx = buildCtx();
    const FUGA = '</b></span></div><i id="fugiu-do-jogo"></i>';
    ctx.acoesDoJogo = () => [{ acao: 'action2', rotulo: FUGA }];
    initSettingsControls(ctx).render(0);

    const lista = $('#ctrl-list');
    expect(lista.querySelector('#fugiu-do-jogo'), 'a palavra do jogo foi ANALISADA como marcação').toBe(null);
    expect(lista.querySelector('.ctrl-row strong').textContent).toBe(FUGA);
    expect(lista.querySelector('button[data-act]').dataset.act).toBe('action2'); // o nome abstrato fica
  });

  it('[Interface] render(0) x render(1) mostram os esquemas de cada jogador (não compartilham)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1);
    expect($('#ctrl-list').innerHTML).toContain('↔Left'); // ArrowLeft do jogador 1
  });

  it('[Right] clicar em "Alterar" inicia a captura: isCapturing()=true, texto vira "Pressione…" e srAlert soa', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const btn = $('#ctrl-list').querySelector('button[data-act="action2"]');
    btn.click();
    expect(api.isCapturing()).toBe(true);
    expect(btn.textContent).toBe('Pressione…');
    expect(ctx.alerted).toEqual(['Pressione a nova tecla para Pular do Jogador 1, ou Esc para cancelar.']);
  });

  it('[Right] handleCaptureKeydown com Escape cancela a captura e re-renderiza', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'Escape', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    // 📌 A cara do botão volta a ser a TECLA DE AGORA, não a palavra «Alterar» — decisão do Dev em 22/09, ao
    // escolher a opção B: o valor vive dentro do controle, como nos passos. `action2` do jogador 0 é `KeyJ`.
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').textContent).toBe('J');
  });

  it('[Right] handleCaptureKeydown com tecla livre associa, persiste e propaga', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'KeyP', preventDefault: () => {} };
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyP']);
    expect(ctx.store.saved).toHaveLength(1);
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    // 🎯 E A TECLA NOVA APARECE NO BOTÃO SEM MAIS NADA ACONTECER: a cara dele É o valor, então remapear
    // mostra-se no mesmo sítio onde se remapeia. Antes era preciso ler a linha ao lado para saber se pegou.
    expect($('#ctrl-list').querySelector('button[data-act="action2"]').innerHTML).toBe('<kbd>P</kbd>');
  });

  it('🔴 [Many] a cara do botão é REESCRITA, não acrescentada — duas teclas não viram quatro', () => {
    // `drawKeys` é chamada a cada render e a cada captura. Se ela acrescentasse em vez de reescrever, o botão
    // acumularia as teclas de todas as vezes que a criança abriu o menu — e o alvo cresceria até partir a linha.
    const b = document.createElement('button');
    drawKeys(b, ['KeyA', 'ArrowLeft']);
    expect([...b.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['A', '↔Left']);
    drawKeys(b, ['KeyP']);
    expect([...b.querySelectorAll('kbd')].map((k) => k.textContent), 'as teclas antigas ficaram').toEqual(['P']);
  });

  it('[Right] o id de um botão sai do nome ABSTRATO da posição, e é o mesmo que a lista usa', () => {
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    expect(ctrlControlId('action2')).toBe('ctrl-act-action2');
    expect($('#ctrl-list').querySelector(`#${ctrlControlId('action2')}`).dataset.act).toBe('action2');
  });

  it('🔴 [Zero] uma posição SEM tecla mostra a palavra — um botão sem cara é um alvo que não diz nada', () => {
    // A cara do botão é a tecla de agora; sem nenhuma, ele ficaria com 44 px de nada. Aí volta «Alterar», que
    // é onde a palavra ainda significa alguma coisa: não há tecla para mostrar, há uma para pôr.
    const ctx = buildCtx();
    ctx.kbFor = () => ({ action2: [] });
    ctx.acoesDoJogo = () => [{ acao: 'action2', rotulo: 'Pular' }];
    initSettingsControls(ctx).render(0);
    const b = $('#ctrl-list').querySelector('button[data-act="action2"]');
    expect(b.textContent).toBe('Alterar');
    expect(b.querySelector('kbd'), 'sem tecla não há caixinha para desenhar').toBeNull();
  });

  it('🔴 [Right] o nome acessível diz A ACÇÃO E O JOGADOR — e não só a palavra do jogo', () => {
    // 🔴 BURACO QUE A CONVERSÃO CRIOU, achado por sonda em 22/09: sem o `rotuloAria`, o kit cai no `rotulo`, e
    // o botão passa a anunciar-se «Pular» — plausível e errado. Quem ouve deixa de saber que aquilo ALTERA a
    // tecla, e em dois jogadores deixa de saber de QUEM. É pior do que antes da conversão, onde o atributo era
    // escrito à mão, e é a mesma família da #125: um `aria-label` errado SOBREPÕE-SE ao texto visível.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(1);
    const b = $('#ctrl-list').querySelector('button[data-act="action2"]');
    expect(b.getAttribute('aria-label')).toBe('Alterar tecla de Pular do Jogador 2');
    expect(b.getAttribute('aria-label'), 'o rótulo nu não diz o que o botão faz').not.toBe('Pular');
  });

  it('🔴 [Zero] cada botão tem um id PRÓPRIO — dois nós com o mesmo id é um documento inválido', () => {
    // Achado por sonda: trocar o id por uma constante passava verde, e ficavam oito nós com `id="ctrl-act"`.
    // O id sai do nome ABSTRATO da posição, que `core/actions` garante único.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    const ids = [...$('#ctrl-list').querySelectorAll('button[data-act]')].map((b) => b.id);
    expect(ids.filter(Boolean), 'algum botão ficou sem id').toHaveLength(ids.length);
    expect(new Set(ids).size, 'dois botões partilham o mesmo id').toBe(ids.length);
  });

  it('🔴 [Right] o `fillExplain` não come a linha — o `<span>` traz o nome e mais nada', () => {
    // 📏 A colisão que decidiu a forma desta linha, medida numa sonda em 22/09: com as teclas DENTRO do
    // `<span>`, o `fillExplain` faz `span.innerHTML = strong.outerHTML` e das duas `<kbd>` sobrevivem ZERO —
    // o painel de remapeamento deixaria de mostrar o que está mapeado. Com o valor no CONTROLE, a descrição
    // que ele calcula é vazia e a linha fica intacta. Este caso é o que impede o valor de voltar ao `<span>`.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    for (const linha of $('#ctrl-list').querySelectorAll('.ctrl-row')) {
      const span = linha.querySelector(':scope > span');
      expect(span.querySelectorAll('kbd'), 'a tecla voltou para dentro do rótulo').toHaveLength(0);
      expect(span.textContent, 'o span traz o nome e mais nada').toBe(span.querySelector('strong').textContent);
    }
  });

  it('[Boundary] handleCaptureKeydown com tecla já usada por OUTRO jogador alerta e mantém a captura', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0); // editando o jogador 0
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    const e = { code: 'ArrowLeft', preventDefault: () => {} }; // é do jogador 1 (índice 1)
    const consumed = api.handleCaptureKeydown(e);
    expect(consumed).toBe(true);
    expect(api.isCapturing()).toBe(true); // segue capturando
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // não mudou
    expect(ctx.alerted.at(-1)).toBe('Essa tecla já é do Jogador 2. Escolha outra, ou Esc para cancelar.');
    expect(ctx.store.saved).toHaveLength(0);
  });

  it('🔴 [Boundary] NENHUM nome abstracto chega à criança — nem quando a tecla está numa posição sem palavra', () => {
    // 🔴 A REGRA MAIS AFIADA DO ADR-0074, e ela nunca teve gate: «o nome que a CRIANÇA lê e ouve — na tela de
    // remapeamento, na bolha de toque, no anúncio — é sempre a palavra do jogo, nunca `action1`. Um nome
    // abstracto que chega a uma pessoa é um defeito.»
    //
    // ⚠️ E ESTAVA A UM TOQUE DE DISTÂNCIA, com o esquema PADRÃO da própria engine. Ele liga OITO posições
    // (`left/right/up/down` + `action1..action4`); um quiz nomeia três. A criança abre a tela — que só mostra
    // as três linhas nomeadas —, escolhe «Confirmar», e carrega numa tecla que o padrão tem em `action2`. O
    // `actionAlreadyBound` procura no ESQUEMA e não na lista do jogo, então devolvia uma posição sem palavra, e o
    // leitor de tela dizia «Essa tecla já é de action2» — à criança cega, que é quem a regra protege.
    //
    // 📌 O `core/actions.labellerFrom` já tinha decidido a saída certa — devolver `null` e o chamador tratar a
    // ausência — e este ficheiro tinha decidido outra. Duas respostas à mesma pergunta, e uma contraria um ADR
    // aceite.
    const ctx = buildCtx({
      acoesDoJogo: () => [
        { acao: 'up', rotulo: 'Subir' }, { acao: 'down', rotulo: 'Descer' },
        { acao: 'action1', rotulo: 'Confirmar' },
      ],
    });
    const api = initSettingsControls(ctx);
    api.render(0);
    const tomada = ctx.kbFor(0).action2[0]; // a tecla que o esquema padrão já deu a uma posição SEM palavra
    $('#ctrl-list').querySelector('button[data-act="action1"]').click();
    const consumed = api.handleCaptureKeydown({ code: tomada, preventDefault: () => {} });

    expect(consumed).toBe(true);
    expect(api.isCapturing(), 'recusar tem de manter a captura, senão a criança perde o passo').toBe(true);
    const dito = ctx.alerted.at(-1);
    expect(dito, 'o anúncio tem de existir — recusar em silêncio é o defeito gémeo').toBeTruthy();
    expect(dito, 'nome abstracto de posição falado a uma criança (ADR-0074)').not.toMatch(/action[1-8]|leftShoulder|rightShoulder|leftTrigger|rightTrigger/);
  });

  it('[Right] e quando o jogo NOMEIA a posição, o anúncio diz a palavra dele', () => {
    // O outro lado do mesmo par: sem este caso, calar o anúncio por completo passaria no caso acima.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const tomada = ctx.kbFor(0).action2[0];
    $('#ctrl-list').querySelector('button[data-act="action1"]').click();
    api.handleCaptureKeydown({ code: tomada, preventDefault: () => {} });
    expect(ctx.alerted.at(-1)).toContain('Pular'); // a palavra que ESTE jogo dá a `action2`
  });

  // ===================== A MARCA DE «SAIU DO PADRÃO» NO REMAPEAMENTO (ADR-0029 · #61) =====================
  // ⚠️ ERA O ÚLTIMO MENU SEM MARCA. Uma tecla remapeada É «saiu do padrão» — e este é o menu onde a criança
  // mais provavelmente mexeu, porque é o único cuja razão de existir é mexer. Sem a marca ela percorre o menu,
  // ouve os nomes das acções, e nada lhe diz onde ela própria alterou.
  const linhaDe = (act) => $(`#ctrl-list button[data-act="${act}"]`)?.closest('.ctrl-row') ?? null;
  const marcada = (el) => !!el && el.classList.contains('is-changed');

  it('🎯 [Zero] com o esquema de FÁBRICA, nada fica marcado', () => {
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    for (const a of ['action1', 'action2', 'left']) expect(marcada(linhaDe(a)), `${a} marcado sem ter mudado`).toBe(false);
    // 📌 A marca do BOTÃO que abre este ecrã não é daqui: quem desenha o `#map-hub` é o `ui/settings-mobility`, e
    // marcá-lo de dois sítios seria a segunda resposta à mesma pergunta. Aqui marcam-se as LINHAS.
  });

  it('🎯 [Right] só a acção REMAPEADA fica marcada', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} });
    expect(marcada(linhaDe('action2')), 'a acção remapeada não foi marcada').toBe(true);
    expect(marcada(linhaDe('action1')), 'marcou uma acção que ninguém tocou').toBe(false);
  });

  it('⚠️ [Boundary] a MESMA tecla do padrão, reatribuída, NÃO é uma mudança', () => {
    // O caso que separa «mexeu» de «mexeu e voltou». Uma comparação por identidade de objecto, ou um sinal
    // levantado no clique, diria que mudou — e a criança ouviria «alterado» sobre a tecla de fábrica.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const original = ctx.kbFor(0).action2[0];
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: original, preventDefault: () => {} });
    expect(marcada(linhaDe('action2')), 'reatribuir a MESMA tecla contou como mudança').toBe(false);
  });

  it('⚠️ [Boundary] perder a tecla ALTERNATIVA é uma mudança, mesmo mantendo a primeira', () => {
    // ⚠️ CASO ACHADO POR MUTAÇÃO SOBREVIVENTE, e o cenário é real: o esquema de fábrica tem acções com DUAS
    // teclas (`input/keyboard.ts` dá `action3: ['Semicolon','Slash']`), e o remapeamento escreve sempre UMA
    // (`mapRef[act] = [e.code]`). Uma criança que remapeie para a PRIMEIRA das duas fica com `['Semicolon']`
    // onde a fábrica tinha `['Semicolon','Slash']`.
    //
    // 🎯 Sem a verificação de COMPRIMENTO, o `every` percorre só o array curto, responde `true`, e a marca não
    // acende — ela perdeu a tecla alternativa e nada lho diz. O `every` sozinho compara prefixos, não listas.
    const ctx = buildCtx();
    const comDuas = { ...ctx.kbFor(0), action3: ['Semicolon', 'Slash'] };
    ctx.kbPadraoFor = () => comDuas;
    ctx.kbFor = () => ({ ...comDuas, action3: ['Semicolon'] });
    initSettingsControls(ctx).render(0);
    expect(marcada(linhaDe('action3')), 'perdeu a tecla alternativa e não foi marcado').toBe(true);
    expect(marcada(linhaDe('action1')), 'marcou uma acção intacta').toBe(false);
  });

  it('⚠️ [Zero] ler o padrão NÃO apaga as teclas guardadas', () => {
    // 🎯 A armadilha que este caso fecha: `input/keyboard.resetKB()` parece um leitor do esquema de fábrica e
    // é DESTRUTIVO — faz `store.remove(CKEY)` antes de devolver a cópia. Usá-lo para desenhar a marca apagaria
    // o remapeamento da criança a cada render, e o defeito só apareceria no arranque seguinte.
    const ctx = buildCtx();
    initSettingsControls(ctx).render(0);
    expect(ctx.store.saved, 'desenhar a marca gravou por cima do esquema').toHaveLength(0);
    expect(ctx.store.reposicoes ?? 0, 'desenhar a marca chamou `resetKB`').toBe(0);
  });

  it('[Zero] handleCaptureKeydown sem captura em andamento retorna false e não toca no DOM', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    const html = $('#ctrl-list').innerHTML;
    expect(api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} })).toBe(false);
    expect($('#ctrl-list').innerHTML).toBe(html);
  });

  it('[Interface] cancelCapture() encerra a captura sem re-renderizar (fechamento do diálogo)', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    expect(api.isCapturing()).toBe(true);
    api.cancelCapture();
    expect(api.isCapturing()).toBe(false);
  });

  it('[Right] clicar em #ctrl-reset restaura os padrões, propaga, re-renderiza e anuncia', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    // desvia o esquema do jogador 0 do padrão, como se já tivesse sido remapeado antes
    ctx.kbFor(0).jump = ['KeyZ'];
    api.render(0);
    $('#ctrl-reset').click();
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']); // setKB trocou o KB inteiro pelo default
    expect(ctx.applyCalls.applyControls).toBe(1);
    expect(ctx.applyCalls.assignControls).toBe(1);
    expect(ctx.said).toEqual(['Controles restaurados ao padrão.']);
    expect($('#ctrl-list').innerHTML).toContain('<kbd>J</kbd>'); // voltou ao padrão (KeyJ)
  });

  it('[Cross-check] setKB injetado recebe exatamente o retorno de store.resetKB()', () => {
    const received = [];
    const ctx = buildCtx({ setKB: (next) => received.push(next) });
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-reset').click();
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(makeKB());
  });

  it('[Error] captureMapRef aponta pro objeto do jogador certo mesmo após um render de outro jogador antes', () => {
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(1); // edita jogador 1 primeiro
    api.render(0); // depois troca p/ jogador 0
    $('#ctrl-list').querySelector('button[data-act="left"]').click();
    api.handleCaptureKeydown({ code: 'KeyQ', preventDefault: () => {} });
    expect(ctx.kbFor(0).left).toEqual(['KeyQ']);
    expect(ctx.kbFor(1).left).toEqual(['ArrowLeft']); // jogador 1 intocado
  });
});

// ==========================================================================================================
// ⚠️ A MESMA TECLA EM DUAS AÇÕES DO MESMO ESQUEMA (#126) — E O DEFEITO SÓ EXISTE COM UM JOGADOR
//
// Medido ao construir o `game-soccer`, o primeiro consumidor a usar as catorze posições. A tela de
// remapeamento guardava com `keyUsedByOther(code, mapRef, schemes)`, que exclui o esquema em edição **por
// referência**. Com um jogador só, `schemesFor()` devolve exatamente esse esquema — a guarda varre uma lista
// vazia e NUNCA PODE DISPARAR.
//
// ⚠️ A guarda entre JOGADORES não estava partida: estava INALCANÇÁVEL. Com dois assentos ela recusa certo, e
// os casos abaixo afirmam as duas coisas lado a lado, porque foi essa distinção que atrasou o diagnóstico.
//
// ⚠️ E O FEITIO DO DEFEITO É O PIOR QUE ESTE PRODUTO TEM. O cabeçalho do `input/default-bindings` já o
// descrevia: «as duas ações disparam juntas, e a criança vê uma ação dupla intermitente que ninguém consegue
// reproduzir de propósito». Numa tela que ela abriu PORQUE não conseguia usar os controles padrão.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
// ==========================================================================================================
describe('ui/settings-controls — uma tecla, uma ação, dentro do mesmo esquema (#126)', () => {
  const UM_JOGADOR = { p2: [{ left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] }] };

  function soloCtx(over = {}) {
    let kb = JSON.parse(JSON.stringify(UM_JOGADOR));
    return buildCtx({ kb, kbFor: () => kb.p2[0], getNumPlayers: () => 1, setKB: (n) => { kb = n; }, ...over });
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('⚠️ [Cross-check] com UM jogador a guarda antiga é cega — sem isto, nada abaixo prova o defeito', () => {
    // `KeyW` está em `up` do único esquema. `keyUsedByOther` responde -1, porque exclui esse esquema por
    // referência e não sobra mais nenhum. É o defeito em uma linha.
    const ctx = soloCtx();
    expect(keyUsedByOther('KeyW', ctx.kbFor(0), [ctx.kbFor(0)]),
      'a guarda entre jogadores viu a tecla; entao o defeito e outro').toBe(-1);
  });

  it('⚠️ [Right] remapear para uma tecla que JA e de outra acao e RECUSADO, e o anuncio diz qual', () => {
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    const consumed = api.handleCaptureKeydown({ code: 'KeyW', preventDefault: () => {} });
    expect(consumed).toBe(true);
    expect(api.isCapturing(), 'associou e fechou a captura').toBe(true);
    expect(ctx.kbFor(0).action2, 'a tecla foi presa a duas acoes').toEqual(['KeyJ']);
    expect(ctx.kbFor(0).up, 'a acao antiga perdeu a tecla').toEqual(['KeyW']);
    expect(ctx.alerted, 'anunciou mais do que uma coisa').toHaveLength(1);
    expect(ctx.alerted[0], 'o anuncio nao nomeia a acao que ja tem a tecla').toContain('Subir');
    expect(ctx.alerted[0], 'nao e a frase de conflito').toContain('Escolha outra');
  });

  it('⚠️ [Interface] o nome vem do JOGO, nao da tabela do jogo de plataforma (#125)', () => {
    // `ACT_LABEL` diz «Subir» porque e a palavra DAQUELE jogo. Um jogo que chame a posicao de outra coisa
    // tem de ouvir a palavra dele — e este caso e o que impede o atalho de voltar.
    const ctx = soloCtx({ acoesDoJogo: () => [{ acao: 'up', rotulo: 'Cabecear' }, { acao: 'action2', rotulo: 'Chutar' }] });
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    api.handleCaptureKeydown({ code: 'KeyW', preventDefault: () => {} });
    expect(ctx.alerted[0]).toContain('Cabecear');
  });

  it('[Boundary] reapertar a tecla que a PROPRIA acao ja tem nao e conflito', () => {
    // Ela ja e dela. Recusar aqui seria a tela a dizer «essa tecla e sua» a quem a estava a confirmar.
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyJ', preventDefault: () => {} });
    expect(api.isCapturing(), 'recusou a propria tecla da acao').toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyJ']);
  });

  it('[Right] uma tecla LIVRE continua a ser aceite — a guarda nova nao fecha a tela', () => {
    const ctx = soloCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    api.handleCaptureKeydown({ code: 'KeyP', preventDefault: () => {} });
    expect(api.isCapturing()).toBe(false);
    expect(ctx.kbFor(0).action2).toEqual(['KeyP']);
  });

  it('⚠️ [Interface] com DOIS assentos a guarda antiga continua a valer, e diz o JOGADOR', () => {
    // A regressao que eu poderia introduzir: fazer a verificacao nova comer a antiga. Sao mensagens
    // diferentes de proposito — «e de outra crianca» e «e de outra acao tua» nao se resolvem igual.
    const ctx = buildCtx();
    const api = initSettingsControls(ctx);
    api.render(0);
    $('#ctrl-list').querySelector('button[data-act="action2"]').click();
    ctx.alerted.length = 0;
    api.handleCaptureKeydown({ code: 'ArrowLeft', preventDefault: () => {} });
    expect(api.isCapturing()).toBe(true);
    expect(ctx.alerted[0]).toContain('Jogador 2');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · tirando o bloco `const aqui = actionAlreadyBound(...)` de `handleCaptureKeydown` → reprovam DOIS casos:
//     "[Right] remapear para uma tecla que JA e de outra acao" (a captura fecha e `KeyW` fica em `action2` E
//     em `up`) e "[Interface] o nome vem do JOGO". E o defeito da #126 reproduzido.
//   · trocando o `if (a === exceto) continue;` de `actionAlreadyBound` por nada → "[Boundary] reapertar a tecla que
//     a PROPRIA acao ja tem" reprova: a tela recusa a tecla a quem ja a tinha.
//   · trocando `ctx.acoesDoJogo()...rotulo` por `t(ACT_LABEL[aqui])` → "[Interface] o nome vem do JOGO"
//     reprova, que e a #125 a nao voltar a entrar por esta porta.
//
// ⚠️ E UMA COISA QUE NAO E MUTACAO CONFERIDA, dita para nao passar por uma: a ORDEM entre as duas guardas
// nao esta aferida. Eu esperaria que trocar nao mudasse nada — elas olham para conjuntos disjuntos —, mas
// nao corri essa mutacao, e uma expectativa nao e uma medicao. Fica como buraco conhecido: se um dia uma
// tecla puder estar em dois esquemas ao mesmo tempo, a ordem passa a decidir QUAL das duas frases a crianca
// ouve, e ai vale um caso proprio.

// ==========================================================================================================
// ⚠️ O `aria-label` DIZ A PALAVRA DO JOGO, OU MENTE PARA QUEM NAO VE (#125)
//
// Medido ao construir o `game-soccer`: a tela anunciava **«Alterar tecla de undefined do Jogador 1» em seis
// de doze botoes**, enquanto uma crianca que ve lia «Conter» na mesma linha. Nos outros seis dizia as
// palavras do jogo de PLATAFORMA.
//
// A causa: a #106 mudou o rotulo VISIVEL para `ctx.acoesDoJogo()` e deixou o `aria-label` a ser montado do
// `ACT_LABEL`, a tabela de oito posicoes deste ficheiro. ⚠️ E um `aria-label` SOBREPOE-SE ao texto visivel,
// entao quem depende do leitor de tela ouvia a palavra errada — pior do que nao ter `aria-label` nenhum, e
// invisivel de dentro da engine, porque a plataforma e o unico consumidor para o qual a tabela esta certa.
//
// ⚠️ O `undefined` vem das SEIS posicoes que o `ACT_LABEL` nao tem: ele conhece oito, e o vocabulario fechou
// nas catorze (#118). `t(undefined)` devolve a chave, e a moldura interpola-a como texto.
//
// MUTACOES CONFERIDAS (no fim do bloco).
// ==========================================================================================================
describe('ui/settings-controls — o que o leitor de tela ouve e a palavra DESTE jogo (#125)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ctrl-players"></div><div id="ctrl-list"></div><button id="ctrl-reset"></button>';
  });

  it('⚠️ [Right] o aria-label de cada botao usa o rotulo do jogo, nao a tabela da engine', () => {
    const ctx = buildCtx({ acoesDoJogo: () => [{ acao: 'up', rotulo: 'Cabecear' }, { acao: 'action2', rotulo: 'Chutar' }] });
    initSettingsControls(ctx).render(0);
    const rotulos = [...$('#ctrl-list').querySelectorAll('button[data-act]')].map((b) => b.getAttribute('aria-label'));
    expect(rotulos).toHaveLength(2);
    expect(rotulos[0]).toContain('Cabecear');
    expect(rotulos[1]).toContain('Chutar');
  });

  it('⚠️ [Zero] NENHUM aria-label da tela contem "undefined"', () => {
    // O caso que teria apanhado a #125 no dia. As catorze posicoes, das quais o `ACT_LABEL` so conhecia oito.
    const TODAS = ['left', 'right', 'up', 'down', 'action1', 'action2', 'action3', 'action4',
      'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger', 'start', 'select'];
    const ctx = buildCtx({ acoesDoJogo: () => TODAS.map((a) => ({ acao: a, rotulo: 'W' + a })) });
    initSettingsControls(ctx).render(0);
    const maus = [...$('#ctrl-list').querySelectorAll('button[data-act]')]
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((s) => s.includes('undefined') || s.trim() === '');
    expect(maus, 'aria-label sem palavra: a crianca ouve isto em vez do nome da acao').toEqual([]);
  });

  it('⚠️ [Interface] o rotulo do jogo entra por API do DOM, e nao por interpolacao em markup', () => {
    // O rotulo e texto de FORA. Se fosse para dentro do template do `aria-label`, um preset podia fechar o
    // atributo e abrir outro. O caso passa uma aspa e um `<img>` e exige que nada disso vire marcacao.
    const VENENO = '" onmouseover="alert(1)" x="<img src=x onerror=alert(1)>';
    const ctx = buildCtx({ acoesDoJogo: () => [{ acao: 'up', rotulo: VENENO }] });
    initSettingsControls(ctx).render(0);
    const lista = $('#ctrl-list');
    expect(lista.querySelector('img'), 'o rotulo foi ANALISADO como marcacao').toBe(null);
    const b = lista.querySelector('button[data-act]');
    expect(b.getAttribute('onmouseover'), 'o rotulo abriu um atributo novo').toBe(null);
    expect(b.getAttribute('aria-label')).toContain('onmouseover');
  });

  it('⚠️ [Right] a frase de captura e a do modo passam por t(), sem portugues cravado', () => {
    // Duas frases estavam em portugues cru dentro do motor: o texto do botao em captura, e a linha inteira
    // do `#ctrl-players`. As duas contra o pilar 3, na tela que a crianca abre POR NAO conseguir jogar.
    // `kbFor` do fixture ja recua para `p2[0]`, entao um jogador so nao precisa de mais nada.
    const ctx = buildCtx({ getNumPlayers: () => 1 });
    const api = initSettingsControls(ctx);
    api.render(0);
    expect($('#ctrl-players').textContent, 'a linha do modo nao foi montada').toContain('1 jogador');
    expect($('#ctrl-players').querySelector('strong'), 'o realce do modo desapareceu').not.toBe(null);
    const btn = $('#ctrl-list').querySelector('button[data-act]');
    btn.click();
    expect(btn.textContent).toBe('Pressione…');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · devolvendo o `aria-label` ao template com `t(ACT_LABEL[a]!)` → reprovam TRES casos: "[Zero] NENHUM
//     aria-label contem undefined" (com as seis posicoes que o `ACT_LABEL` nao conhece), "[Right] o
//     aria-label usa o rotulo do jogo" e tambem o "[Interface]" — porque o template volta a interpolar. E a
//     #125 reproduzida, com o mesmo numero que a auditoria mediu.
//   · pondo o rotulo dentro do template (`aria-label="${rotulo}"`) em vez de `setAttribute` → "[Interface] o
//     rotulo entra por API do DOM" reprova com o `<img>` montado e o `onmouseover` no botao.
//   · trocando `t('ctrl.pressing')` de volta por `'Pressione…'` cravado → NENHUM caso reprova, porque o
//     portugues cravado e a traducao pt sao a MESMA cadeia. ⚠️ Registado como mutacao que nao falha: o que a
//     apanha e o gate de prosa do `engine-i18n`, e so porque a frase tem acento. Um caso que a prendesse
//     teria de trocar o idioma em tempo de teste, e o `setLocale` nao esta ligado neste ficheiro.
//
// --- 2026-09-08 · o nome abstracto que chegava a uma crianca (ADR-0074) ---
//   · 🔴 `palavraDaAcao` a recuar para `?? a` — O DEFEITO REPOSTO, e nao uma mutacao inventada: era o codigo
//     que estava aqui, defendido por um comentario. Reprova o caso novo, e so ele. Todo o resto do ficheiro
//     fica verde com ele aplicado, que e a medida de quanto isto passava sem ser visto.
//   · o ramo invertido (`ctx.srAlert(!palavra`) → reprovam TRES: quem tem palavra ouve a frase generica e
//     quem nao tem ouve o id. E o par de casos a funcionar como par — um so nao apanharia a inversao.
//   · a frase generica a ficar VAZIA → reprova o caso novo pela assercao do `toBeTruthy`. Recusar em silencio
//     e o defeito GEMEO de dizer `action2`, e sem essa linha o gate premiaria calar o anuncio.
//   · ⚠️ NAO MUTADA, e declarado em vez de escondido: `if (!palavra) return;` no inicio da captura. Ela e
//     hoje INALCANCAVEL — o `render` so emite linhas de `acoesDoJogo()`, logo `capture.action` tem sempre
//     palavra —, entao qualquer mutacao dela e EQUIVALENTE. Fica como guarda para quem mudar a origem das
//     linhas, e o comentario no codigo diz isso; um caso que a prendesse teria de renderizar uma linha que a
//     engine nao consegue produzir.
