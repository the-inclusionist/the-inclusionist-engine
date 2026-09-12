// SPDX-License-Identifier: AGPL-3.0-or-later
// UMA LINHA DE MENU, E O INTERIOR DO PAINEL MOTORA — o contrato invisível um nível abaixo do `panel-shell`.
//
// ========================= POR QUE ESTES CASOS SÃO DE NAVEGADOR =========================
// A regra herdada do `boot-create-game.browser.test.js`: **um caso só entra aqui se o DOM falso não o
// conseguisse fazer.** O que se pergunta é se o controle criado é mesmo um `<select>` e não um `<button>`, se
// o `.opt-hint` está DENTRO do `<span>` onde o `fillExplain` o vai procurar, e se montar duas vezes deixa uma
// linha. Um duplo responde «sim» às três sem que nenhuma seja verdade.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { linhaDeControle, rotularLinha } from '../app/js/ui/panel-widgets.js';
import { montarInteriorDoMotor } from '../app/js/ui/settings-motor.js';
import { montarInteriorDoAudio } from '../app/js/ui/settings-audio.js';
import { montarCasca } from '../app/js/ui/panel-shell.js';

const ctx = {
  procurar: (s) => document.querySelector(s),
  criar: (t) => document.createElement(t),
};

let hospedeiro;
beforeEach(() => {
  hospedeiro = document.createElement('div');
  document.body.appendChild(hospedeiro);
});
afterEach(() => { hospedeiro.remove(); });

describe('linhaDeControle — a regra de menu do CLAUDE.md §4, por construção', () => {
  it('🎯 [Right] o rótulo curto fica à vista e a prosa vai num `.opt-hint` DENTRO do `<span>`', () => {
    // É onde o `ui/settings-panel.fillExplain` a procura para a mover ao rodapé. Fora do `<span>` ela nunca
    // sai da linha, e o menu volta a ser um manual — o resultado que o Dev já viu e nomeou.
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Modo Fácil', dica: 'Gravidade menor.' });
    hospedeiro.appendChild(linha);
    expect(linha.className).toBe('ctrl-row');
    expect(linha.querySelector('strong').textContent).toBe('Modo Fácil');
    const dica = linha.querySelector('.opt-hint');
    expect(dica, 'a dica não foi criada').not.toBeNull();
    expect(dica.parentElement.tagName, 'a dica ficou fora do `<span>` onde o fillExplain a procura').toBe('SPAN');
    expect(dica.parentElement.contains(linha.querySelector('strong')), 'a dica não está no mesmo `<span>` do rótulo')
      .toBe(true);
  });

  it('⚠️ [Zero] UMA dica só — duas descrições do mesmo controle deixam sempre uma para trás', () => {
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Rótulo', dica: 'Uma explicação.' });
    expect(linha.querySelectorAll('.opt-hint')).toHaveLength(1);
  });

  it('[Zero] sem dica, não nasce `.opt-hint` vazio — o rodapé descansa no texto do painel', () => {
    const { linha } = linhaDeControle(ctx, { id: 'x', rotulo: 'Rótulo' });
    expect(linha.querySelector('.opt-hint')).toBeNull();
  });

  it('🔴 [Interface] a FORMA decide a tag — um `<select>` pedido não pode nascer `<button>`', () => {
    // ⚠️ É O DEFEITO QUE NÃO DÁ ERRO. `settings-audio` faz `ctx.$<HTMLSelectElement>('#cane-div').value = …`;
    // num `<button>` isso escreve uma propriedade que ninguém lê, e a escolha da criança some em silêncio.
    expect(linhaDeControle(ctx, { id: 'a', rotulo: 'A' }).controle.tagName).toBe('BUTTON');
    expect(linhaDeControle(ctx, { id: 'b', rotulo: 'B', forma: 'escolha' }).controle.tagName).toBe('SELECT');
    const cursor = linhaDeControle(ctx, { id: 'c', rotulo: 'C', forma: 'cursor' }).controle;
    expect(cursor.tagName).toBe('INPUT');
    expect(cursor.type).toBe('range');
    // ⚠️ E COM LIMITES: um `range` sem `min`/`max` assume 0..100, e o volume deste projeto é 0..1 — sem isto o
    // primeiro passo do cursor salta o intervalo inteiro.
    expect(cursor.min).toBe('0');
    expect(cursor.max).toBe('100');
  });

  it('🔴 [Right] o interruptor anuncia o NOME, não só o estado', () => {
    // O `textContent` de um interruptor deste projeto é «▶ Desligado». Sem `aria-label`, quem navega controlo
    // a controlo ouve «Desligado, botão» e não sabe desligado O QUÊ — o `<strong>` ao lado só serve a quem vê
    // a linha inteira.
    const { controle } = linhaDeControle(ctx, { id: 'x', rotulo: 'Modo Fácil' });
    expect(controle.getAttribute('aria-label')).toBe('Modo Fácil');
    expect(controle.getAttribute('aria-pressed'), 'nasce sem estado dito, e um estado por dizer é um estado errado')
      .toBe('false');
  });

  it('🔴 [Boundary] `rotularLinha` APAGA a dica que some — não a deixa no idioma anterior', () => {
    // ⚠️ Uma dica que existe num dicionário e não noutro tem de DESAPARECER na retradução. Deixar de a
    // escrever não chega: o texto antigo sobrevive e o rodapé descansa no idioma que a criança acabou de
    // deixar. É a mesma regra que o `aplicarRotulos` já segue para o `data-explain-idle` da moldura.
    const { linha, controle } = linhaDeControle(ctx, { id: 'x', rotulo: 'Antes', dica: 'Explicação antiga.' });
    hospedeiro.appendChild(linha);
    rotularLinha(linha, { id: 'x', rotulo: 'Depois' });
    expect(linha.querySelector('strong').textContent).toBe('Depois');
    expect(linha.querySelector('.opt-hint').textContent, 'a dica do idioma anterior sobreviveu').toBe('');
    expect(controle.getAttribute('aria-label'), 'o nome falado ficou no idioma anterior').toBe('Depois');
  });

  it('[Right] `rotuloAria` ganha ao rótulo, para quando o nome falado não é o escrito', () => {
    const { controle } = linhaDeControle(ctx, { id: 'x', rotulo: '↺', rotuloAria: 'Restaurar cores padrão' });
    expect(controle.getAttribute('aria-label')).toBe('Restaurar cores padrão');
  });
});

describe('montarInteriorDoMotor — o painel constrói o que ele próprio alcança', () => {
  function casca() {
    const c = montarCasca(ctx, {
      id: 'movement', titulo: 'Motora', rotuloDaLista: 'Escolhas', rotuloReset: 'Repor', rotuloFechar: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  it('🎯 [Right] cria os QUATRO ids que o painel alcança e nunca criava', () => {
    // 📏 `settings-motor` procura `#movement-players`, `#opt-facil`, `#opt-altmove` e `#opt-togglerun`. O
    // markup deles vivia no `app/index.html`, que saiu com o cartucho — desde então o painel abria com o
    // cartão, o título e o botão de repor, e NENHUMA das três escolhas.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.getElementById(id), `#${id} não foi criado`).not.toBeNull();
    }
  });

  it('⚠️ [Right] as três escolhas ficam DENTRO da lista, e as abas FORA dela', () => {
    // A lista é o `div[role=group]` que o leitor de tela anuncia como o conjunto das escolhas. As abas dizem
    // de QUEM são as escolhas: pô-las lá dentro faria o grupo anunciar o selector de assento como se fosse
    // mais um ajuste.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(c.lista.contains(document.getElementById(id)), `#${id} ficou fora da lista`).toBe(true);
    }
    const abas = document.getElementById('movement-players');
    expect(c.lista.contains(abas), 'as abas entraram no grupo das escolhas').toBe(false);
    expect(c.card.contains(abas), 'as abas ficaram fora do cartão').toBe(true);
    expect(abas.hidden, 'as abas nascem à vista e vazias — um selector que não seleciona nada').toBe(true);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UMA linha de cada', () => {
    // A raiz monta mais do que uma vez: a contagem de jogadores muda a grade de telas, e o ADR-0142 põe dois
    // cartuchos na mesma página.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['movement-players', 'opt-facil', 'opt-altmove', 'opt-togglerun']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

  it('🔴 [Right] a linha da ALTERNÂNCIA é sempre criada — quem a esconde é o painel, por `seguraTeclas`', () => {
    // ⚠️ A REGRA MORA NUM SÍTIO SÓ. `reflectAltMove` decide se ela se vê, pelo `seguraTeclas` do ADR-0115, e
    // a decisão dele é `hidden` — que a tira da tela E da árvore de acessibilidade. Criar só quando se aplica
    // poria a mesma regra em dois lugares, e o dia em que divergissem é o dia em que a linha aparece num jogo
    // onde não faz nada.
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    const alt = document.getElementById('opt-altmove');
    expect(alt, 'a linha da alternância não foi criada').not.toBeNull();
    expect(alt.closest('.ctrl-row').hidden, 'nasceu escondida: a construção assumiu uma decisão que não é dela')
      .toBe(false);
  });

  it('[Right] cada escolha tem a sua explicação, e ela vai para o rodapé pelo caminho da casca', () => {
    const c = casca();
    montarInteriorDoMotor(ctx, c.card, c.lista);
    for (const id of ['opt-facil', 'opt-altmove', 'opt-togglerun']) {
      const linha = document.getElementById(id).closest('.ctrl-row');
      expect(linha.querySelector('.opt-hint'), `#${id} ficou sem explicação`).not.toBeNull();
      expect(linha.querySelector('strong').textContent.length, `#${id} ficou sem rótulo`).toBeGreaterThan(0);
    }
  });
});

describe('montarInteriorDoAudio — o maior contrato invisível dos oito', () => {
  function casca() {
    const c = montarCasca(ctx, {
      id: 'audio', titulo: 'Auditiva', rotuloDaLista: 'Sons do jogo', rotuloReset: 'Repor', rotuloFechar: 'Fechar',
    });
    hospedeiro.appendChild(c.overlay);
    return c;
  }

  // 📏 Os quinze que `ui/settings-audio` alcança e nunca criou, medidos do próprio ficheiro. `#opt-sound` NÃO
  // entra: ele é o espelho deste ajuste na barra rápida, fora do painel, e é alcançado com guarda.
  const CONTROLES = {
    'audio-master': 'BUTTON',
    'audio-master-vol': 'INPUT',
    'navsound-master': 'INPUT',
    'opt-modocego': 'BUTTON',
    'cane-div': 'SELECT',
    'opt-menuindex': 'BUTTON',
    'opt-tts': 'BUTTON',
    'tts-vol': 'INPUT',
  };

  /** O que o ADR-0151 tirou do painel — afirmado AUSENTE, e não só deixado de fora da lista acima. */
  const SAIRAM = ['tts-engine', 'tts-voice', 'opt-tts-test', 'audio-sinks', 'audio-detect'];

  it('🎯 [Right] cria os controles, cada um com a TAG que o painel escreve', () => {
    // ⚠️ A TAG É O DEFEITO SILENCIOSO. `renderAudio` faz `ctx.$<HTMLSelectElement>('#cane-div').value = …`;
    // num `<button>` isso cria uma propriedade que ninguém lê, sem erro nenhum, e a escolha some.
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    for (const [id, tag] of Object.entries(CONTROLES)) {
      const el = document.getElementById(id);
      expect(el, `#${id} não foi criado`).not.toBeNull();
      expect(el.tagName, `#${id} nasceu com a tag errada`).toBe(tag);
    }
    // 🔴 O PAR (ADR-0151): motor, voz, testar voz e as saídas por jogador NÃO estão no painel. Sem isto, uma lista
    // de controles que voltasse a crescer passaria no caso de cima — ele só confere os que DEVEM existir.
    for (const id of SAIRAM) {
      expect(document.getElementById(id), `#${id} continua no painel — o Dev tirou-o`).toBeNull();
    }
    // e os três volumes são cursores de verdade, não caixas de texto
    for (const id of ['audio-master-vol', 'navsound-master', 'tts-vol']) {
      expect(document.getElementById(id).type, `#${id} não é um cursor`).toBe('range');
    }
  });

  it('🎯 [Right] cria o contentor que o painel preenche, e a lista da casca fica no cartão', () => {
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    for (const id of ['navsound-list']) {
      const el = document.getElementById(id);
      expect(el, `#${id} não foi criado`).not.toBeNull();
      expect(el.getAttribute('role'), `#${id} não é um grupo que o leitor de tela anuncie`).toBe('group');
      expect(el.getAttribute('aria-label'), `#${id} é um grupo sem nome`).toBeTruthy();
    }
    expect(c.card.contains(c.lista), 'a lista da casca saiu do cartão').toBe(true);
  });

  it('⚠️ [Right] a ORDEM é a decisão: o volume da navegação vem ANTES da lista que ele governa', () => {
    // ADR-0044 §2. Um cursor que governa um grupo e aparece depois dele obriga a criança a descobrir o que
    // ele faz descendo primeiro — e quem navega por teclado passa o grupo inteiro antes de chegar ao mestre.
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    const ordem = [...c.card.children];
    const posicao = (sel) => ordem.findIndex((n) => n.matches(sel) || n.querySelector(sel));
    expect(posicao('#navsound-master')).toBeLessThan(posicao('#navsound-list'));
    expect(posicao('#audio-master')).toBeLessThan(posicao('#navsound-master'));
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM de cada — a raiz monta mais do que uma vez', () => {
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    montarInteriorDoAudio(ctx, c.card, c.lista);
    for (const id of [...Object.keys(CONTROLES), 'navsound-list', 'audio-list']) {
      expect(document.querySelectorAll('#' + id), `#${id} ficou duplicado`).toHaveLength(1);
    }
  });

  it('🔴 [Right] o IDIOMA QUE CHEGA DEPOIS DO ARRANQUE alcança as LINHAS, e não só a moldura', async () => {
    // 🔴 ESTE CASO NASCEU DE UM DEFEITO MEDIDO NUM NAVEGADOR, e nenhum teste unitário o apanhava: eles correm
    // todos num idioma só. 📏 No `quiz.html` com `lang="en"`, em 2026-09-12: o título dizia «Hearing
    // accessibility» e a primeira linha dizia «Som», na mesma tela. A moldura já se retraduzia desde que
    // `MountPanelSpec.rotulos` passou a resolver-se a cada abertura; o INTERIOR ficou para trás.
    //
    // 📌 O que o conserta é montar o interior outra vez a cada abertura — e por isso `montarInteriorDoAudio`
    // reetiqueta o que já existe em vez de o refazer: refazer deixaria treze controles sem escuta.
    const { setLocale } = await import('../app/js/core/i18n.js');
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    const antes = document.querySelector('#audio-master').closest('.ctrl-row').querySelector('strong').textContent;

    await setLocale('en');
    montarInteriorDoAudio(ctx, c.card, c.lista);
    const linha = document.querySelector('#audio-master').closest('.ctrl-row');
    expect(linha.querySelector('strong').textContent, 'a linha ficou no idioma de recuo').not.toBe(antes);
    expect(linha.querySelector('strong').textContent).toBe('Sound');
    // e o grupo também: um `aria-label` velho faz o leitor de tela anunciar o idioma anterior
    expect(document.getElementById('navsound-list').getAttribute('aria-label')).toBe('Navigation sounds');
    await setLocale('pt');
  });

  it('🔴 [Zero] `#opt-sound` NÃO é criado — ele mora na barra rápida, fora do painel', () => {
    // Criá-lo aqui poria DOIS espelhos do mesmo ajuste no documento, e o `reflectMaster` acenderia o de
    // dentro do painel enquanto a barra continuava a dizer o contrário.
    const c = casca();
    montarInteriorDoAudio(ctx, c.card, c.lista);
    expect(document.getElementById('opt-sound')).toBeNull();
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Dez, cada uma aplicada por script a ficheiro e com contagem de ocorrencias antes de aplicar.
//
//   1. a dica a sair do `<span>` -> o `fillExplain` nunca a acha, e o menu volta a ser um manual.
//   2. a FORMA ignorada (tudo botao) -> um `<select>` pedido nasce `<button>`; escrever `.value` nele nao da
//      erro nenhum, e a escolha da crianca some em silencio.
//   3. o cursor sem `min`/`max` -> assume 0..100 onde o volume e 0..1, e o primeiro passo salta o intervalo.
//   4. o controle sem `aria-label` -> reprovam DOIS: quem navega controlo a controlo ouve so «Desligado».
//   5. `rotuloAria` a deixar de ganhar -> um botao cujo rotulo e um glifo passa a anunciar o glifo.
//   6. o interruptor sem `aria-pressed` -> nasce com o estado por dizer, que e um estado errado.
//   7. o interior do motor sem guarda -> montar duas vezes deixa duas linhas de cada, e a raiz monta mais do
//      que uma vez (a contagem de jogadores muda a grade; o ADR-0142 poe dois cartuchos na mesma pagina).
//   8. as abas DENTRO da lista -> o grupo anuncia o selector de assento como se fosse mais um ajuste.
//   9. a linha da alternancia criada so quando se aplica -> reprovam CINCO. A regra do `seguraTeclas` mora no
//      `reflectAltMove`; em dois sitios, elas divergem, e a linha aparece num jogo onde nao faz nada.
//  10. as escolhas no cartao em vez da lista -> saem do `div[role=group]` que o leitor de tela anuncia.
