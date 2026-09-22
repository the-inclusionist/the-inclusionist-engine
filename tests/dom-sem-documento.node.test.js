// SPDX-License-Identifier: AGPL-3.0-or-later
// UMA CONSULTA QUE PROMETE `null` NÃO PODE LANÇAR — o ACHADO 15, na folha onde ele nascia.
//
// ========================= COMO ISTO FOI ENCONTRADO =========================
// Não por leitura: por um caso NOVO a chegar mais longe do que os anteriores. Ao ligar a declaração de
// ponteiro (ADR-0112) ao `createGame`, um jogo que declara ponteiro num aparelho que não aponta passou a
// REPROVAR o alcance — e reprovar é o que faz o `ui/reach-notice` aparecer, e aparecer é o que faz o
// `core/a11y-sr.srAlert` ser chamado. Até esse dia nenhum caso deste project chegava lá.
//
// ⚠️ E O QUE ESTAVA NO FIM DO CAMINHO REBENTAVA O BOOT INTEIRO: `srAlert` chama o `$` do `ui/dom`, que lia o
// `document` GLOBAL. Onde ele não existe isso é `ReferenceError` e não `undefined`, então bootar a engine
// contra um documento INJECTADO — um iframe, um editor ao lado do jogo, este project — matava o `createGame`
// dentro de um ANÚNCIO.
//
// 📌 A assinatura já dizia a regra: `$<T>(s): T | null`. Devolver nada é um resultado previsto; lançar não é.
// E o conserto não muda ONDE se procura — quem precisa de outro documento injecta o seu, como o `create-game`
// e o `ui/pause-icons` já fazem. Muda o que acontece quando não há onde.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { $, $$ } from '../app/js/ui/dom.js';

describe('ui/dom sem documento nenhum (project node)', () => {
  it('⚠️ [Zero] este project NÃO tem `document` — é a premissa do ficheiro, e é afirmada', () => {
    // Sem isto os dois casos abaixo passariam num ambiente com DOM sem provar nada, que é a forma de verde
    // falso que este repositório já apanhou mais de uma vez.
    expect(typeof globalThis.document, 'este caso perdeu o sentido: há DOM aqui').toBe('undefined');
  });

  it('🎯 [Zero] `$` devolve `null` em vez de lançar', () => {
    expect(() => $('#sr-alert')).not.toThrow();
    expect($('#sr-alert')).toBeNull();
  });

  it('🎯 [Zero] `$$` devolve lista vazia em vez de lançar', () => {
    expect(() => $$('.pi-btn')).not.toThrow();
    expect($$('.pi-btn')).toEqual([]);
  });

  it('⚠️ [Right] e um consumidor a jusante sobrevive — o anúncio cala-se, não rebenta', async () => {
    // O caminho real que trouxe isto à luz. Um leitor de tela sem região onde escrever não tem o que anunciar;
    // o que ele não pode é derrubar o jogo por causa disso.
    const { srAlert, srSay } = await import('../app/js/core/a11y-sr.js');
    expect(() => srAlert('a tecla já está em uso')).not.toThrow();
    expect(() => srSay('Jogador 2 entrou')).not.toThrow();
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · 🎯 `$` a voltar a ler o global cru (`document.querySelector(...)`) -> reprovam TRES: os dois casos
//     directos e o do consumidor a jusante. E nao e uma mutacao inventada — e o codigo que estava aqui.
//   · `$$` a voltar ao global cru -> reprova o caso dele. Os dois separados de proposito: consertar um e
//     esquecer o outro e a forma de defeito que este repositorio ja pagou (o `releaseAllKeys` que limpava meia
//     rede), e uma mutacao por funcao e o que a apanha.
//   · ⚠️ O caso da PREMISSA (`typeof globalThis.document === 'undefined'`) nao se muta: ele existe para o
//     ficheiro nao passar por engano num ambiente COM DOM, onde os outros tres seriam verdes sem provar nada.
