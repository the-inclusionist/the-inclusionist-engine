// SPDX-License-Identifier: AGPL-3.0-or-later
// «CAPACIDADE DECLARADA» NÃO PODE QUERER DIZER «SÓ RATO» — os dois gates que faltavam ao ADR-0112.
//
// O registo pede quatro. Dois estão feitos (`7ddb857` a recusa por aparelho sem ponteiro; `fd3717e` as catorze
// discretas). Estes são os outros dois, e o plano dizia que eles «exigem a fiação». **Lidos no registo, não
// exigem**: os dois são propriedades do MODELO.
//
//   · «UM PONTEIRO ALCANÇADO PELO OLHAR OFERECE AS MESMAS OPERAÇÕES QUE UM ALCANÇADO PELO RATO»
//   · «O PONTEIRO CARREGA A SUA FONTE, como todo comando (ADR-0111)»
//
// 📏 E A MEDIÇÃO DIZ ONDE CADA UM PODE SER AFIRMADO HOJE, que não é onde parece. `defaultTransports` tem
// TRÊS linhas — gamepad, teclado, toque —, e os quatro assistidos do ADR-0074 (olhos, rosto, gestos, fala)
// ainda não existem como transporte: são a issue #11, por construir. Logo não dá para afirmar sobre o olhar
// REAL. O que dá, e é o que a regra pede, é afirmar as duas coisas de que o olhar vai depender no dia em que
// chegar:
//
//   (a) as operações do `input/pointer` são CEGAS à origem — nenhuma delas se comporta de outro modo por
//       quem produziu a amostra; e a única que a lê, lê-a para RESPONDER sobre ela;
//   (b) o `reach` aceita um ponteiro declarado por um transporte QUALQUER, e não só pelos dois que hoje o
//       declaram. Uma «optimização» que perguntasse `t.id === 'teclado' || t.id === 'toque'` passaria em toda
//       a suíte de hoje e fecharia a porta ao olhar antes de ele existir.
//
// ⚠️ E É ESSA A FORMA DO DEFEITO QUE O REGISTO ANTECIPA: não uma recusa escrita, mas um caminho que só o rato
// percorre, descoberto quando alguém liga a webcam e o jogo de desenhar diz que o aparelho não serve.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isInside, clampInside, pressEdge, switchedTransport, PADRAO } from '../app/js/input/pointer.js';
import { TRANSPORT_NAMES } from '../app/js/input/transporte-em-uso.js';
import { reach } from '../app/js/input/transports.js';

const FONTE_PONTEIRO = readFileSync(fileURLToPath(new URL('../app/js/input/pointer.ts', import.meta.url)), 'utf8');

const amostra = (fx, fy, apertado, origem) => ({ fx, fy, origem, apertado });

/** Pontos que exercitam dentro, fora nos quatro lados, e as bordas inclusive. */
const PONTOS = [
  [0.5, 0.5], [0, 0], [1, 1], [0.5, 0], [0, 0.5],
  [-0.2, 0.5], [1.2, 0.5], [0.5, -0.3], [0.5, 1.4], [-2, 3],
];

describe('ADR-0112 · as operações do ponteiro são cegas à origem', () => {
  it('[Vácuo] há sete transportes e o módulo é mesmo lido', () => {
    expect(TRANSPORT_NAMES.length).toBe(7);
    expect(TRANSPORT_NAMES).toContain('olhos');
    expect(FONTE_PONTEIRO).toContain('export function clampInside');
  });

  it('[Feliz] `dentro` e `prender` dão o MESMO para os sete transportes', () => {
    for (const [fx, fy] of PONTOS) {
      const refDentro = isInside(amostra(fx, fy, false, 'rato-inexistente'));
      const refPreso = clampInside({ fx, fy });
      for (const origem of TRANSPORT_NAMES) {
        const a = amostra(fx, fy, false, origem);
        expect(isInside(a), `«dentro» mudou por ser ${origem}`).toBe(refDentro);
        const preso = clampInside(a);
        expect(preso.fx, `«prender» mudou por ser ${origem}`).toBe(refPreso.fx);
        expect(preso.fy, `«prender» mudou por ser ${origem}`).toBe(refPreso.fy);
      }
    }
  });

  // ⚠️ A BORDA É A OPERAÇÃO QUE UM JOGO DE DESENHAR MAIS USA — é ela que diz «a caneta desceu». Se ela
  // dependesse da origem, uma criança que desenha por permanência do olhar teria um traço que não começa.
  it('[Feliz] a borda do aperto é a mesma para os sete transportes', () => {
    for (const origem of TRANSPORT_NAMES) {
      const solto = amostra(0.5, 0.5, false, origem);
      const preso = amostra(0.5, 0.5, true, origem);
      expect(pressEdge(solto, preso), `descida perdida em ${origem}`).toBe('desceu');
      expect(pressEdge(preso, solto), `subida perdida em ${origem}`).toBe('subiu');
      expect(pressEdge(preso, preso), `${origem} inventou uma borda`).toBe(null);
    }
  });

  // 🎯 O CRIVO ESTRUTURAL, e é ele que segura a regra no futuro: uma operação NOVA que ramificasse por
  // transporte passaria nos casos acima (eles enumeram as operações de hoje) e tiraria o desenho ao olhar em
  // silêncio. Só `switchedTransport` pode ler `.origem` — e lê-a para RESPONDER sobre ela, não para decidir
  // outra coisa.
  it('[Fronteira] só `trocouDeTransporte` lê `.origem` neste módulo', () => {
    const semComentarios = FONTE_PONTEIRO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
    const partes = semComentarios.split(/export function /);
    const leitores = partes
      .filter((p) => p.includes('.origem'))
      .map((p) => p.slice(0, p.indexOf('(')));
    expect(leitores, `operação que ramifica por transporte: ${leitores.join(', ')}`).toEqual(['switchedTransport']);
  });

  it('[Interface] a origem é obrigatória na amostra — o padrão traz uma', () => {
    expect(TRANSPORT_NAMES).toContain(PADRAO.origem);
    expect(switchedTransport(PADRAO, { ...PADRAO, origem: 'olhos' })).toBe(true);
  });
});

describe('ADR-0112 · o alcance aceita ponteiro de QUALQUER transporte', () => {
  const ACOES = ['up', 'down', 'left', 'right'];
  // ⚠️ `slots: 14` E NÃO 1, e o caso [Zero] é que mo disse: com um lugar só, o olhar reprovava por LUGARES e
  // não por ponteiro, e os três casos de cima estariam a medir a coisa errada com a resposta certa. Catorze é
  // também o que o ADR-0074 reivindica para os transportes assistidos — o fixture descreve um aparelho que
  // pode existir, e não um que dá jeito.
  const olhar = (aponta) => ({
    id: 'olhos', slots: 14, available: () => true,
    ...(aponta === undefined ? {} : { aponta: () => aponta }),
  });

  // 🎯 O caso que fecha a porta antes de ela ser aberta: quando os transportes assistidos da #11 chegarem, o
  // `reach` já os aceita como ponteiro, sem uma linha nova e sem uma lista de ids privilegiados.
  it('[Feliz] um transporte assistido que declara apontar SERVE um jogo que pede ponteiro', () => {
    const a = reach([olhar(true)], ACOES, 1, true);
    expect(a.ok, 'o olhar declarou apontar e foi recusado').toBe(true);
    expect(a.naoApontam).toEqual([]);
  });

  // 📌 O PAR. Sem ele, «aceitar sempre» passaria no caso de cima — e um jogo de desenhar diria «serve» a um
  // aparelho que não tem como desenhar, que é a mentira que o `ok` não pode contar (ADR-0112, e a razão de o
  // `serve` ter passado a três coisas).
  it('[Fronteira] o mesmo transporte SEM declarar não serve, e o cartão diz porquê', () => {
    const a = reach([olhar(undefined)], ACOES, 1, true);
    expect(a.ok).toBe(false);
    expect(a.naoApontam).toEqual(['olhos']);
  });

  // ⚠️ `aponta` É FUNÇÃO e não booleano: a webcam pode ser ligada no meio da partida. Um transporte que
  // responde `false` agora é recusado agora, e isso não pode ficar congelado numa leitura de arranque.
  it('[Fronteira] quem declara apontar mas responde `false` agora é recusado agora', () => {
    const a = reach([olhar(false)], ACOES, 1, true);
    expect(a.ok).toBe(false);
    expect(a.naoApontam).toEqual(['olhos']);
  });

  it('[Zero] sem pedir ponteiro, o mesmo transporte serve na mesma', () => {
    expect(reach([olhar(undefined)], ACOES, 1, false).ok).toBe(true);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// O que segue é o MEDIDO, e uma delas contradiz o que eu tinha previsto — de forma útil.
//
// 1. `clampInside` a só devolver o mesmo objecto quando `origem === 'rato'`
//    → reprova SÓ o crivo ESTRUTURAL. 🎯 E é a mutação mais informativa do lote: os casos de comportamento
//    NÃO a apanham, porque `clampInside` recebe `AsFraction` (só `fx`/`fy`) e a mutação muda a IDENTIDADE do
//    objecto devolvido, não as coordenadas — e as coordenadas são o que eles comparam. Ou seja: o crivo
//    estrutural apanha uma classe que a enumeração de operações não alcança, que é exactamente a razão de
//    ele existir e não uma duplicação dela.
// 2. `pressEdge` a devolver `null` para quem não é 'teclado' nem 'toque' — a forma EXACTA do defeito que
//    o registo teme → reprovam o [Feliz] da borda **e** o crivo estrutural
// 3. `apontaSeFor` → `!pedePonteiro || t.id === 'teclado' || t.id === 'toque'` → o [Feliz] do alcance reprova
// 4. `apontaSeFor` → `true`                                          → os DOIS [Fronteira] do alcance reprovam
// 5. `TRANSPORT_NAMES` reduzido a três                                   → [Vácuo] reprova
//    🎯 com a lista cega, os laços correriam sobre menos transportes e ficariam verdes sem dizer nada sobre o
//    olhar — um crivo que enumera é tão forte quanto a sua lista.
