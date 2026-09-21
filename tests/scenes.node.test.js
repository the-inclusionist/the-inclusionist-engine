// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/scenes — a pilha de cenas (item 22, C3). Project node: nada de DOM, nada de PIXI.
//
// As três regras da pilha não são convenção de biblioteca: cada uma reproduz um comportamento que o jogo já
// tem, e é por isso que valem teste. `update` só no topo É o congelamento da pausa; `draw` de baixo para cima
// É o menu desenhado sobre o mundo com o mundo visível; `input` só no topo É a entrada modal do ADR-0033.
//
// O caso que fecha o arquivo é o que mais importa: as três fases de HOJE (`title`/`playing`/`paused`), ditas
// como pilha, produzem exatamente o que o enum produz. Se isso não fosse verdade, a pilha não substituiria
// nada — seria uma segunda forma de dizer a mesma coisa, com o dobro do custo.
import { describe, it, expect } from 'vitest';
import { createSceneStack } from '../app/js/core/scenes.js';

/** Uma cena que ANOTA tudo o que recebe — é assim que se afirma "quem foi chamado, e em que ordem". */
function cena(nome, log, over = {}) {
  return {
    nome,
    enter: () => log.push(`${nome}:enter`),
    exit: () => log.push(`${nome}:exit`),
    update: (dt) => log.push(`${nome}:update:${dt}`),
    draw: () => log.push(`${nome}:draw`),
    input: (i) => { log.push(`${nome}:input:${i}`); return false; },
    ...over,
  };
}

describe('empilhar e desempilhar', () => {
  it('[Zero] pilha vazia não quebra em nada', () => {
    const p = createSceneStack();
    expect(p.top()).toBeNull();
    expect(p.nomes()).toEqual([]);
    expect(p.pop()).toBeNull();
    expect(() => { p.update(1); p.draw(); }).not.toThrow();
    expect(p.input('confirm')).toBe(false);
  });

  it('[Right] push avisa quem sai e quem entra, nessa ordem', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    expect(log).toEqual(['jogo:enter', 'jogo:exit', 'pausa:enter']);
    expect(p.nomes()).toEqual(['jogo', 'pausa']);
  });

  it('[Inverse] pop devolve o topo e RESSUSCITA quem estava embaixo', () => {
    // O `enter()` de quem reaparece é o que faz "voltar da pausa" ser um evento, e não um silêncio. Sem ele,
    // a cena de baixo volta ao topo sem saber — e é ali que se re-apanha o foco do teclado, por exemplo.
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    const fora = p.pop();
    expect(fora.nome).toBe('pausa');
    expect(log).toEqual(['pausa:exit', 'jogo:enter']);
    expect(p.nomes()).toEqual(['jogo']);
  });

  it('[Right] replace é UMA transição, e não um pop seguido de push', () => {
    // Se fosse pop+push, a cena de baixo receberia `enter()` por um instante e reapareceria no topo entre as
    // duas chamadas. Numa transição de tela isso é um quadro com a cena errada — visível, e intermitente.
    const log = [];
    const p = createSceneStack();
    p.push(cena('menu', log));
    p.push(cena('mapa', log));
    log.length = 0;
    p.replace(cena('nivel', log));
    expect(log).toEqual(['mapa:exit', 'nivel:enter']);
    expect(log).not.toContain('menu:enter'); // a de baixo NÃO reapareceu no meio do caminho
    expect(p.nomes()).toEqual(['menu', 'nivel']);
  });

  it('[Interface] `nomes()` é CÓPIA — quem lê não muta a pilha por acidente', () => {
    const p = createSceneStack();
    p.push(cena('a', []));
    p.nomes().push('intruso');
    expect(p.nomes()).toEqual(['a']);
  });
});

describe('as três regras', () => {
  it('[Right] update só no TOPO — é o congelamento da pausa, virado estrutura', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    p.update(2);
    expect(log).toEqual(['pausa:update:2']); // o jogo NÃO simula por baixo do menu
  });

  it('[Right] draw de BAIXO para cima — o menu por cima, o mundo ainda visível', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    p.draw();
    expect(log).toEqual(['jogo:draw', 'pausa:draw']);
  });

  it('[Right] input só no topo, e o RETORNO diz se consumiu', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log, { input: (i) => { log.push('pausa:input:' + i); return true; } }));
    log.length = 0;
    expect(p.input('up')).toBe(true);
    expect(log).toEqual(['pausa:input:up']); // o jogo não vê a tecla
  });

  it('[Boundary] topo que NÃO consome devolve false — a tecla é de outro dono', () => {
    // A distinção que o ADR-0033 deu à entrada modal: "é do modal" e "significa algo no modal" são perguntas
    // diferentes. Sem o retorno, a pilha teria de adivinhar, e adivinhar aqui é engolir tecla em silêncio.
    const p = createSceneStack();
    p.push({ nome: 'x', input: () => false });
    expect(p.input('qualquer')).toBe(false);
  });

  it('[Zero] cena SEM ganchos é legítima — nada de `update` vazio por obrigação', () => {
    const p = createSceneStack();
    p.push({ nome: 'so-nome' });
    expect(() => { p.update(1); p.draw(); }).not.toThrow();
    expect(p.input('a')).toBe(false);
  });
});

describe('as fases de HOJE, ditas como pilha', () => {
  // O caso que decide se isto substitui alguma coisa. `title`/`playing`/`paused` viram `[titulo]`, `[jogo]` e
  // `[jogo, pausa]` — e as respostas que `ui/shell.phaseView` dá a partir do enum saem da pilha sem que ela
  // conheça nenhum dos três nomes.
  const montar = (fases) => {
    const p = createSceneStack();
    for (const f of fases) p.push({ nome: f });
    return p;
  };
  /** As três perguntas de que as sete respostas de `phaseView` derivam — feitas à PILHA, não ao enum. */
  const fatos = (p) => ({
    telaDeTitulo: p.top()?.nome === 'titulo',
    mundoRodando: p.top()?.nome === 'jogo',
    menuDePausa: p.top()?.nome === 'pausa',
  });

  it('[Right] title → [titulo]', () => {
    expect(fatos(montar(['titulo']))).toEqual({ telaDeTitulo: true, mundoRodando: false, menuDePausa: false });
  });

  it('[Right] playing → [jogo]', () => {
    expect(fatos(montar(['jogo']))).toEqual({ telaDeTitulo: false, mundoRodando: true, menuDePausa: false });
  });

  it('[Right] paused → [jogo, pausa] — e o JOGO continua na pilha, que é o que o enum não dizia', () => {
    // É a diferença que motiva a troca. `phase === 'paused'` apaga a informação de que há um jogo por baixo;
    // a pilha a mantém, e é dela que sai "o mundo continua desenhado, mas não recebe tempo".
    const p = montar(['jogo', 'pausa']);
    expect(fatos(p)).toEqual({ telaDeTitulo: false, mundoRodando: false, menuDePausa: true });
    expect(p.nomes()).toEqual(['jogo', 'pausa']);
  });

  it('[Interface] um gênero que o enum NÃO comporta cabe sem mudar esta pilha', () => {
    // O motivo de C1 (alargar a união) ser não-opção no ADR-0030: um jogo com mapa de fases e tela de
    // resultados precisaria de duas constantes novas NA ENGINE. Aqui ele só empilha.
    const p = montar(['titulo', 'mapa', 'nivel', 'resultado']);
    expect(p.nomes()).toEqual(['titulo', 'mapa', 'nivel', 'resultado']);
    expect(p.top().nome).toBe('resultado');
  });
});
