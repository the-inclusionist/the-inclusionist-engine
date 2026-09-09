// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-store — a alternância lida e escrita no armazenamento (ADR-0113).
//
// 🎯 ESTE FICHEIRO AFIRMA A CLÁUSULA 1 DO ADR-0113 EM CÓDIGO: «trocar de transporte troca o valor como troca
// o mapa de teclas». O gate que o registo pede é literalmente isso — *o mesmo jogador, com dois transportes,
// dá duas respostas, e trocar de transporte troca a resposta SEM nenhuma escrita no armazenamento*.
//
// 📌 E É UM MÓDULO À PARTE DA REGRA de propósito. O `latch-scope` é puro e já tem gate; se o armazenamento
// vivesse lá dentro, cada caso da regra teria de montar um `localStorage` de mentira para afirmar coisas que
// não dependem dele. A divisão é a mesma do `render/viz-axes` (modelo) e `render/viz-setters` (escrita).
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  lerTriEstado, leituraDaAlternancia, alternanciaGuardada, gravarAlternancia,
} from '../app/js/input/latch-store.js';
import { chaveDaAlternancia, chaveLegadaDaAlternancia } from '../app/js/input/latch-scope.js';

/** Um armazém de mentira com a superfície mínima — e que REGISTA as escritas, porque uma delas é o defeito. */
function armazem(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  const set = (k, v) => { dados[k] = v; escritas.push([k, v]); };
  return {
    get: (k) => (k in dados ? dados[k] : null),
    set,
    // ⚠️ A FORMA QUE `gravarAlternancia` PEDE desde que o painel se ligou a ela: um ESCRITOR, e não um
    // armazém. O `ui/settings-motor` já tem um `store.setBool` injectado, e exigir-lhe um objecto com
    // `get`/`set` crus obrigaria a inventar um adaptador no ponto de uso — que é onde uma segunda forma de
    // escrever a mesma chave nasce.
    _escrever: (k, on) => set(k, on ? '1' : '0'),
    _dados: dados,
    _escritas: escritas,
  };
}

const BASE = 'togglemove';

describe('latch-store · três estados, e não dois', () => {
  it('[Right] `1` é ligado, `0` é desligado, ausente é NULO', () => {
    const a = armazem({ x: '1', y: '0' });
    expect(lerTriEstado(a, 'x')).toBe(true);
    expect(lerTriEstado(a, 'y')).toBe(false);
    expect(lerTriEstado(a, 'z')).toBe(null);
  });

  // 🔴 O CASO QUE DÁ NOME AO MÓDULO. Com `getBool`, «nunca escrito» viraria `false`, a regra pararia na
  // primeira linha e NUNCA consultaria o legado — e a criança perderia o ajuste que já tinha.
  it('🔴 [Zero] nunca escrito NÃO é `false`: o legado ainda é consultado, e é o ajuste da criança', () => {
    const a = armazem({ [chaveLegadaDaAlternancia(BASE, 0)]: '1' });
    const l = leituraDaAlternancia(a, BASE, 0, 'teclado', false);
    expect(l.doTransporte, 'nunca escrito virou um valor').toBe(null);
    expect(l.doLegado).toBe(true);
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false), 'a criança perdeu o ajuste que já tinha').toBe(true);
  });

  it('⚠️ [Boundary] `0` guardado NESTE transporte é um VALOR e vence o legado ligado', () => {
    const a = armazem({
      [chaveDaAlternancia(BASE, 0, 'teclado')]: '0',
      [chaveLegadaDaAlternancia(BASE, 0)]: '1',
    });
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false)).toBe(false);
  });
});

describe('latch-store · a cláusula 1 do ADR-0113: trocar de controle troca o valor', () => {
  // 🎯 O GATE QUE O REGISTO PEDE, e a segunda metade dele é a que importa: NENHUMA escrita acontece. Se
  // trocar de transporte precisasse de gravar, o valor não pertenceria ao mapeamento — pertenceria à sessão.
  it('🎯 [Right] o mesmo jogador dá duas respostas em dois transportes, sem escrever nada', () => {
    const a = armazem({
      [chaveDaAlternancia(BASE, 0, 'teclado')]: '1',
      [chaveDaAlternancia(BASE, 0, 'gamepad')]: '0',
    });
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false)).toBe(true);
    expect(alternanciaGuardada(a, BASE, 0, 'gamepad', false)).toBe(false);
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false), 'voltar ao primeiro deu outra resposta').toBe(true);
    expect(a._escritas, 'ler trocou de transporte E GRAVOU — o valor deixou de ser do mapeamento').toEqual([]);
  });

  it('[Right] jogadores diferentes não partilham chave no mesmo transporte', () => {
    const a = armazem({ [chaveDaAlternancia(BASE, 0, 'teclado')]: '1' });
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false)).toBe(true);
    expect(alternanciaGuardada(a, BASE, 1, 'teclado', false), 'o jogador 1 leu a chave do jogador 0').toBe(false);
  });

  it('[Zero] sem nada guardado, responde o padrão de fábrica', () => {
    const a = armazem();
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', false)).toBe(false);
    expect(alternanciaGuardada(a, BASE, 0, 'teclado', true), 'o padrão de fábrica foi ignorado').toBe(true);
  });
});

describe('latch-store · a escrita, e onde ela se recusa', () => {
  it('[Right] gravar escreve na chave DESTE transporte, e só nela', () => {
    const a = armazem();
    expect(gravarAlternancia(a._escrever, BASE, 0, 'gamepad', true)).toBe(true);
    expect(a._escritas).toEqual([[chaveDaAlternancia(BASE, 0, 'gamepad'), '1']]);
    expect(a._dados[chaveLegadaDaAlternancia(BASE, 0)], 'a escrita tocou na chave legada').toBeUndefined();
  });

  // ⚠️ A CLÁUSULA 3 DO ADR-0113: nos quatro assistidos não há escolha a gravar, porque a alternância é o que
  // faz a entrada funcionar. E a recusa é um `false` DEVOLVIDO — quem chama usa-o para desabilitar o controle
  // com o motivo dito, que é a metade que vive na interface.
  it('⚠️ [Zero] nos quatro assistidos a escrita RECUSA-SE, e não grava nada', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const a = armazem();
      expect(gravarAlternancia(a._escrever, BASE, 0, t, false), `${t} aceitou uma escolha que não existe`).toBe(false);
      expect(a._escritas, `${t} gravou um valor que o jogo vai ignorar`).toEqual([]);
    }
  });

  // 📌 O PAR: e nesses quatro a LEITURA continua a responder ligada, seja o que for que esteja no disco.
  // Sem este caso, «recusar a escrita» poderia significar «deixar a criança sem alternância», que é o oposto.
  it('📌 [Boundary] e a leitura deles responde LIGADA mesmo com `0` no disco', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const a = armazem({
        [chaveDaAlternancia(BASE, 0, t)]: '0',
        [chaveLegadaDaAlternancia(BASE, 0)]: '0',
      });
      expect(alternanciaGuardada(a, BASE, 0, t, false), `${t} pôde ficar sem alternância`).toBe(true);
    }
  });

  it('[Right] os três de hoje aceitam a escolha', () => {
    for (const t of ['teclado', 'gamepad', 'toque']) {
      const a = armazem();
      expect(gravarAlternancia(a._escrever, BASE, 0, t, true), `${t} recusou uma escolha legítima`).toBe(true);
      expect(alternanciaGuardada(a, BASE, 0, t, false)).toBe(true);
    }
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. `lerTriEstado` a devolver `v === '1'` sem o ramo do nulo (= o `getBool` que este módulo existe para
//    evitar)                                            → 🔴 o caso do LEGADO reprova: a criança perde o ajuste
// 2. `leituraDaAlternancia` a ignorar o legado           → o mesmo caso reprova, por outro caminho
// 3. `chaveDaAlternancia` sem o transporte no nome       → o caso dos DOIS TRANSPORTES reprova
// 4. `gravarAlternancia` sem a guarda `alternanciaEhEscolha` → o caso da RECUSA reprova nos quatro
// 5. `gravarAlternancia` a devolver `false` sempre       → o caso dos três de hoje reprova
//    📌 é o par da 4: sem ele, «recusar sempre» passaria no caso da recusa e mataria a escolha de toda a gente
// 6. `alternanciaGuardada` a gravar o valor lido (uma «cache»)  → 🎯 o caso da cláusula 1 reprova pela
//    asserção das ESCRITAS, e não pelo valor — que é a razão de essa asserção existir
