// SPDX-License-Identifier: AGPL-3.0-or-later
// AS DUAS CÓPIAS DO VALIDADOR NÃO DIVERGEM — a contramedida da deriva que o ADR-0123 comprou.
//
// ========================= POR QUE ISTO EXISTE, E O QUE ELE CUSTA SE NÃO EXISTIR =========================
// 🔴 A regra do Dev é «cada repositório precisa ter seus validadores e gates para ADRs», e ela ganha de uma
// objecção minha por uma razão que ficou escrita no ADR-0123 §4: um gate que mora noutro sítio é um gate que
// não corre aqui. O preço é o que o ADR-0068 §4 recusou para o `game-ci.yml` — DUAS cópias de uma ferramenta,
// e duas cópias divergem.
//
// 📏 E NÃO É HIPÓTESE: divergiu no dia um. O `--repo` nasceu do lado dos registos, a cópia deste repositório
// ainda só tinha `--root`, e a primeira corrida cruzada devolveu NOVE reprovações falsas. Quem as viu fui eu,
// a olhar para a saída; a próxima vez pode não ter ninguém a olhar.
//
// ⚠️ E O DEFEITO NÃO É A CÓPIA DESACTUALIZADA — é o VEREDICTO. Com duas versões, a mesma árvore fica verde
// num repositório e vermelha noutro, e nada diz qual dos dois está certo. Um gate que discorda de si próprio
// é pior do que um gate a menos: ele produz confiança onde não há.
//
// 📌 A árvore chega como no `ponteiros-de-registo`: por `ADR_TREE` (o que a CI passa) ou por clone irmão. Sem
// nenhuma delas, os casos SALTAM — e o caso do `ADR_TREE_REQUIRED`, naquele ficheiro, é o que recusa o salto
// no trabalho que se declara responsável pela árvore.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATAS = [
  process.env.ADR_TREE,
  fileURLToPath(new URL('../../the-inclusionist-docs/docs/2-Architecture/adr/', import.meta.url)),
].filter(Boolean);
const ADR = CANDIDATAS.find((p) => existsSync(p)) ?? CANDIDATAS[CANDIDATAS.length - 1];
const TEM_ARVORE = existsSync(ADR);
const RAIZ_DOS_REGISTOS = TEM_ARVORE ? resolve(ADR, '..', '..', '..') : '';

const AQUI = fileURLToPath(new URL('../scripts/validate-adr.py', import.meta.url));
const LA = TEM_ARVORE ? join(RAIZ_DOS_REGISTOS, 'scripts', 'validate-adr.py') : '';

/**
 * ⚠️ FINAIS DE LINHA NORMALIZADOS, e não é indulgência: os dois repositórios são clonados em máquinas com
 * configurações de `core.autocrlf` diferentes, e um `\r` a mais não é deriva de comportamento. O que este
 * ficheiro guarda é o CÓDIGO que decide o veredicto.
 */
const corpo = (caminho) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

describe.skipIf(!TEM_ARVORE)('o validador deste repositório e o dos registos', () => {
  it('📌 [Vácuo] os dois ficheiros existem e têm código — senão isto compara dois vazios', () => {
    // Sem este caso, apagar um dos dois deixaria o [Interface] a comparar `''` com `''` e a passar. É a
    // metade da SAÍDA: um crivo que não lê nada está verde pela pior razão.
    expect(existsSync(AQUI), `o validador deste repositório sumiu (${AQUI})`).toBe(true);
    expect(existsSync(LA), `o validador dos registos não está em ${LA}`).toBe(true);
    expect(corpo(AQUI).length, 'o validador daqui está vazio').toBeGreaterThan(2000);
    expect(corpo(LA).length, 'o validador dos registos está vazio').toBeGreaterThan(2000);
    // 🔴 E OS DOIS CAMINHOS TÊM DE SER FICHEIROS DIFERENTES — a asserção que faltava, e a CI provou-o.
    //
    // A raiz dos registos era calculada com `new URL('../../../', …)`, que depende da BARRA FINAL: o clone
    // irmão trazia-a, o `ADR_TREE` da CI não. Lá, a raiz resolvia um nível acima e o `LA` apontava para o
    // validador DESTE repositório — o caso comparava o ficheiro consigo próprio e passava. Um gate cego, e
    // cego exactamente onde só a CI o exercita.
    //
    // ⚠️ O vácuo antigo não o apanhava porque os dois ficheiros EXISTIAM: era o mesmo, duas vezes. «Existe»
    // não é a pergunta toda quando dois caminhos podem colapsar num só.
    expect(resolve(AQUI), `os dois caminhos resolvem para o MESMO ficheiro (${AQUI}) — a comparação seria consigo própria`)
      .not.toBe(resolve(LA));
  });

  it('🎯 [Interface] as duas cópias são a MESMA — duas versões dão dois veredictos sobre a mesma árvore', () => {
    expect(
      corpo(AQUI) === corpo(LA),
      'as duas cópias do `validate-adr.py` divergiram. A mesma árvore vai ficar verde num repositório e '
      + 'vermelha no outro, e nada dirá qual está certo. Copie a do `the-inclusionist-docs` para aqui — ela '
      + 'é a que vive com os registos —, ou, se a diferença for deliberada, este caso é o sítio para a '
      + 'declarar com o motivo.',
    ).toBe(true);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. acrescentar uma linha a `scripts/validate-adr.py` (a deriva de verdade) → o [Interface] reprova, com a
//    frase que diz o que fazer. É a mutação que descreve o defeito que já aconteceu uma vez.
// 2. comparar por TAMANHO em vez de por conteúdo → duas versões do mesmo tamanho passariam; a mutação
//    sobrevive ao caso feliz e é apanhada pela 1, que muda o tamanho — por isso a comparação é do corpo.
// 3. tirar o `[Vácuo]` e apagar uma das cópias → o [Interface] passaria a comparar dois vazios e ficaria
//    VERDE. É a razão de o vácuo vir primeiro e não ser decoração.
