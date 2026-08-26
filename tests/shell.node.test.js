// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/shell — a DECISÃO de fase, sem DOM (project node). É aqui que se prova a razão de a extração
// ter separado projeção de efeito: `phaseView` e `touchControlsPlan` respondem "o que esta fase manda fazer"
// sem overlay, sem áudio e sem PIXI, e um `!==` trocado vira asserção em vez de sintoma silencioso.
//
// A casca (foco de verdade, innerHTML da legenda, os ouvintes do modo Print) está em shell.browser.test.js.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // a legenda vem do dicionário desde o item 14
import {
  phaseView, touchControlsPlan, chip, legendRow1, legendRow2, legendHtml,
  padActionGlyphs, touchActionGlyphs, pickLegendPad,
} from '../app/js/ui/shell.js';

// A CASCA DEIXOU DE CONHECER AS FASES em 2026-08-26 (ADR-0030 C3). `phaseView`/`touchControlsPlan` recebem
// três BOOLEANOS — `FatosDaCena` —, e os três nomes moram na raiz de composição, que é este jogo. Este
// arquivo continua escrito em `'title'`/`'playing'`/`'paused'` porque é como os casos se leem melhor; a
// tradução acontece aqui, num lugar só, e é justamente o que a raiz faz de verdade.
const fase = (p) => ({ telaDeTitulo: p === 'title', mundoRodando: p === 'playing', menuDePausa: p === 'paused' });
/** As três cenas que ESTE jogo vive. Era `PHASES`, exportado pela casca; a casca não sabe mais quantas são. */
const PHASES = ['title', 'playing', 'paused'];

describe('phaseView — a fase projetada em ordens para o documento', () => {
  it('as três fases, e só elas', () => {
    expect([...PHASES]).toEqual(['title', 'playing', 'paused']);
  });

  it('o splash aparece SÓ no título', () => {
    expect(phaseView(fase('title')).titleOverlayHidden).toBe(false);
    expect(phaseView(fase('playing')).titleOverlayHidden).toBe(true);
    expect(phaseView(fase('paused')).titleOverlayHidden).toBe(true);
  });

  it('os menus de pausa por tela aparecem SÓ na pausa', () => {
    expect(phaseView(fase('paused')).screenPauseHidden).toBe(false);
    expect(phaseView(fase('title')).screenPauseHidden).toBe(true);
    expect(phaseView(fase('playing')).screenPauseHidden).toBe(true);
  });

  // GAG (pilar de a11y): som de jogo com o jogo parado é ruído para quem depende do áudio para se orientar.
  it('fora de "playing" TODO o som cala, e o controle virtual some', () => {
    for (const p of PHASES) {
      expect(phaseView(fase(p)).masterMuted, p).toBe(p !== 'playing');
      expect(phaseView(fase(p)).hideTouchControls, p).toBe(p !== 'playing');
    }
  });

  it('a pausa GLOBAL está aposentada: #pause-overlay fica escondido em TODA fase', () => {
    for (const p of PHASES) expect(phaseView(fase(p)).pauseOverlayHidden, p).toBe(true);
  });

  it('o botão de pausa diz ao leitor de tela se está pausado', () => {
    expect(phaseView(fase('paused')).pausePressed).toBe(true);
    expect(phaseView(fase('playing')).pausePressed).toBe(false);
    expect(phaseView(fase('title')).pausePressed).toBe(false);
  });

  // Requisito de a11y: entrar numa tela sem levar o foco junto deixa quem usa teclado/leitor sem âncora.
  it('cada fase leva o foco para um lugar, e nunca deixa ninguém sem destino', () => {
    expect(phaseView(fase('playing')).focus).toBe('game-region');
    expect(phaseView(fase('paused')).focus).toBe('pause-menu');
    expect(phaseView(fase('title')).focus).toBe('title-button');
    for (const p of PHASES) expect(phaseView(fase(p)).focus, p).toBeTruthy();
  });
});

describe('touchControlsPlan — o único pedaço da troca de fase com memória', () => {
  const st = (hidden, wasOn) => ({ hidden, wasOn });

  it('pausar com o controle virtual LIGADO guarda que estava ligado e o esconde', () => {
    expect(touchControlsPlan(fase('paused'), st(false, false), 1)).toEqual({ hidden: true, wasOn: true });
  });

  it('retomar com a marca guardada e UMA tela devolve o controle virtual', () => {
    expect(touchControlsPlan(fase('playing'), st(true, true), 1)).toEqual({ hidden: false, wasOn: false });
  });

  it('retomar em MULTITELA não devolve o controle (o virtual é só de tela única)', () => {
    expect(touchControlsPlan(fase('playing'), st(true, true), 2)).toEqual({ hidden: true, wasOn: false });
  });

  it('o título sempre esconde e esquece', () => {
    expect(touchControlsPlan(fase('title'), st(false, true), 1)).toEqual({ hidden: true, wasOn: false });
  });

  // ⚠️ DEFEITO CONHECIDO, PINADO — não conserte. No setPhase real, `hideTouchControls()` roda ANTES deste
  // plano sempre que a fase não é 'playing', e já deixa `hidden: true`. Portanto a entrada REAL do ramo
  // 'paused' é sempre `hidden: true`, e a marca `wasOn` nunca chega a ser gravada: o ramo de restauração é
  // inalcançável por esse caminho. Sintoma no celular: pausar esconde o direcional e retomar não o traz de
  // volta. Este caso pina a SEQUÊNCIA como ela é hoje; quando o conserto vier, ele falha — é a rede.
  it('DEFEITO (pinado): com hideTouchControls rodando antes, a marca NUNCA é gravada ao pausar', () => {
    // 1) jogando, controle virtual visível
    let s = st(false, false);
    // 2) setPhase('paused') → hideTouchControls() esconde ANTES do plano
    s = { ...s, hidden: true };
    // 3) só então o plano roda
    s = touchControlsPlan(fase('paused'), s, 1);
    expect(s).toEqual({ hidden: true, wasOn: false }); // a marca se perdeu aqui
    // 4) setPhase('playing') → sem marca, não há o que restaurar
    s = touchControlsPlan(fase('playing'), s, 1);
    expect(s.hidden).toBe(true); // o direcional NÃO volta sozinho — é o defeito
  });
});

describe('legenda do título — os chips de dispositivo', () => {
  it('chip sem cor não emite style; com cor, emite', () => {
    expect(chip('A', null, 'pular')).toBe('<span class="lg"><span class="lg-ico">A</span> pular</span>'); // `chip` recebe a palavra PRONTA: quem traduz é quem chama
    expect(chip('A', '#2fae4e')).toBe('<span class="lg"><span class="lg-ico" style="background:#2fae4e">A</span></span>');
  });

  it('as duas linhas saem na ordem fixa: direcional+pausa, depois pular/especial/correr/trocar', () => {
    const l1 = legendRow1('✜', 'START');
    const l2 = legendRow2({ jump: ['A', null], especial: ['B', null], run: ['C', null], swap: ['D', null] });
    // Contra `t()` e não contra o português: fixar as palavras aqui devolveria ao teste o texto que saiu do
    // código. A ORDEM é o que este caso guarda, e ela não depende de idioma nenhum.
    expect(l1.indexOf(t('legend.move'))).toBeLessThan(l1.indexOf(t('legend.pause')));
    const pos = ['legend.jump', 'legend.especial', 'legend.run', 'legend.swap'].map((k) => l2.indexOf(t(k)));
    expect(pos.every((n) => n >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b)); // estritamente na ordem declarada
    expect(new Set(pos).size).toBe(4);
    expect(legendHtml(l1, l2)).toBe(`<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`);
  });

  it('gamepad no padrão: rótulos e cores do MODELO detectado', () => {
    const g = padActionGlyphs('microsoft', null);
    expect(g.jump).toEqual(['A', '#2fae4e']);
    expect(g.especial).toEqual(['B', '#d23b3b']);
    expect(g.run).toEqual(['X', '#2f6fd2']);
    expect(g.swap).toEqual(['Y', '#d9a400']);
  });

  it('gamepad FORA do padrão: o mapa do assistente redireciona cada ação para o botão que a pessoa apertou', () => {
    const g = padActionGlyphs('generic', { jump: { b: 2 }, especial: { b: 3 } });
    expect(g.jump[0]).toBe('2');     // "pular" agora mostra o botão 2
    expect(g.especial[0]).toBe('3');
    expect(g.run[0]).toBe('2');      // sem entrada custom: cai no índice default
    expect(g.swap[0]).toBe('3');
  });

  it('mapa custom com índice fora do design cai no cinza de fallback, sem quebrar a legenda', () => {
    const g = padActionGlyphs('microsoft', { jump: { b: 9 } });
    expect(g.jump).toEqual(['9', '#3a4a6a']);
  });

  it('design desconhecido cai em "generic"; o toque usa sempre o generic', () => {
    expect(padActionGlyphs('inventado', null)).toEqual(padActionGlyphs('generic', null));
    expect(touchActionGlyphs().jump).toEqual(['0', '#3a4a6a']);
  });

  it('a legenda descreve o pad do JOGADOR 1 quando ele tem um; senão, o primeiro conectado', () => {
    const pads = [null, { index: 1, id: 'x', mapping: 'standard' }, { index: 2, id: 'y', mapping: '' }];
    expect(pickLegendPad(pads, 2).index).toBe(2);   // P1 associado ao pad 2 → é esse
    expect(pickLegendPad(pads, -1).index).toBe(1);  // sem associação → o primeiro conectado
    expect(pickLegendPad([null, null], -1)).toBe(null);
  });

  it('P1 associado a um pad DESCONECTADO não pega o pad de outro jogador (cai no teclado)', () => {
    const pads = [{ index: 0, id: 'a', mapping: 'standard' }];
    expect(pickLegendPad(pads, 3)).toBe(null);
  });
});
