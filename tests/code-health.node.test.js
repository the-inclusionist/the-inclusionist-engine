// SPDX-License-Identifier: AGPL-3.0-or-later
// A SAÚDE DO CÓDIGO SÓ MELHORA — a catraca das SEIS medidas (ADR-0221, issue #203).
//
// ========================= POR QUE ISTO EXISTE, E É RESPOSTA A UMA PERGUNTA DO DEV =========================
// Em 22/09 o Dev releu o artigo que orientou a modularização desta engine (arXiv:2409.15152) e disse que os problemas curados
// por ele tinham voltado. Tinham, e a causa é mecânica e não falta de zelo: esta engine tem portão para o idioma, para a
// DIREÇÃO das dependências (ADR-0173), para a superfície pública, para os exports sem consumidor e para os ponteiros dos
// registos — e NENHUM para tamanho, complexidade ou acoplamento. O crivo de camadas pergunta para que lado um import aponta,
// nunca quantos são: um módulo pode importar 77 coisas para baixo e passar verde.
//
// 📏 E um passou: `boot/create-game.ts` chegou a 2185 linhas — 11% de todo o código da engine num ficheiro — com 330 nós de
// decisão e fan-out 77, com tudo verde. O que nada mede, volta.
//
// ⚠️ E ISTO NÃO É UMA NOTA, que é a decisão e não uma limitação. O próprio artigo mediu os seus peritos: a manutenibilidade tem
// ICC 0,52 entre dez pessoas com dez anos de experiência cada, e r = 0,30 contra o modelo deles. Um número apresentado como
// qualidade seria obedecido mais do que merece. Este ficheiro faz UMA pergunta — «piorou alguma coisa?» — e a resposta é sim ou
// não.
//
// ⚠️ E A COESÃO NÃO ESTÁ AQUI, de propósito: LCOM e família supõem classes com campos, e esta árvore é de módulos de funções.
// O que fica no lugar dela é a tabela de co-change do `docs/ARCHITECTURE.md` §3.3.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect } from 'vitest';
import { measureTree, readBaseline, isExempt, ceilingFrom, MEASURES, BASELINE } from '../scripts/code-health.mjs';

const arvore = measureTree();
const base = readBaseline();

describe('a saúde do código só melhora', () => {
  it('🔴 [Right] nenhum módulo piorou em nenhuma das seis medidas', () => {
    const piores = [];
    for (const [mod, agora] of Object.entries(arvore)) {
      const antes = base.modules[mod];
      if (!antes) continue; // módulo novo é o caso seguinte, e tem outra régua
      /*
       * 🔴 O FAN-OUT PODE SUBIR UM QUANDO O TAMANHO E OS RAMOS DESCEM, e esta excepção nasceu de o portão ter recusado
       * exactamente o trabalho que ele existe para causar. 📏 Medido em 22/09 ao tirar o modo calmo do `ui/pause-icons`:
       * 695 → 682 linhas e 127 → 124 ramos, e fan-out 19 → 20, porque o módulo passou a importar aquilo que saiu. TODA
       * extração honesta custa +1 ao módulo de onde o assunto sai — sem esta cláusula, a única forma de pagar dívida seria
       * reescrever a linha de base a cada corte, e uma catraca que se desaperta por rotina deixa de ser uma.
       *
       * 🔴 E A CLÁUSULA JÁ FOI ESTREITA DEMAIS UMA VEZ, no mesmo dia: ela exigia que os RAMOS também descessem, e tirar DADO de
       * um módulo não mexe em ramo nenhum — uma lista não tem `if`. 📏 Medido ao tirar o catálogo de ícones do `ui/pause-icons`:
       * 666 → 645 linhas, 122 → 122 ramos, fan-out 19 → 20, e o portão recusou. Exigir que os ramos desçam é proibir
       * exactamente a extração mais barata e mais limpa que existe. Passou a ser «as linhas DESCEM e os ramos NÃO SOBEM».
       *
       * ⚠️ E ela continua ESTREITA: UM import, e só a um módulo que deu alguma coisa em troca. Quem ganha imports sem dar nada
       * continua a reprovar, que é o caso que a medida existe para apanhar (mutações 8 e 9). 📌 A raiz do fundo disto já estava
       * medida: o fan-out conta QUANTOS módulos, nunca quanto de cada um — a raiz passou de oito nomes do `ui/layout` para três
       * e o número dela subiu.
       */
      const trocou = agora.codeLines < antes.codeLines && agora.decisionNodes <= antes.decisionNodes;
      for (const m of MEASURES) {
        if (isExempt(mod, m)) continue;
        if (m === 'fanOut' && trocou && agora[m] === antes[m] + 1) continue;
        if (agora[m] > antes[m]) piores.push(`${mod} ${m}: ${antes[m]} → ${agora[m]}`);
      }
    }
    expect(piores, 'um módulo piorou. Se o crescimento é o trabalho — uma funcionalidade nova num módulo que já a tinha —, '
      + `pague a dívida no mesmo commit ou corra \`node scripts/code-health.mjs --write\` e DIGA porquê na mensagem. Reescrever `
      + `${BASELINE} para tornar verde um build vermelho é desapertar a catraca.`).toEqual([]);
  });

  it('🔴 [Right] um módulo NOVO nasce abaixo do tecto', () => {
    /*
     * ⚠️ O TECTO É O p90 DESTA ÁRVORE, não um número da literatura — o artigo não prescreve nenhum, e emprestar um vesti-lo-ia
     * de uma autoridade que ele não deu. 📏 Medido em 22/09: 187 linhas, 37 nós de decisão, profundidade 4, fan-out 6.
     * 📌 E é por isso que ele mora no ficheiro da linha de base COM A DATA em que foi tirado: é facto sobre este repositório, e
     * muda quando alguém volta a medir e o diz.
     */
    const acima = [];
    for (const [mod, agora] of Object.entries(arvore)) {
      if (base.modules[mod]) continue;
      for (const m of MEASURES) {
        if (isExempt(mod, m)) continue;
        if (agora[m] > base.ceiling[m]) acima.push(`${mod} ${m}: ${agora[m]} > ${base.ceiling[m]}`);
      }
    }
    expect(acima, 'um módulo NOVO nasceu acima do tecto do p90 desta árvore. Um módulo que nasce grande nunca encolhe: '
      + 'parta-o agora, que é quando é barato').toEqual([]);
  });

  it('⚠️ [Zero] a linha de base não guarda módulo que já não existe', () => {
    // Uma entrada que casa zero parece cobertura e não é: ela deixa de exigir o que exigia, em silêncio. É o mesmo defeito
    // que a fase 3 achou em três livros-razão chaveados por nome de ficheiro.
    const fantasmas = Object.keys(base.modules).filter((m) => !arvore[m]);
    expect(fantasmas, `${BASELINE} descreve módulos que saíram — corra \`node scripts/code-health.mjs --write\``).toEqual([]);
  });

  it('🔴 [Right] a raiz é isenta no que é FIAÇÃO e não no que é dívida', () => {
    /*
     * 🔴 ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e a mutação era «tirar a isenção do 1.º caso»: com a árvore parada,
     * nada piora, logo a isenção nunca é exercida e apagá-la fica verde. A afirmação que ela carrega é ESTA, e é uma decisão
     * do ADR-0221 que merece ser dita por um caso: a raiz de composição é isenta de FAN-OUT, porque ligar tudo é o trabalho
     * dela (ADR-0173) — e NÃO é isenta de linhas, ramos nem profundidade, que é exactamente onde está a dívida dela
     * (📏 2185 linhas e 330 nós de decisão em 22/09).
     */
    expect(isExempt('boot/create-game.ts', 'fanOut'), 'a raiz perdeu a isenção do fan-out, que é o trabalho dela').toBe(true);
    for (const m of ['codeLines', 'decisionNodes', 'maxDepth']) {
      expect(isExempt('boot/create-game.ts', m), `a raiz ficou isenta de ${m}, que é a dívida dela e não o trabalho`).toBe(false);
    }
    // E os dicionários são isentos de tudo, porque são DADO: 621 linhas de frases não são complexidade.
    for (const m of MEASURES) expect(isExempt('i18n/pt.ts', m), 'um dicionário deixou de ser dado').toBe(true);
  });

  /*
   * 🔴 A SEXTA MEDIDA TEM LIMIAR DE FORA, e é a única. O Dev leu a proposta de um tecto de LINHAS para a raiz e recusou-a pela
   * razão certa: «isso é arbitrário, precisamos de uma referência melhor». 📏 A literatura não tem nenhuma para tamanho de
   * ficheiro — o que ela tem é a complexidade ciclomática de McCabe (1976), com limiar 10 por FUNÇÃO, codificada no NIST SP
   * 500-235 (Watson & McCabe, 1996), que admite 15 com justificação escrita.
   *
   * 🎯 E é por isso que este caso existe: um p90 desta árvore seria tirar o limiar do próprio defeito, e a primeira pressa
   * mudaria o 10 para «o que já temos». O número está preso a uma fonte, não a um percentil.
   *
   * ⚠️ E A RAIZ NÃO É ISENTA DELE, que é a outra metade da decisão: a literatura de injecção de dependência descreve uma
   * raiz de composição como um lugar que se espera GRANDE e que contém apenas FIAÇÃO — e fiação não decide. 📏 O `createGame`
   * tem 68 ramos numa função só, e é isso que a medida vê e o tecto de linhas nunca viu.
   */
  it('🔴 [Right] o tecto da pior função é 10, vem de FORA da árvore, e a raiz não é isenta dele', () => {
    /*
     * 🔴 A REGRA E NÃO SÓ O NÚMERO GRAVADO, e a diferença foi medida: a primeira versão deste caso lia apenas
     * `base.ceiling`, que vem do FICHEIRO — e a mutação «o tecto passa a ser o p90 da árvore» ficou VERDE, porque mudar o
     * script não mexe no JSON até alguém correr `--write`. Um caso que só lê o registo não vê a regra mudar.
     */
    expect(ceilingFrom(arvore).worstFunction, 'a REGRA do tecto mudou: ele deixou de ser o 10 de McCabe').toBe(10);
    expect(base.ceiling.worstFunction, 'o tecto GRAVADO deixou de ser 10 — se é decisão, ela precisa de fonte').toBe(10);
    expect(isExempt('boot/create-game.ts', 'worstFunction'), 'a raiz ficou isenta da medida que mede a LÓGICA dela').toBe(false);
    expect(arvore['boot/create-game.ts'].worstFunction, 'a raiz deixou de ser medida por função').toBeGreaterThan(0);
  });

  it('📌 [Interface] toda isenção nomeia um módulo que existe, e o tecto cobre as quatro medidas', () => {
    // Uma isenção órfã é a forma mais silenciosa de a lista crescer: ninguém a lê, e ela autoriza o que já não existe.
    const isencoesOrfas = Object.keys(base.exempt).filter((m) => !arvore[m]);
    expect(isencoesOrfas, 'uma isenção aponta para um módulo que saiu').toEqual([]);
    expect(Object.keys(base.ceiling).sort(), 'o tecto não cobre as quatro medidas').toEqual([...MEASURES].sort());
    expect(Object.keys(arvore).length, 'a árvore não foi medida — o crivo não está a medir nada').toBeGreaterThan(100);
  });
});

/*
 * ========================= MUTAÇÕES CONFERIDAS (2026-09-22) =========================
 * 1. acrescentar um `if` a um módulo já na linha de base ......................................... VERMELHO no 1.º caso
 * 2. criar um módulo novo com 300 linhas e 60 ramos .............................................. VERMELHO no 2.º
 * 3. apagar um módulo sem reescrever a linha de base ............................................. VERMELHO no 3.º
 * 4. pôr uma isenção para um módulo que não existe ............................................... VERMELHO no 4.º
 * 5. a raiz passa a ser isenta de TUDO, e não só da fiação ...................................... VERMELHO no caso da isenção
 * 6. um módulo NOVO que alcança o `document` (passo 7d) .......................................... VERMELHO no 2.º
 *    — o tecto do alcance é ZERO, e não um p90: um módulo novo que toca num global desfaz uma decisão (ADR-0178), não fica
 *      acima de uma média.
 * 7. um módulo já na linha de base ganha um alcance a `window` .................................. VERMELHO no 1.º
 *    — os 24 que já alcançam ficam congelados e só podem encolher: dívida não vira licença.
 * 8. um módulo ganha DOIS imports e CRESCE em linhas ............................................ VERMELHO no 1.º
 *    — prova que a cláusula do fan-out é estreita: ela perdoa UM, e só a quem deu alguma coisa em troca. Ganhar imports sem
 *      dar nada continua a reprovar, que é o caso que a medida existe para apanhar.
 *
 * ========================= e as duas da cláusula ALARGADA (mesmo dia, depois do corte do catálogo) =========================
 * 9.  um módulo dá linhas e ganha DOIS imports .................................................. VERMELHO no 1.º
 *     — o alargamento não abriu a porta ao número: continua a ser UM (fan-out 19 → 21 com as linhas a descer).
 * 10. um módulo dá linhas, ganha UM import e GANHA UM RAMO ...................................... VERMELHO no 1.º
 *     — por duas vias, e a segunda é o ponto: os ramos a subir são erro por si mesmos E derrubam a tolerância do fan-out.
 *     📌 O controlo correu verde antes das duas, que é o que as torna leitura e não decoração.
 *
 * ========================= e as três da SEXTA medida (McCabe por função, 22/09) =========================
 * 11. um módulo da linha de base ganha uma função de 13 ramos ................................... VERMELHO no 1.º
 * 12. um módulo NOVO nasce com uma função de 13 ramos ........................................... VERMELHO no 2.º
 * 13. o tecto da pior função passa a ser o p90 da própria árvore ................................ VERMELHO no caso do tecto
 *     🔴 E ESTA SOBREVIVEU NA PRIMEIRA VOLTA, o que mudou o caso: ele lia só `base.ceiling`, que vem do FICHEIRO, e mudar a
 *     regra no script não mexe no JSON até alguém correr `--write`. Um caso que lê o registo não vê a regra mudar. Agora ele
 *     chama o `ceilingFrom` e confere os dois — a regra e o que ficou gravado.
 */
