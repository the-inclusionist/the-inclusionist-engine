// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/fractions — matemática + texto de frações (project node). ZOMBIES + Right-BICEP.
// Puro (string/número, sem DOM). Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, frações).
import { describe, it, expect } from 'vitest';
import { gcd, fracStr, fmtFrac, fracSpeak, fracSpeakValue, speakChoice, fracGraphic } from '../app/js/game/fractions.js';

describe('gcd / fracStr', () => {
  it('gcd', () => { expect(gcd(12, 8)).toBe(4); expect(gcd(7, 3)).toBe(1); expect(gcd(6, 0)).toBe(6); });
  it('fracStr simplifica e trata inteiro/zero', () => {
    expect(fracStr(0, 4)).toBe('0');
    expect(fracStr(4, 4)).toBe('1');
    expect(fracStr(2, 4)).toBe('1/2'); // reduz
    expect(fracStr(3, 5)).toBe('3/5');
  });
});

describe('fmtFrac (notações)', () => {
  it('diagonal (padrão) reduz', () => expect(fmtFrac(2, 4, 'd')).toBe('1/2'));
  it('decimal: SEMPRE 1 casa, vírgula', () => { expect(fmtFrac(1, 2, 'dec')).toBe('0,5'); expect(fmtFrac(0, 3, 'dec')).toBe('0,0'); });
  it('percentual', () => { expect(fmtFrac(1, 2, 'pct')).toBe('50%'); expect(fmtFrac(1, 4, 'pct')).toBe('25%'); });
  it('mista: parte inteira + resto', () => expect(fmtFrac(7, 2, 'mix')).toBe('3 1/2'));
  it('vertical: HTML', () => expect(fmtFrac(1, 2, 'v')).toBe('<span class="fv"><b>1</b><b>2</b></span>'));
  it('inteiro cai no número', () => expect(fmtFrac(6, 3, 'd')).toBe('2'));
});

describe('fracSpeak (pt-BR)', () => {
  it('um meio, 3 quartos', () => { expect(fracSpeak('1/2')).toBe('um meio'); expect(fracSpeak('3/4')).toBe('3 quartos'); });
  it('denominador sem nome → "avos"', () => expect(fracSpeak('1/11')).toBe('um 11 avos'));
  it('plural com "avos" é invariável (não "avoss")', () => {
    expect(fracSpeak('5/12')).toBe('5 doze avos');
    expect(fracSpeak('5/11')).toBe('5 11 avos');
  });
  it('não-fração passa direto', () => expect(fracSpeak('abc')).toBe('abc'));
});

describe('speakChoice (qualquer notação)', () => {
  it('vertical HTML → lê a fração', () => expect(speakChoice('<span class="fv"><b>1</b><b>2</b></span>')).toBe('um meio'));
  it('mista → "N inteiros e ..."', () => expect(speakChoice('3 1/2')).toBe('3 inteiros e um meio'));
  it('SVG com data-frac → lê a fração', () => expect(speakChoice('<span data-frac="1/4">…</span>')).toBe('um quarto'));
});

describe('fracGraphic', () => {
  it('fração própria → span com data-frac + aria falado', () => {
    const g = fracGraphic(1, 4, 'square');
    expect(g).toContain('data-frac="1/4"');
    expect(g).toContain('aria-label="um quarto"');
    expect(g).toContain('<svg');
  });
  it('imprópria/zero/denominador fora de 2..6 → vazio (o chamador mostra número)', () => {
    expect(fracGraphic(5, 4)).toBe(''); // imprópria
    expect(fracGraphic(0, 4)).toBe('');
    expect(fracGraphic(1, 7)).toBe(''); // d>6
  });
});

/* ============ fracSpeakValue: o rotulo da FIGURA fala o valor, nao a fracao escrita ============ */
describe('fracSpeakValue — o nome acessivel da figura', () => {
  // Por que existe: `fracGraphic(2,2)` desenha um circulo INTEIRO e o rotulo dizia "dois meios", enquanto o
  // MESMO valor saindo como texto dizia "1". Qual dos dois a crianca recebia era um `rnd() < 0.5` no quiz —
  // um sorteio invisivel mudando a pergunta para quem usa leitor de tela. E `keyOf`, que corrige a resposta,
  // sempre usou a forma reduzida.
  it('[Right] 2/2 é "1", nao "dois meios" — a figura mostra um inteiro', () => {
    expect(fracSpeakValue(2, 2)).toBe('1'); // digito, igual ao que fmtFrac devolve para o mesmo valor
  });
  it('[Right] 4/2 é "2"', () => { expect(fracSpeakValue(4, 2)).toBe('2'); });
  it('[Right] 2/4 reduz para "um meio"', () => { expect(fracSpeakValue(2, 4)).toBe('um meio'); });
  it('[Right] 3/4 nao reduz e continua "3 quartos"', () => { expect(fracSpeakValue(3, 4)).toBe('3 quartos'); });
  it('[Invariant] fracSpeak segue LITERAL: ela le a fracao escrita, sem simplificar', () => {
    expect(fracSpeak('2/2')).toBe('2 meios'); // continua sendo a leitura de "2/2" como TEXTO
    expect(fracSpeakValue(2, 2)).toBe('1');   // e o valor que a figura mostra e outro
  });
  it('[Right] o aria-label da figura usa o VALOR', () => {
    const html = fracGraphic(2, 2);
    expect(html).toContain('aria-label="1"');
    expect(html).toContain('data-frac="2/2"'); // o dado cru continua la, para quem precisar dele
  });
  it('[Invariant] speakChoice concorda com o rotulo da figura que ele le', () => {
    expect(speakChoice(fracGraphic(2, 2))).toBe('1');
    expect(speakChoice(fracGraphic(2, 4))).toBe('um meio');
  });
  it('[Right] figura e texto falam a MESMA coisa para o mesmo valor — era isso que o sorteio quebrava', () => {
    for (const [n, d] of [[2, 2], [2, 4], [3, 4], [4, 4], [1, 2]]) {
      const porFigura = speakChoice(fracGraphic(n, d));
      const porTexto = speakChoice(fmtFrac(n, d, 'd'));
      expect(porFigura).toBe(porTexto);
    }
  });
});
