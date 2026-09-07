// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/layout — escala do #game-region (project BROWSER: usa #stage-wrap/#game-region + devicePixelRatio).
// Padrões: ZOMBIES + Right-BICEP. VLibras fechado por padrão (librasOpen=false). Ver docs/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { layout } from '../app/js/ui/layout.js';

const setup = (w = 1280, h = 720) => { document.body.innerHTML = `<div id="stage-wrap" style="width:${w}px;height:${h}px"><div id="game-region"></div></div>`; };

describe('ui/layout — escala do #game-region', () => {
  it('[Right] escala o canvas e seta as vars de UI (--ui-fs/--tap/--hud-fs) em px', () => {
    setup();
    layout();
    const gr = document.querySelector('#game-region');
    expect(parseFloat(gr.style.width)).toBeGreaterThan(0);
    expect(gr.style.height).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--ui-fs')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--tap')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--hud-fs')).toMatch(/px$/);
  });
  it('[Cross-check] 1 jogador (base 320) com piso k≥2 → largura ≥ 640 (viewport mín. do Chromebook)', () => {
    setup(1280, 720);
    layout();
    expect(parseFloat(document.querySelector('#game-region').style.width)).toBeGreaterThanOrEqual(640);
  });
  it('[Zero/Robustez] sem #stage-wrap → early return, não quebra', () => {
    document.body.innerHTML = '';
    expect(() => layout()).not.toThrow();
  });
  it('[Interface] VLibras fechado (padrão) → sem reserva à direita (paddingRight 0)', () => {
    setup();
    layout();
    expect(document.querySelector('#stage-wrap').style.paddingRight).toBe('0px');
  });
});

// ===================================================================================================
// O HOST COMO ELE EXISTE DE VERDADE — e não como este ficheiro preferia que fosse
// ===================================================================================================
// ⚠️ O ACHADO QUE ESTE BLOCO EXISTE PARA IMPEDIR, e ele estava vivo enquanto tudo aqui em cima ficava verde:
// `ui/layout.ts` procura `$('#stage-wrap')` — por ID — e faz early-return silencioso se não achar. O único
// documento que resta neste repositório, `app/quiz.html:31`, tem `<div class="stage-wrap">` — por CLASSE.
//
// Ou seja: `layout()` NÃO CORRIA no único host da engine. O canvas não escalava, `--tap`/`--ui-fs`/`--hud-fs`
// não eram escritas, e nada reportava erro nenhum — o early-return é indistinguível de «não havia o que
// fazer». O `quiz.html:33` até diz, num comentário, «mesmo id que ui/layout escala»: quem o escreveu
// acreditava que corria.
//
// ⚠️ E O `setup()` LÁ DE CIMA É O MOTIVO DE NINGUÉM TER VISTO. Ele FABRICA `<div id="stage-wrap">` com altura
// cravada, ou seja injeta exatamente a variável que devia estar a medir. Um teste que constrói o host do
// jeito que o código quer não afere que o host real é assim — afere que a função funciona quando funciona.
//
// Este bloco monta o host COMO O `quiz.html` O MONTA. Ele nasceu vermelho.
describe('ui/layout — o host real do consumidor de prova (achado de 07/09)', () => {
  /** Exatamente a forma de `app/quiz.html`: a casca por CLASSE, o `#game-region` lá dentro. */
  const setupComoOQuiz = (w = 1280, h = 720) => {
    document.body.innerHTML =
      `<main><div class="stage-wrap" style="width:${w}px;height:${h}px">`
      + '<div id="stage" class="stage"><section id="game-region" class="game-region"></section></div>'
      + '</div></main>';
  };

  it('⚠️ [Right] com a casca por CLASSE, o `#game-region` é escalado na mesma', () => {
    setupComoOQuiz();
    layout();
    const gr = document.querySelector('#game-region');
    expect(parseFloat(gr.style.width), 'layout() não correu: o host da engine não escala').toBeGreaterThan(0);
    expect(gr.style.height).toMatch(/px$/);
  });

  it('⚠️ [Right] e as vars de UI chegam — sem elas o alvo de toque não tem tamanho', () => {
    // `--tap` é o que o ADR-0095 usa como chão do alvo. Sem `layout()`, ela nunca é escrita e todo
    // `min-height: var(--tap)` do `style.css` cai no valor de origem.
    setupComoOQuiz();
    layout();
    const gr = document.querySelector('#game-region');
    for (const v of ['--ui-fs', '--tap', '--hud-fs']) {
      expect(gr.style.getPropertyValue(v), `${v} não foi escrita`).toMatch(/px$/);
    }
  });

  it('[Interface] as duas formas do host produzem a MESMA escala', () => {
    // Aceitar a classe não pode ser um caminho de segunda: o mesmo espaço tem de dar o mesmo canvas.
    setupComoOQuiz(1280, 720);
    layout();
    const porClasse = document.querySelector('#game-region').style.width;
    document.body.innerHTML = '<div id="stage-wrap" style="width:1280px;height:720px"><div id="game-region"></div></div>';
    layout();
    expect(document.querySelector('#game-region').style.width).toBe(porClasse);
  });

  it('[Zero] e sem host nenhum continua a não quebrar', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => layout()).not.toThrow();
  });
});
