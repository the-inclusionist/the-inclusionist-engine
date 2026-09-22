// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/latch-refusal — a cláusula 3 do ADR-0113, na metade PURA.
//
// «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — a frase do Dev. Este
// ficheiro afirma as duas metades que essa frase carrega e que são fáceis de implementar pela metade:
//
//   · o controle NÃO SOME — fica desabilitado, e continua na tela;
//   · o motivo é DITO, e é um FACTO sobre o aparelho e não uma repreensão.
//
// 📌 É o irmão do `tests/simulation-refusal.node.test.js`, de propósito: mesma forma, mesmo lugar na camada.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  recusaDaAlternancia, mostraMesmoExigida, CHAVE_DA_RECUSA, EXIGEM_ALTERNANCIA,
} from '../app/js/ui/latch-refusal.js';
import { ONE_COMMAND_AT_A_TIME } from '../app/js/input/latch-scope.js';
import { TRANSPORT_NAMES } from '../app/js/input/transporte-em-uso.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

describe('latch-refusal · onde há escolha, não se diz nada', () => {
  // ⚠️ `null` E NÃO UMA FRASE VAZIA: um aviso que aparece sempre deixa de ser lido, e a interface precisa de
  // distinguir «não há motivo» de «há um motivo que ainda não sei escrever».
  it('[Zero] nos três aparelhos de hoje a recusa é `null`', () => {
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(recusaDaAlternancia(t), `${t} passou a recusar uma escolha legítima`).toBe(null);
    }
  });

  it('[Right] nos quatro assistidos há recusa, com chave e transporte', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const r = recusaDaAlternancia(t);
      expect(r, `${t} deixou de recusar`).not.toBe(null);
      expect(r.transporte).toBe(t);
      expect(r.chave).toBe(CHAVE_DA_RECUSA[t]);
    }
  });
});

describe('latch-refusal · a lista vem da REGRA, e não de uma cópia', () => {
  // 🎯 O CASO QUE IMPEDE A SEGUNDA TABELA. Este repositório já pagou o defeito três vezes (o `DomQuery`, os
  // rótulos de movimento reduzido, as chaves de armazenamento): duas listas do mesmo facto divergem, e
  // divergem uma entrada de cada vez. Aqui o custo seria um aparelho que exige alternância e cujo botão
  // continua a desligá-la.
  it('🎯 [Interface] os transportes que exigem alternância são EXACTAMENTE os da regra', () => {
    expect([...EXIGEM_ALTERNANCIA].sort()).toEqual([...ONE_COMMAND_AT_A_TIME].sort());
    expect(EXIGEM_ALTERNANCIA, 'a lista foi copiada em vez de reexportada').toBe(ONE_COMMAND_AT_A_TIME);
  });

  // ⚠️ E O PAR: todo transporte que a regra exige TEM frase. Sem isto, um aparelho novo entraria na regra e o
  // botão dele ficaria desabilitado SEM motivo — pior do que o defeito que este módulo conserta, porque a
  // criança deixa de saber que existe uma razão.
  it('⚠️ [Interface] todo transporte exigente tem chave, e nenhuma chave sobra', () => {
    expect(Object.keys(CHAVE_DA_RECUSA).sort()).toEqual([...ONE_COMMAND_AT_A_TIME].sort());
  });

  it('[Vácuo] os sete transportes do catálogo estão cobertos: ou há escolha, ou há motivo', () => {
    for (const t of TRANSPORT_NAMES) {
      const r = recusaDaAlternancia(t);
      expect(r === null || typeof r.chave === 'string', `${t} caiu entre as duas respostas`).toBe(true);
    }
  });
});

describe('latch-refusal · as frases existem nos três idiomas, e dizem um FACTO', () => {
  it('[Interface] as quatro chaves estão nos três dicionários', () => {
    for (const chave of Object.values(CHAVE_DA_RECUSA)) {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        expect(dic[chave], `${chave} falta em ${nome} — o botão ficaria desabilitado sem motivo`).toBeTruthy();
      }
    }
  });

  // 🔴 O QUE A FRASE NÃO PODE SER. O ADR-0076 já pagou esta distinção uma vez, e a mutação que a apanhou
  // trocava a frase por uma mais curta, mais clara e mais útil — «Desligue o alto contraste para ver a
  // simulação» — que reprovava na mesma, porque repreende uma criança pelo ajuste de que ela precisa.
  // Aqui o equivalente seria «não desligue isto». O crivo procura o IMPERATIVO de comando dirigido a ela.
  it('🔴 [Zero] nenhuma frase manda a criança fazer nada — é facto, não repreensão', () => {
    const imperativos = /\b(não desligue|nao desligue|desligue|ligue|deixe|pare de|don't|do not|turn off|turn on|no apagues|apaga|enciende)\b/i;
    for (const chave of Object.values(CHAVE_DA_RECUSA)) {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        expect(imperativos.test(dic[chave]), `${chave} em ${nome} repreende: «${dic[chave]}»`).toBe(false);
      }
    }
  });
});

describe('latch-refusal · o controle não some', () => {
  // ⚠️ FUNÇÃO COM NOME PRÓPRIO E NÃO UM `!recusa` NO PONTO DE USO, porque responde a outra pergunta:
  // `recusaDaAlternancia` diz POR QUE não dá; esta diz que a linha CONTINUA NA TELA. Juntá-las faria «não há
  // motivo» parecer «não desenhe a linha» — que é como um controle desaparece de uma tela sem ninguém decidir.
  it('[Interface] mostrar é sempre — sumir ensinaria que a coisa não existe', () => {
    expect(mostraMesmoExigida()).toBe(true);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. `recusaDaAlternancia` a devolver `null` sempre        → o caso dos quatro assistidos reprova
// 2. tirar a guarda `latchIsOptional` de `recusaDaAlternancia` → SOBREVIVEU, e é EQUIVALÊNCIA MEDIDA
//    com mecanismo nomeado: sem ela, `CHAVE_DA_RECUSA['teclado']` é `undefined` e o `chave ? … : null` já
//    devolve `null`. Os dois caminhos concordam por construção — e é o caso «todo exigente tem chave, e
//    nenhuma chave sobra» que os obriga a concordar. ⚠️ Fica registada e a guarda FICA: ela é a regra
//    autoritativa, e a tabela é a frase. Apagá-la faria uma chave acrescentada por engano recusar um
//    aparelho onde há escolha, e nada nesta suíte veria a diferença até a tabela e a regra divergirem
// 3. `EXIGEM_ALTERNANCIA` a ser uma cópia (`new Set([...])`) → 🎯 o caso da identidade reprova, e é o que
//    impede a segunda tabela — o defeito que este repositório já pagou três vezes
// 4. tirar `alt.exigida.gestos` do `CHAVE_DA_RECUSA`       → o par «todo exigente tem chave» reprova, e o
//    caso do vácuo continua verde: a ausência degrada para «não recuso», que mantém o controle vivo em vez
//    de o desabilitar sem motivo
// 5. a frase de `pt` trocada por «Não desligue as teclas de alternância.» → 🔴 o crivo do imperativo reprova
//    📌 é a mutação que interessa: a frase fica MAIS CURTA e MAIS DIRECTA, e ainda assim repreende
