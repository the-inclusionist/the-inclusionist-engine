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
import { criarAvisoDeQueda } from '../app/js/ui/loop-crash.js';
import { startLoop } from '../app/js/core/loop.js';
import pt from '../app/js/i18n/pt.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Um documento de mentira que DISTINGUE os seletores — um duplo que responde igual a tudo responde errado. */
function docFalso(presentes = ['#sr-alert', '#game-region']) {
  const mapa = new Map();
  for (const sel of presentes) mapa.set(sel, { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  return { procurar: (sel) => mapa.get(sel) ?? null, el: (sel) => mapa.get(sel) ?? null };
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
    criarAvisoDeQueda({ procurar: d.procurar })(new Error('o jogo quebrou'));
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
  });

  it('[Right] e põe a MESMA frase no atributo que a folha de estilo mostra', () => {
    // O texto vai no ATRIBUTO e não no CSS porque é ele que carrega a tradução. Um aviso cravado na folha de
    // estilo estaria em inglês para uma criança brasileira — o pilar 3 falhando na frase mais importante.
    const d = docFalso();
    criarAvisoDeQueda({ procurar: d.procurar })(new Error('x'));
    expect(d.el('#game-region').attrs['data-incl-parou']).toBe(FRASE);
  });

  it('[Right] narra, para quem ouve em vez de ler', () => {
    const ditas = [];
    criarAvisoDeQueda({ procurar: docFalso().procurar, narrar: (s) => ditas.push(s) })(new Error('x'));
    expect(ditas).toEqual([FRASE]);
  });

  it('[Interface] o CONSOLE recebe o erro original — é o que sobra para quem depura', () => {
    const boom = new Error('causa de verdade');
    criarAvisoDeQueda({ procurar: docFalso().procurar })(boom);
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
    const avisar = criarAvisoDeQueda({ procurar: d.procurar, narrar: () => { throw new Error('sem voz'); } });
    expect(() => avisar(new Error('x'))).not.toThrow();
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
    expect(d.el('#game-region').attrs['data-incl-parou']).toBe(FRASE);
  });

  it('[Zero] documento sem as regiões: não lança, e o console continua a receber', () => {
    // Um jogo cujo hospedeiro não trouxe a marcação perde o aviso; o que ele NÃO pode é ganhar um segundo
    // erro por causa do primeiro.
    const avisar = criarAvisoDeQueda({ procurar: docFalso([]).procurar });
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
      { aoFalhar: criarAvisoDeQueda({ procurar: d.procurar }) });

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
      { aoFalhar: criarAvisoDeQueda({ procurar: docFalso().procurar, narrar: (s) => ditas.push(s) }) });
    for (let i = 0; i < 10; i++) t.passo();
    expect(ditas).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('a RAIZ do jogo de plataforma liga o aviso — e ela não passa por `createGame`', () => {
  // ⚠️ POR QUE ESTE CASO LÊ O FONTE em vez de exercitar o módulo. `app/js/main.ts` é a raiz de composição do
  // jogo de plataforma: importá-lo num teste arranca PixiJS, áudio e o documento inteiro. Mas é ELE quem chama
  // `startLoop`, e foi exatamente aí que o `aoFalhar` ficou de fora — a chamada tinha DOIS argumentos, e um
  // argumento posicional que não se escreve não deixa rasto nenhum.
  //
  // A alternativa a ler o fonte era não aferir nada, e «não aferir nada» foi o estado que produziu o defeito.
  const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'main.ts'), 'utf8');

  it('[Right] `startLoop` recebe um `aoFalhar`, e não só o ticker e o quadro', () => {
    const i = FONTE.indexOf('startLoop(app.ticker');
    expect(i, 'não encontrei a chamada de startLoop em main.ts').toBeGreaterThan(-1);
    const chamada = FONTE.slice(i, FONTE.indexOf('window.__incl', i));
    expect(chamada, 'o laço voltou a parar em silêncio').toContain('aoFalhar');
    expect(chamada).toContain('criarAvisoDeQueda');
  });

  it('[Zero] e o aviso vem do módulo da engine, não de uma cópia local', () => {
    // Uma segunda implementação do aviso divergiria da primeira em silêncio: a frase mudaria num jogo e não
    // no outro, e ninguém compara duas mensagens de erro que nunca aparecem ao mesmo tempo.
    expect(FONTE).toContain("from './ui/loop-crash.js'");
  });
});
