// SPDX-License-Identifier: AGPL-3.0-or-later
// A FACE DO JOGO CONSEGUE DESENHAR AS LETRAS QUE O JOGO MOSTRA — medido no glifo, não no nome.
//
// ========================= A LIÇÃO É EMPRESTADA, E FOI CARA =========================
// ⚠️ Isto não é precaução: aconteceu, no `SP-the-inclusionist-whackwhack`. O título saiu na fonte errada
// durante QUATRO commits e todas as verificações disponíveis diziam que estava certo. O
// `press-start-2p-400.woff2` vendorizado era o subconjunto **cyrillic-ext** — um woff2 válido, corretamente
// declarado, corretamente carregado, **sem uma única letra latina**. O Google Fonts serve esta família em
// cinco ficheiros ordenados por `unicode-range` com o latino por ÚLTIMO, e a vendorização pegou no primeiro
// `src:` que encontrou.
//
// O que a página reportava, ao vivo, com os glifos errados na tela:
//
//     document.fonts.check('16px "Press Start 2P"')   →  true
//     [...document.fonts].map(f => f.status)          →  ['loaded', 'loaded']
//     getComputedStyle(el).fontFamily                 →  '"Press Start 2P", monospace'
//
// As três verdadeiras e as três inúteis, porque cada uma compara o NOME da família — uma string escrita duas
// vezes, uma no `@font-face` e outra na regra, pela mesma mão. Nenhuma olha para dentro do ficheiro. E o CSS
// resolve por CODEPOINT: uma face que carrega mas não tem glifo para `U+0057` é ignorada para aquele
// caractere em silêncio — sem erro de consola, sem pedido falhado, sem estado em `document.fonts` que se
// possa ler.
//
// ⚠️ E O GATE QUE ESTA ÁRVORE JÁ TINHA TEM O MESMO PONTO CEGO: `fontes-carregam.node.test.js` compara o nome
// da família do catálogo com o do `@font-face`. É exactamente a comparação que lá se provou não valer. Este
// ficheiro não o substitui — cobre o que ele não alcança.
//
// ========================= O QUE MEDE, EM VEZ DISSO =========================
// A LARGURA DE AVANÇO de cada caractere, que vem do glifo e portanto do FICHEIRO.
//
// A Press Start 2P é monoespaçada a exactamente 1em: a `SIZE` px, todo caractere avança `SIZE` px. Então um
// caractere que caísse para o fallback quebraria a uniformidade, e uma cadeia inteira que caísse igualaria o
// fallback. As duas coisas são afirmadas, porque falham por motivos diferentes: a primeira apanha um BURACO
// na cobertura, a segunda apanha a face ausente por completo.
//
// ⚠️ E O CONTROLO É `serif`, NÃO o `monospace` do próprio stack — esse é o truque inteiro. Contra um fallback
// monoespaçado a medição é idêntica com ou sem a face, e este teste teria passado também sobre o ficheiro
// cirílico.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import '../app/public/vendor/fonts.css';
import { FONT_BY_KEY } from '../app/js/ui/fonts.js';

/** Grande o bastante para que uma diferença de arredondamento não pareça diferença de glifo. */
const SIZE = 48;
const FAMILIA = "'Press Start 2P'";

/**
 * Os caracteres que o jogo pode desenhar nesta face: o alfabeto, os algarismos e a pontuação de um HUD.
 * ⚠️ SEM ACENTOS de propósito — a face é um subconjunto latino básico, e exigir-lhe `ã` seria acusá-la de
 * não ter o que ela nunca prometeu. O que se afere é que ela desenha o que o HUD de facto usa.
 */
const CARACTERES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/x%'];

let palco;

/** A largura de UMA cadeia, na pilha de fontes dada. Mede o nó real, que é o que o navegador desenha. */
function largura(texto, stack) {
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${SIZE}px;font-family:${stack}`;
  s.textContent = texto;
  palco.appendChild(s);
  return s.getBoundingClientRect().width;
}

beforeAll(async () => {
  // Carrega a face para os caracteres que se vão medir. Sem isto a primeira medição pode apanhar o fallback
  // por a face ainda estar a chegar — e um teste que corre uma corrida perde-a de vez em quando.
  await document.fonts.load(`${SIZE}px ${FAMILIA}`, CARACTERES.join(''));
});

afterEach(() => { palco?.remove(); palco = null; });

describe('a face de arcade desenha as letras do jogo (issue #87, lição do whackwhack)', () => {
  beforeAll(() => { /* noop: o palco nasce por caso */ });

  it('[Zero] o catálogo declara a face, com papel de JOGO e não de interface', () => {
    const it0 = FONT_BY_KEY.pressstart;
    expect(it0, 'a Press Start 2P saiu do catálogo').toBeTruthy();
    expect(it0.papel, 'a face de arcade virou fonte de interface').toBe('jogo');
    expect(it0.fam).toBe('Press Start 2P');
  });

  it('⚠️ [Right] TODO caractere avança exactamente 1em — nenhum caiu para o fallback', () => {
    // O caso que apanha um BURACO na cobertura: um único codepoint em falta é substituído em silêncio, e a
    // largura dele deixa de ser 1em enquanto todos os outros continuam a sê-lo.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const fora = CARACTERES
      .map((c) => [c, largura(c, `${FAMILIA}, serif`)])
      .filter(([, w]) => Math.abs(w - SIZE) > 0.5)
      .map(([c, w]) => `${c}: ${w.toFixed(1)}px`);
    expect(fora, 'caractere sem glifo na face (caiu para o serif):\n  ' + fora.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] a cadeia inteira NÃO mede o mesmo que o fallback — a face não está ausente', () => {
    // O caso que apanha a face ausente por completo. O controlo é `serif`, que é PROPORCIONAL: se a face
    // não carregasse, as duas medições seriam iguais. Com `monospace` como controlo, seriam iguais de
    // qualquer forma — e é por isso que o controlo não pode ser o fallback do próprio stack.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const texto = CARACTERES.join('');
    const comFace = largura(texto, `${FAMILIA}, serif`);
    const soFallback = largura(texto, 'serif');
    expect(comFace).toBeCloseTo(SIZE * CARACTERES.length, 0);
    expect(Math.abs(comFace - soFallback), 'a cadeia mediu o mesmo que o serif — a face não carregou')
      .toBeGreaterThan(1);
  });

  it('[Interface] o controlo `serif` é mesmo PROPORCIONAL — senão o caso acima não distingue nada', () => {
    // A guarda do truque. Se um dia o `serif` do ambiente for monoespaçado, o caso de cima passa a comparar
    // duas medições iguais e deixa de provar o que diz — e isto reprova antes disso passar despercebido.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const larguras = ['i', 'W', 'M', 'l'].map((c) => largura(c, 'serif'));
    expect(Math.max(...larguras) - Math.min(...larguras), 'o `serif` deste ambiente é monoespaçado')
      .toBeGreaterThan(1);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · ⚠️ APONTANDO O `@font-face` DA FAMÍLIA PARA OUTRO FICHEIRO REAL (`atkinson-400.woff2`) → reprovam os
//     DOIS casos de medição. É esta a mutação que importa, porque é o cenário do cirílico traduzido para
//     algo observável: a face CARREGA, declara-se e reporta-se como certa — e desenha os glifos errados.
//     O `[Right] TODO caractere` acusa os caracteres um a um; o `[Right] a cadeia inteira` mede 1183 px onde
//     esperava 2016.
//   · ⚠️ E apontar para um ficheiro que NÃO EXISTE não exercita este gate: o Vite resolve o `url()` do CSS
//     importado em tempo de build, então o ficheiro inteiro é PULADO em vez de reprovar. Registado porque é
//     uma boa notícia mal lida se ficar por dizer — o ficheiro ausente já é apanhado antes, pelo build; o
//     que só este gate apanha é o ficheiro PRESENTE e errado.
//   · trocando o controlo `serif` por `monospace` nos dois casos → ambos passam a passar MESMO com a face
//     ausente. Não é mutação do código, é a demonstração do porquê do controlo — e é a razão de existir o
//     caso "[Interface] o controlo é PROPORCIONAL", que reprova se alguém fizer essa troca.
//   · tirando `papel:'jogo'` do catálogo → "[Zero]" reprova: a face de arcade passaria a ser oferecível como
//     fonte de interface, que é o que o papel existe para impedir.
