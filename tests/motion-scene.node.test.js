// SPDX-License-Identifier: AGPL-3.0-or-later
// O MOVIMENTO REDUZIDO DE CENA É DA ENGINE (ADR-0106 §4, etapa 1).
//
// ⚠️ ESTE MÓDULO NASCE VERDE, LOGO O VERDE NÃO É A PROVA. Ele não conserta um defeito visível: move para a
// engine quatro coisas que cada cartucho tinha de se lembrar de escrever, e cinco jogos não se lembraram. O
// que prova cobertura são as mutações no fim do ficheiro.
//
// ⚠️ E O CASO QUE MAIS INTERESSA É O DO GUARDADO TRUNCADO, porque é o único onde o comportamento certo e o
// cómodo divergem: espalhar o objecto (`{...guardado}`) é mais curto e deixa uma chave em falta como
// `undefined` — que se lê como «não reduzido» para uma criança que pediu redução.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, afterEach } from 'vitest';
import {
  CHAVES_DE_CENA, ANIMACOES_DO_PERSONAGEM, padraoDeCena, lerCenaGuardada, guardarCena,
} from '../app/js/ui/motion-scene.js';
import { RM_LABEL } from '../app/js/ui/settings-motion.js';
import { KEYS } from '../app/js/platform/storage.js';

/** Um `localStorage` de mentira, porque o project `node` não tem nenhum e a camada de armazenamento
 *  degrada em silêncio (todo acesso é `try/catch`) — sem o dublê, o caso do truncado não teria o que ler. */
function comArmazenamento(inicial = {}) {
  const dados = { ...inicial };
  globalThis.localStorage = {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
  return dados;
}
afterEach(() => { delete globalThis.localStorage; });

describe('ADR-0106 · o movimento reduzido de cena pertence à engine', () => {
  it('[Right] sem nada guardado, as QUATRO chaves existem e seguem o padrão do sistema', () => {
    comArmazenamento();
    const rm = lerCenaGuardada();
    // No project `node` não há `window`, então `defaultReducedMotion()` responde `false` — e o que se afirma
    // é que as quatro chaves EXISTEM com esse valor, não que o valor seja falso por si.
    expect(Object.keys(rm).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
    expect(Object.values(rm).every((v) => v === false)).toBe(true);
    expect(rm).toEqual(padraoDeCena());
  });

  it('⚠️ [Right] um guardado TRUNCADO não deixa chave por preencher — `undefined` seria «não reduzido»', () => {
    // O cartucho tinha esta forma certa; o risco é ela perder-se na mudança de dono. Um objecto com UMA
    // chave é o que um armazenamento truncado ou de versão anterior devolve.
    comArmazenamento({ [KEYS.reducedMotion]: JSON.stringify({ parallax: true }) });
    const rm = lerCenaGuardada();
    expect(rm.parallax).toBe(true);
    expect(rm.decor).toBe(false);
    expect(rm.items).toBe(false);
    expect(rm.particles).toBe(false);
    expect(Object.keys(rm).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
  });

  it('⚠️ [Right] uma chave A MAIS no guardado NÃO entra — o dado vem do navegador de uma criança', () => {
    comArmazenamento({ [KEYS.reducedMotion]: JSON.stringify({ parallax: true, cintilar: true }) });
    expect(Object.keys(lerCenaGuardada()).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
  });

  it('[Right] um guardado corrompido cai no padrão em vez de rebentar', () => {
    comArmazenamento({ [KEYS.reducedMotion]: 'isto não é JSON' });
    expect(lerCenaGuardada()).toEqual(padraoDeCena());
  });

  it('[Right] `guardarCena` escreve na chave da ENGINE, que é onde o cartucho já escrevia', () => {
    // A migração silenciosa que este caso impede: guardar noutra chave perderia o ajuste de toda criança que
    // já jogou, sem nada dizer que perdeu.
    const dados = comArmazenamento();
    guardarCena({ parallax: true, decor: false, items: true, particles: false });
    expect(JSON.parse(dados[KEYS.reducedMotion])).toEqual({ parallax: true, decor: false, items: true, particles: false });
  });

  it('⚠️ [Interface] os rótulos do personagem são os que o `RM_LABEL` produz — duas tabelas, uma palavra', () => {
    // Cruzamento entre tabelas escritas separadamente, e não espelho: `RM_LABEL` mapeia `walk`→`rm.walk`, e
    // esta lista mapeia `rmWalk`→`rm.walk`. Escrever `rm.andar` num dos lados reprova aqui.
    const producidos = new Set(Object.values(RM_LABEL));
    for (const a of ANIMACOES_DO_PERSONAGEM) {
      expect(producidos.has(a.lbl), `${a.prop} usa «${a.lbl}», que o RM_LABEL não produz`).toBe(true);
    }
    expect(ANIMACOES_DO_PERSONAGEM.map((a) => a.prop)).toEqual(['rmWalk', 'rmBreath', 'rmFlavor']);
  });

  it('[Interface] as quatro chaves de cena também são rotuladas pelo `RM_LABEL`', () => {
    for (const k of CHAVES_DE_CENA) {
      expect(RM_LABEL[k], `a cena «${k}» não tem rótulo`).toBeTruthy();
    }
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · ⚠️ trocando o laço por `{ ...guardado }` em `lerCenaGuardada` -> reprovam DOIS: o do TRUNCADO (as tres
//     chaves em falta ficam `undefined`, e `undefined` le-se como «nao reduzido» para quem pediu reducao) e o
//     da chave A MAIS (`cintilar` entra no objecto). E a mutacao mais curta e mais legivel das duas versoes,
//     que e exactamente porque ela precisa de um caso a prende-la.
//   · trocando `!!guardado[k]` por `guardado[k]` -> reprova o do TRUNCADO: as chaves ausentes deixam de ser
//     `false` e passam a `undefined`, e o `toBe(false)` apanha a diferenca que um `if` nao apanharia.
//   · trocando a chave em `guardarCena` por outra -> reprova "escreve na chave da ENGINE". Sem esse caso, uma
//     mudanca de chave passaria verde e perderia o ajuste de toda crianca que ja jogou.
//   · tirando o `try/catch` da leitura (via `getJSON`) nao e mutavel daqui — o caso do CORROMPIDO cobre o
//     comportamento, nao a implementacao: com `JSON.parse` a rebentar sem guarda, ele reprova.
//   · tirando `'particles'` de `CHAVES_DE_CENA` -> ⚠️ NAO reprova nenhum teste: **nao compila**. O guarda
//     `_COBRE_A_UNIAO` e do COMPILADOR, e e de proposito — uma lista escrita a mao ao lado de uma uniao e a
//     forma de defeito que este ficheiro existe para desfazer, e um teste a repeti-la seria uma terceira
//     copia. Conferido: `npx tsc --noEmit` da TS2322 na linha do guarda.
//   · trocando `lbl: 'rm.walk'` por `lbl: 'rm.andar'` -> reprova "os rotulos do personagem sao os que o
//     RM_LABEL produz". As duas tabelas foram escritas em sitios diferentes, entao isto e cruzamento e nao
//     espelho: a asercao nao se move junto com a accao.
