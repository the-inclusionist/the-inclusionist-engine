// SPDX-License-Identifier: AGPL-3.0-or-later
// A AMOSTRA DE PONTEIRO (ADR-0112), na metade pura — issue #105.
//
// ⚠️ O QUE ESTE FICHEIRO GUARDA NÃO É ARITMÉTICA. Saturar um número entre 0 e 1 não precisava de teste; o que
// precisa é a DECISÃO ao lado dela — que `dentro` seja perguntável DEPOIS de saturar. Duas coisas a jusante
// querem metades opostas do mesmo facto: desenhar quer a posição presa à tela, e o modo olhos 3 do ADR-0104
// quer saber que a criança olhou PARA FORA dela, porque é esse o gesto que lhe abre a lista de acções.
//
// Saturar sem guardar a resposta mataria o segundo, em silêncio, e o dono desse modo é uma criança com ELA
// severa que não tem outro caminho.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  PADRAO, dentro, prender, bordaDoAperto, trocouDeTransporte,
} from '../app/js/input/pointer.js';

const amostra = (over = {}) => ({ ...PADRAO, ...over });

describe('onde o ponteiro está', () => {
  it('[Right] dentro da região é dentro, nas bordas inclusive', () => {
    expect(dentro({ fx: 0.5, fy: 0.5 })).toBe(true);
    // ⚠️ As bordas CONTAM. Um traço que começa exactamente na margem é um traço legítimo, e um `<`/`>` aqui
    // faria a criança perder a primeira linha do desenho sem nada dizer.
    expect(dentro({ fx: 0, fy: 0 })).toBe(true);
    expect(dentro({ fx: 1, fy: 1 })).toBe(true);
  });

  it('⚠️ [Boundary] fora é fora, nos quatro lados', () => {
    expect(dentro({ fx: -0.01, fy: 0.5 })).toBe(false);
    expect(dentro({ fx: 1.01, fy: 0.5 })).toBe(false);
    expect(dentro({ fx: 0.5, fy: -0.01 })).toBe(false);
    expect(dentro({ fx: 0.5, fy: 1.01 })).toBe(false);
  });

  it('[Right] prender satura nos dois eixos e nos dois sentidos', () => {
    expect(prender({ fx: -2, fy: 3 })).toEqual({ fx: 0, fy: 1 });
    expect(prender({ fx: 1.5, fy: -0.5 })).toEqual({ fx: 1, fy: 0 });
  });

  it('📌 [Right] quem já está dentro volta como o MESMO objecto, sem alocar', () => {
    // O ponteiro é amostrado a cada quadro; uma cópia por quadro num aparelho de escola é o custo que o
    // pilar 1 recusa. E é observável, então é caso e não comentário.
    const f = { fx: 0.25, fy: 0.75 };
    expect(prender(f)).toBe(f);
  });

  it('🎯 [Zero] PRENDER NÃO APAGA O FACTO DE TER SAÍDO — é a decisão inteira deste módulo', () => {
    // ⚠️ O caso que este ficheiro existe para prender. Se `prender` fosse o único caminho e `dentro` fosse
    // perguntado DEPOIS dele, a resposta seria sempre `true` e o modo olhos 3 do ADR-0104 perderia o seu
    // único gesto — «olhar para fora» — sem erro nenhum e sem nada na tela a dizê-lo.
    const olhouParaCima = { fx: 0.5, fy: -0.4 };
    expect(dentro(olhouParaCima), 'o gesto do modo olhos 3').toBe(false);
    const paraDesenhar = prender(olhouParaCima);
    expect(paraDesenhar).toEqual({ fx: 0.5, fy: 0 });          // o traço fica na tela
    expect(dentro(olhouParaCima), 'a pergunta continua respondível').toBe(false); // e o gesto sobrevive
  });
});

describe('o que o ponteiro está a fazer', () => {
  it('[Right] a borda do aperto é a descida e a subida, e nada entre elas', () => {
    const solto = amostra({ apertado: false });
    const preso = amostra({ apertado: true });
    expect(bordaDoAperto(solto, preso)).toBe('desceu');
    expect(bordaDoAperto(preso, solto)).toBe('subiu');
  });

  it('⚠️ [Zero] segurar não é uma borda — senão o jogo desenharia o mesmo ponto 60 vezes', () => {
    const preso = amostra({ apertado: true });
    expect(bordaDoAperto(preso, amostra({ apertado: true, fx: 0.9 }))).toBeNull();
    expect(bordaDoAperto(amostra(), amostra({ fx: 0.1 }))).toBeNull();
  });

  it('⚠️ [Right] a TROCA DE APARELHO é perguntável — a criança larga o rato e olha para a tela', () => {
    // Sem isto, a troca de transporte só seria notada na próxima TECLA, e as regras do ADR-0109 (a alternância
    // segue o aparelho em uso) ficariam a responder sobre um aparelho que ninguém está a usar.
    expect(trocouDeTransporte(amostra({ origem: 'teclado' }), amostra({ origem: 'olhos' }))).toBe(true);
    expect(trocouDeTransporte(amostra({ origem: 'olhos' }), amostra({ origem: 'olhos', fx: 0.9 }))).toBe(false);
  });

  it('[Interface] o padrão é o repouso, e é congelado', () => {
    expect(PADRAO).toEqual({ fx: 0.5, fy: 0.5, origem: 'teclado', apertado: false });
    expect(Object.isFrozen(PADRAO)).toBe(true);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Seis, por script e com contagem de ocorrencias, todas mortas.
//
//   1. as bordas fora do `dentro` (`>=` vira `>`) -> reprova o [Boundary]. Um traco que comeca exactamente na
//      margem e um traco legitimo, e a crianca perderia a primeira linha sem nada dizer.
//   2. `prender` a alocar sempre -> reprova o caso da identidade. O ponteiro e amostrado a cada quadro.
//   3. 🎯 `prender` a SATURAR NO SITIO (`Object.assign(f, ...)`) -> reprova o caso decisivo. E a mutacao que
//      importa deste ficheiro: ela nao quebra nenhuma conta — o desenho continua certo, os numeros continuam
//      certos — e apaga o unico gesto do MODO OLHOS 3 do ADR-0104. Uma crianca com ELA severa abre a lista de
//      accoes olhando PARA FORA da tela; saturar no sitio faz `dentro` responder `true` para sempre, e o modo
//      morre em silencio. Nenhum outro caso deste ficheiro reprova com ela aplicada.
//   4. segurar a virar borda -> reprova o [Zero]. Sessenta desenhos do mesmo ponto por segundo.
//   5. `trocouDeTransporte` sempre falso -> reprova o caso dela. A troca so seria notada na proxima TECLA, e
//      as regras do ADR-0109 responderiam sobre um aparelho que ninguem esta a usar.
//   6. `PADRAO` sem congelar -> reprova o [Interface]. Um padrao partilhado que alguem muta e um padrao que
//      deixa de existir para todos os outros.
