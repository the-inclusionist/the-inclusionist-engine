// SPDX-License-Identifier: AGPL-3.0-or-later
// O AVISO DE QUE O LAÇO PAROU — a outra metade do ADR-0054, e o terceiro fio da issue #109.
//
// `core/loop.startLoop` já parava quando um quadro lançava, e já chamava `aoFalhar`. Ninguém passava um. A
// `confirmation` do ADR-0054 registra isso por escrito: *"a raiz de composição ainda não liga o `aoFalhar`…
// enquanto isto não existir este registro é só metade verdadeiro."*
//
// ⚠️ E A METADE QUE FALTAVA É A QUE IMPORTA. Tela congelada é sintoma VISUAL. No modo cego, um jogo parado e
// um jogo pensando produzem a mesma coisa — silêncio —, e a criança fica a esperar por um jogo que já morreu.
// O único aviso que existia era um erro no console, que ela não lê.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCrashNotice } from '../app/js/ui/loop-crash.js';
import { startLoop } from '../app/js/core/loop.js';
import pt from '../app/js/i18n/pt.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Um documento de mentira que DISTINGUE os seletores — um duplo que responde igual a tudo responde errado.
 *
 * ⚠️ `#incl-parou` NÃO está entre os presentes de propósito: o aviso procura-o antes de criar, para não
 * empilhar duas caixas quando o laço tenta parar duas vezes. Um duplo que devolvesse um elemento para
 * qualquer seletor faria o módulo achar que a caixa já existe e nunca a acrescentar — e o caso passaria a
 * afirmar o contrário do que promete.
 */
function docFalso(presentes = ['#sr-alert', '#game-region']) {
  const novo = () => ({
    id: '', textContent: '', attrs: {}, filhos: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(f) { this.filhos.push(f); return f; },
  });
  const mapa = new Map();
  for (const sel of presentes) mapa.set(sel, novo());
  return {
    find: (sel) => mapa.get(sel) ?? null,
    create: () => novo(),
    el: (sel) => mapa.get(sel) ?? null,
    /** A caixa do aviso, se ela foi acrescentada ao `#game-region`. */
    caixa: () => (mapa.get('#game-region')?.filhos ?? []).find((f) => f.id === 'incl-parou') ?? null,
  };
}

const FRASE = pt['sr.laco.parou'];

let erroDoConsole;
// ⚠️ O `mockClear` NÃO É ZELO. `vi.spyOn` sobre o mesmo objeto devolve o espião QUE JÁ EXISTE, e as chamadas
// acumulam entre casos: sem isto, `calls[0]` é do primeiro teste do ficheiro e não deste. Custou uma asserção
// que reprovava a comparar um erro com o erro de outro caso — verde ou vermelho pelo motivo errado.
beforeEach(() => {
  erroDoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  erroDoConsole.mockClear();
});

describe('criarAvisoDeQueda — quem não vê a tela precisa OUVIR que ela parou', () => {
  it('[Right] escreve a frase na região assertiva do leitor de tela', () => {
    const d = docFalso();
    createCrashNotice({ find: d.find, create: d.create })(new Error('o jogo quebrou'));
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
  });

  it('[Right] ⚠️ e cria um ELEMENTO com a frase — não um pseudo-elemento', () => {
    // ERA `::after` com `content: attr(...)`, e o arranque real mostrou que NUNCA apareceria: a scanline do
    // CRT já ocupa o `::after` de `#game-region`, a vinheta ocupa o `::before`, e um elemento tem UM de cada.
    // As regras não se empilham — a do CRT vem depois e vence.
    //
    // ⚠️ E o pseudo-elemento era errado por uma segunda razão que a primeira escondia: texto de `content` não
    // entra de forma confiável na árvore de acessibilidade, e este é o aviso que menos pode depender disso.
    // Daí o `role="alert"`.
    const d = docFalso();
    createCrashNotice({ find: d.find, create: d.create })(new Error('x'));
    const caixa = d.caixa();
    expect(caixa, 'a caixa do aviso não foi acrescentada ao #game-region').toBeTruthy();
    expect(caixa.textContent).toBe(FRASE);
    expect(caixa.attrs.role).toBe('alert');
  });

  it('[Zero] ⚠️ duas quedas não empilham duas caixas', () => {
    // O laço para uma vez, mas nada impede um segundo `aoFalhar` (outro laço, um jogo que remonta). Duas
    // caixas sobrepostas seriam duas frases idênticas na tela e duas no leitor.
    const d = docFalso();
    const avisar = createCrashNotice({ find: d.find, create: d.create });
    avisar(new Error('x'));
    const primeira = d.caixa();
    // a partir daqui a caixa já existe no documento, e é isso que o módulo procura antes de criar
    d.el('#game-region').filhos.forEach((f) => { if (f.id === 'incl-parou') d.jaExiste = f; });
    expect(primeira).toBeTruthy();
    expect(d.el('#game-region').filhos.filter((f) => f.id === 'incl-parou')).toHaveLength(1);
  });

  it('[Right] narra, para quem ouve em vez de ler', () => {
    const ditas = [];
    createCrashNotice({ find: docFalso().find, create: docFalso().create, narrate: (s) => ditas.push(s) })(new Error('x'));
    expect(ditas).toEqual([FRASE]);
  });

  it('[Interface] o CONSOLE recebe o erro original — é o que sobra para quem depura', () => {
    const boom = new Error('causa de verdade');
    createCrashNotice({ find: docFalso().find, create: docFalso().create })(boom);
    expect(erroDoConsole).toHaveBeenCalled();
    // O ERRO EM SI, e não uma string sobre ele: `String(erro)` perde a pilha, que é a única coisa que diz
    // ONDE o quadro quebrou. Aferido por identidade, no argumento onde ele entra.
    expect(erroDoConsole.mock.calls[0][1]).toBe(boom);
  });

  it('[Error] ⚠️ uma narração que LANÇA não pode engolir o aviso escrito', () => {
    // É a mesma regra que o `startLoop` aplica a este próprio callback: um aviso que falha pela metade tem de
    // entregar a outra metade. Sem esta ordem, uma síntese de voz indisponível apagaria o texto do leitor de
    // tela — e a criança que mais precisa da frase é justamente quem depende dos dois canais.
    const d = docFalso();
    const avisar = createCrashNotice({ find: d.find, create: d.create, narrate: () => { throw new Error('sem voz'); } });
    expect(() => avisar(new Error('x'))).not.toThrow();
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
    expect(d.caixa()?.textContent).toBe(FRASE);
  });

  it('[Zero] documento sem as regiões: não lança, e o console continua a receber', () => {
    // Um jogo cujo hospedeiro não trouxe a marcação perde o aviso; o que ele NÃO pode é ganhar um segundo
    // erro por causa do primeiro.
    const avisar = createCrashNotice({ find: docFalso([]).find, create: docFalso([]).create });
    expect(() => avisar(new Error('x'))).not.toThrow();
    expect(erroDoConsole).toHaveBeenCalled();
  });
});

describe('e ligado ao laço de verdade, ponta a ponta', () => {
  /** Um ticker mínimo com a forma que `startLoop` pede. */
  function ticker() {
    const fns = [];
    return { deltaTime: 1, add: (f) => fns.push(f), remove: (f) => fns.splice(fns.indexOf(f), 1), passo: () => fns.forEach((f) => f()) };
  }

  it('[Right] um quadro que lança PARA o laço e ANUNCIA — a confirmação do ADR-0054, inteira', () => {
    const d = docFalso();
    const t = ticker();
    let quadros = 0;
    startLoop(t, () => { quadros++; throw new Error('o jogo quebrou'); }, 2,
      { onFailure: createCrashNotice({ find: d.find, create: d.create }) });

    t.passo(); t.passo(); t.passo();

    expect(quadros, 'o laço continuou a chamar o quadro').toBe(1);
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
  });

  it('[Interface] anuncia UMA vez, e não sessenta vezes por segundo', () => {
    // Repetir o anúncio a cada quadro faria o leitor de tela dizer a mesma frase sem parar — trocar um jogo
    // parado em silêncio por um jogo parado que grita não é conserto.
    const ditas = [];
    const t = ticker();
    startLoop(t, () => { throw new Error('x'); }, 2,
      { onFailure: createCrashNotice({ find: docFalso().find, create: docFalso().create, narrate: (s) => ditas.push(s) }) });
    for (let i = 0; i < 10; i++) t.passo();
    expect(ditas).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------------------------------------

// ⚠️ UM DESCRIBE SAIU DAQUI em 2026-09-07 (issue #111): ele afirmava algo sobre o CARTUCHO — a raiz de
// composicao (`main.ts`) ou o `app/index.html` do jogo — e nenhum dos dois vive mais neste repositorio.
// As asseercoes nao foram apagadas: mudaram para `game-platformer`, onde os ficheiros estao. O que fica
// aqui e' o comportamento da ENGINE, que e' o que este ficheiro sempre teve de provar.
