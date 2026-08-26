// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/menu-nav — a DECISÃO de navegação, sem DOM (project node): traduzir tecla em intenção, andar
// numa lista, ajustar select/slider e atravessar a fronteira entre a barra de ícones e a grade de itens.
//
// Por que isto é teste de ACESSIBILIDADE e não de aritmética: cada função aqui é um gesto que alguém faz sem
// ver a tela. Um sinal trocado em `pauseGridMove` não quebra nada visível — o menu continua desenhado, os
// botões continuam clicáveis com o mouse — e simplesmente torna um item inalcançável para quem só tem teclado.
// É o tipo de regressão que passa por build, por olho e por screenshot.
//
// A casca de DOM (foco de verdade, `offsetParent`, z-index, Escape) está em menu-nav.browser.test.js e NÃO é
// repetida aqui.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, PAUSE_COLS,
  menuKeyIntent, hasIntent, passoNoAnel, selectStep, selectWrap, rangeStep, passoNaPausa,
} from '../app/js/ui/menu-nav.js';

const NONE = { yes: false, no: false, up: false, down: false, left: false, right: false };
const only = (...ks) => ({ ...NONE, ...Object.fromEntries(ks.map((k) => [k, true])) });

describe('menuKeyIntent — tecla física → intenção', () => {
  it('as quatro teclas de "sim" genéricas confirmam', () => {
    for (const c of ['Space', 'KeyJ', 'Enter', 'NumpadEnter']) {
      expect(menuKeyIntent(c, null).yes, c).toBe(true);
    }
  });

  // Este caso PINA o DEFEITO 2 (conhecido, não consertado): Escape é a intenção "voltar", a MESMA que a ação
  // "especial" do gamepad. Não existe, hoje, uma intenção "fechar diálogo" separada de "voltar ao jogo".
  it('Escape é "não" — e é a MESMA intenção que a ação "especial" (defeito 2, pinado)', () => {
    expect(menuKeyIntent('Escape', null).no).toBe(true);
    expect(menuKeyIntent('KeyL', 'especial').no).toBe(true);
    // e Escape NÃO é nenhuma outra intenção — se virasse, o menu andaria ao tentar voltar
    const k = menuKeyIntent('Escape', null);
    expect([k.yes, k.up, k.down, k.left, k.right]).toEqual([false, false, false, false, false]);
  });

  it('WASD e as setas andam; a ação remapeada do dono da tecla vale igual', () => {
    expect(menuKeyIntent('KeyW', null).up).toBe(true);
    expect(menuKeyIntent('ArrowDown', null).down).toBe(true);
    expect(menuKeyIntent('KeyA', null).left).toBe(true);
    expect(menuKeyIntent('ArrowRight', null).right).toBe(true);
    // tecla exótica, mas remapeada para "up" pelo jogador: navega igual (é o pilar — o remap vale nos menus)
    expect(menuKeyIntent('Numpad8', 'up').up).toBe(true);
  });

  it('tecla sem função nenhuma não expressa intenção (e por isso NÃO é consumida)', () => {
    expect(hasIntent(menuKeyIntent('KeyQ', null))).toBe(false);
    expect(hasIntent(menuKeyIntent('Escape', null))).toBe(true);
  });

  it('as tabelas genéricas não se sobrepõem entre si', () => {
    const sets = [KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT];
    const all = sets.flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('passos de lista e de controle', () => {
  // ANEL, e não mais limite (ADR-0044). O caso antigo afirmava "não dá a volta em nenhuma das pontas", e o
  // ADR derrubou a regra: com um menu por tela, toda lista é anel, e é isso que põe `quit` a UMA tecla de
  // `resume` sem os dois estarem perto um do outro.
  //
  // MUTAÇÃO CONFERIDA: voltando `passoNoAnel` ao antigo `Math.max(0, Math.min(len-1, idx+delta))`, o caso
  // falha em "expected 0 to be 4" — antes do primeiro deixa de haver último.
  it('passoNoAnel dá a volta nas DUAS pontas — e o `%` de negativo não escapa', () => {
    expect(passoNoAnel(5, 4, +1), 'depois do último vem o primeiro').toBe(0);
    expect(passoNoAnel(5, 0, -1), 'antes do primeiro vem o último').toBe(4);
    expect(passoNoAnel(5, 2, +1)).toBe(3);
    expect(passoNoAnel(5, 2, -1)).toBe(1);
    // O `%` de JavaScript devolve NEGATIVO para operando negativo (`-1 % 5 === -1`), e um índice negativo
    // num array devolve `undefined` — que aqui viraria `undefined.focus()`. O `+ len` extra existe por isso.
    expect(passoNoAnel(5, 0, -3), 'salto negativo maior que um passo').toBe(2);
  });

  it('[Zero] lista vazia não estoura — anel de tamanho zero devolve 0, não NaN', () => {
    // `% 0` é NaN, e `items[NaN]` é `undefined`. Um menu sem itens acontece de verdade: um painel que
    // renderiza antes de o conteúdo chegar.
    expect(passoNoAnel(0, 0, +1)).toBe(0);
    expect(passoNoAnel(0, 3, -1)).toBe(0);
  });

  it('AJUSTAR VALOR continua preso nas pontas — a diferença é deliberada', () => {
    // Passar do volume máximo para o mínimo com uma tecla é um susto, não uma conveniência. Num jogo com
    // pistas de áudio para cegueira, um susto de volume é dano.
    expect(selectStep(0, 5, -1)).toBe(0);
    expect(selectStep(4, 5, +1)).toBe(4);
  });

  it('select: esquerda/direita são passo PRESO; "sim" dá a volta (diferença deliberada)', () => {
    expect(selectStep(0, 3, -1)).toBe(0);
    expect(selectStep(2, 3, +1)).toBe(2);
    expect(selectWrap(2, 3)).toBe(0);
    expect(selectWrap(0, 3)).toBe(1);
  });

  it('slider anda um STEP e respeita min/max; step ausente ou zero vale 1', () => {
    expect(rangeStep(4, 0, 10, 2, +1)).toBe(6);
    expect(rangeStep(0, 0, 10, 2, -1)).toBe(0);
    expect(rangeStep(10, 0, 10, 2, +1)).toBe(10);
    expect(rangeStep(4, 0, 10, 0, +1)).toBe(5);   // `+cur.step||1`
    expect(rangeStep(4, 0, 10, NaN, -1)).toBe(3); // idem
  });
});

describe('passoNaPausa — a pausa virou LISTA, e a lista virou anel', () => {
  // ESTE BLOCO SUBSTITUI o de `pauseGridMove`, e a substituição é o desfecho do ADR-0044.
  //
  // O que havia era uma GRADE de duas zonas — dez ícones de a11y em cima, oito itens em duas colunas embaixo —
  // com quatro regras de fronteira próprias: "de cima, 'baixo' cai sempre no primeiro item"; "da primeira
  // linha, 'cima' sobe para o ícone de MESMO índice"; "preso ao último ícone se a barra for mais curta"; "sem
  // ícone nenhum, 'cima' vira passo de linha". Onze casos existiam para pinar isso, e cada regra era uma coisa
  // a mais para a criança descobrir sem ver — e nenhuma delas era descobrível: só se aprendia esbarrando.
  //
  // A barra saiu para o HUD (item 7) e o cartão virou uma lista. A XAG 106 permite laço para menu LINEAR e o
  // proíbe para grade 2-D; com uma lista só, o que era proibido virou o recomendado. As quatro regras somem e
  // sobra UMA, que se enuncia numa frase: depois do último vem o primeiro, e antes do primeiro vem o último.
  const N = 7; // os sete itens da pausa (ADR-0044 §2)

  it('[Right] baixo e direita andam para a frente; cima e esquerda, para trás', () => {
    expect(passoNaPausa(N, 0, only('down'))).toBe(1);
    expect(passoNaPausa(N, 0, only('right'))).toBe(1);
    expect(passoNaPausa(N, 3, only('up'))).toBe(2);
    expect(passoNaPausa(N, 3, only('left'))).toBe(2);
  });

  it('[Right] a PROMESSA do ADR-0044: `quit` a uma tecla de `resume`', () => {
    // `resume` é o item 0 e `quit` é o 6. Uma tecla para CIMA no primeiro chega no último — longe na leitura,
    // vizinho no dedo. É a frase que abriu o registro, e é este caso que a torna verdadeira ou falsa.
    expect(passoNaPausa(N, 0, only('up')), 'para cima em `resume` tem de cair em `quit`').toBe(N - 1);
    expect(passoNaPausa(N, N - 1, only('down')), 'para baixo em `quit` tem de voltar a `resume`').toBe(0);
  });

  it('[Boundary] cursor perdido (índice negativo) entra como 0 — verbatim do `if(idx<0)idx=0`', () => {
    // Preservado do comportamento antigo: um menu que acabou de abrir sem seleção não pode fazer o cursor
    // aparecer no meio da lista. Ele entra pelo começo, ande-se para onde se andar.
    expect(passoNaPausa(N, -1, only('down'))).toBe(1);
    expect(passoNaPausa(N, -1, only('up'))).toBe(N - 1);
  });

  it('[Zero] lista vazia não estoura e não inventa índice', () => {
    expect(passoNaPausa(0, 0, only('down'))).toBe(0);
  });

  it('[Many] TODO item é alcançável a partir de `resume` só com baixo — e a volta fecha', () => {
    // O caso que o bloco antigo tinha em forma de busca em largura sobre uma grade. Numa lista ele cabe numa
    // linha, e é essa a economia: a estrutura que precisa de busca em largura para se provar navegável é a
    // estrutura que a criança precisa explorar às cegas para aprender.
    const vistos = new Set();
    let i = 0;
    for (let passo = 0; passo < N; passo++) { vistos.add(i); i = passoNaPausa(N, i, only('down')); }
    expect(vistos.size).toBe(N);
    expect(i, 'depois de N passos o cursor tem de estar de volta no começo').toBe(0);
  });
});

describe('a independência do módulo — o que ele NÃO conhece', () => {
  const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'ui', 'menu-nav.ts'), 'utf8');

  it('[Right] NÃO importa `core/state` — o modelo de fases é de quem consome, não deste módulo', () => {
    // Enquanto ele importava `phase`, um segundo jogo não tinha como trazer o próprio modelo de fases: o quiz
    // do `consumer-quiz` teve de se declarar "pausado" para navegar os próprios menus (achado 10). A aresta
    // morreu quando a pergunta virou `isNavigable()` no ctx. Se voltar, este caso reprova — e o custo de ela
    // voltar é invisível de dentro da plataforma, onde menu SEMPRE é coisa de pausa.
    expect(fonte).not.toMatch(/from '\.\.\/core\/state\.js'/);
  });

  it('[Interface] o ctx pergunta um BOOLEANO, e não a fase — é o que evita a mentira', () => {
    // Injetar `getPhase()` teria matado a importação e mantido o problema: o consumidor continuaria obrigado
    // a devolver a string `'paused'`, que é vocabulário do jogo de plataforma. Perguntar "dá para navegar
    // agora?" deixa cada jogo responder na própria língua. A diferença é pequena no diff e é o ponto inteiro.
    // A 2a asserção era `not.toMatch(/getPhase/)` e reprovou na MINHA PRÓPRIA PROSA: o módulo explica, em
    // comentário, por que `getPhase` foi recusado. Proibir a palavra proibia a explicação junto. O que importa
    // é que não exista o CAMPO — daí o dois-pontos, que a prosa (`getPhase()`, com parênteses) não tem.
    expect(fonte).toMatch(/isNavigable: \(\) => boolean/);
    expect(fonte).not.toMatch(/getPhase\s*:/);
  });
});
