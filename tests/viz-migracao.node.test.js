// SPDX-License-Identifier: AGPL-3.0-or-later
// A REDE DA #104: o que cada um dos 16 modos FAZ hoje tem de continuar a fazer depois da divisão em dois eixos.
//
// ========================= POR QUE ISTO EXISTE ANTES DE QUALQUER MUDANÇA =========================
// A issue #104 chama a migração de «the dangerous half», e o ADR-0076 diz porquê: o ajuste salvo guarda o
// valor único antigo, e sem a tradução o modo visual que CADA CRIANÇA JÁ ESCOLHEU é descartado. Quem escolheu
// `fix-deuter` escolheu-o porque enxerga assim.
//
// ⚠️ E ESTE FICHEIRO NÃO DESCREVE O QUE EU ACHO QUE O CÓDIGO FAZ — ele deriva o comportamento de hoje das
// TABELAS REAIS (`VIZ_FILTER`, `needsCanvas`, `VIZ_BY_KEY.kind`, `simulatesDisability`) e exige que o modelo
// novo produza o mesmo. Uma rede escrita a partir da minha leitura protegeria a minha leitura, e não a
// criança. É a diferença entre um teste de caracterização e uma paráfrase.
//
// ========================= O QUE «O MESMO» QUER DIZER, MECANISMO A MECANISMO =========================
// Medido em `render/viewports.ts`, que é quem aplica:
//   · `playerVizTex(base, mode)` só faz alguma coisa quando existe `DIRECT_CFG[mode]` — os três `hc-direto*`,
//     que são exatamente os `needsCanvas`. Para todo o resto devolve a textura como veio.
//   · `pixiFilterFor(mode)` só produz filtro para as seis chaves de daltonismo, `blind` e os cinco `lv-*` —
//     que são exatamente as chaves de `VIZ_FILTER`.
// Logo o par (direto, filtro) do modelo novo é comparável, chave a chave, com o par que a tabela antiga
// produzia. É isso que os casos abaixo afirmam.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  VIZ_CYCLE, VIZ_FILTER, VIZ_BY_KEY, needsCanvas, simulatesDisability,
} from '../app/js/render/viz-modes.js';
import {
  migrarVisual, aplicacao, chaveDeTextura, ehSimulacao, ehCego, ehBaixaVisao, temAltoContraste,
  nosPadroes, PADRAO, CHAVES_ANTIGAS,
} from '../app/js/render/viz-axes.js';

/** O que a tabela ANTIGA fazia com esta chave, derivado dela e não escrito à mão. */
const comportamentoAntigo = (k) => ({
  direto: needsCanvas(k) ? k : null,
  filtro: k in VIZ_FILTER ? k : null,
});

describe('#104 · a migração preserva o que cada modo FAZ', () => {
  it('⚠️ [Interface] os 16 modos de hoje estão TODOS cobertos pela migração', () => {
    // Se um modo ficasse de fora, a criança que o escolheu cairia no padrão sem que nada avisasse — e o
    // padrão é precisamente a tela que ela não consegue usar.
    const semCobertura = VIZ_CYCLE.filter((k) => !CHAVES_ANTIGAS.includes(k));
    expect(semCobertura, 'modo antigo sem tradução: a escolha desta criança seria descartada').toEqual([]);
    expect(CHAVES_ANTIGAS.length).toBe(VIZ_CYCLE.length);
  });

  it('⚠️ [Right] cada modo produz o MESMO par (direto, filtro) que produzia', () => {
    for (const k of VIZ_CYCLE) {
      expect(aplicacao(migrarVisual(k)), `o modo «${k}» mudou de comportamento na migração`)
        .toEqual(comportamentoAntigo(k));
    }
  });

  it('⚠️ [Right] e o que o sprite usa de textura não muda', () => {
    // `playerVizTex` só age quando o modo tem `DIRECT_CFG`, isto é, quando `needsCanvas`. A chave nova pode
    // ser outra palavra desde que caia do mesmo lado dessa pergunta.
    for (const k of VIZ_CYCLE) {
      expect(needsCanvas(chaveDeTextura(migrarVisual(k))), `a textura do modo «${k}» trocou de caminho`)
        .toBe(needsCanvas(k));
    }
  });

  it('⚠️ [Right] «isto simula uma deficiência?» responde igual aos 16 — é o que o reset da empatia usa', () => {
    // O botão «restaurar padrões» do menu de empatia desliga as SIMULAÇÕES. Se a classificação escorregasse,
    // ele passaria a desligar uma CORREÇÃO — tirar de uma criança daltônica a única correção que ela tem, a
    // partir do menu que existe para quem não tem a deficiência.
    for (const k of VIZ_CYCLE) {
      expect(ehSimulacao(migrarVisual(k)), `«${k}» trocou de lado entre simular e corrigir`)
        .toBe(simulatesDisability(k));
    }
  });

  it('[Right] cegueira e baixa visão continuam a ser reconhecidas pelo `kind` que já as reconhecia', () => {
    for (const k of VIZ_CYCLE) {
      const v = migrarVisual(k);
      expect(ehCego(v), k).toBe(VIZ_BY_KEY[k].kind === 'blind');
      expect(ehBaixaVisao(v), k).toBe(VIZ_BY_KEY[k].kind === 'lowvision');
      expect(temAltoContraste(v), k).toBe(needsCanvas(k));
    }
  });

  it('⚠️ [Boundary] os 13 modos que NÃO são alto contraste deixam os dois eixos no padrão', () => {
    // É o que libera a simulação (ADR-0076): uma demonstração por cima de uma adaptação ensina uma coisa
    // falsa. Depois da migração, todo modo antigo que não era tema tem de continuar a permitir simular.
    for (const k of VIZ_CYCLE) {
      const v = migrarVisual(k);
      const eraTema = needsCanvas(k);
      const eraCorrecao = k.startsWith('fix-');
      expect(nosPadroes(v), `«${k}» passou a bloquear a simulação`).toBe(!eraTema && !eraCorrecao);
    }
  });

  it('[Zero] lixo, ausência e uma chave de outra versão caem no padrão em vez de estourar', () => {
    // O dado vem do navegador de uma criança: pode ser de outra máquina, de uma versão futura, ou corrompido.
    for (const mau of [undefined, null, '', 'modo-de-2030', 42, [], { tema: 'roxo' }]) {
      expect(migrarVisual(mau), String(mau)).toEqual(PADRAO);
    }
  });

  it('⚠️ [Interface] a migração é IDEMPOTENTE — ela corre mais de uma vez por sessão', () => {
    // A leitura acontece por jogador, e o valor já migrado volta a passar por aqui. Se a segunda passagem
    // mudasse alguma coisa, o ajuste da criança derivaria sozinho entre duas leituras.
    for (const k of VIZ_CYCLE) {
      const uma = migrarVisual(k);
      expect(migrarVisual(uma), `«${k}» não sobreviveu à segunda migração`).toEqual(uma);
      expect(migrarVisual(JSON.parse(JSON.stringify(uma))), `«${k}» não sobreviveu a ida e volta por JSON`).toEqual(uma);
    }
  });
});

describe('#104 · e o que a divisão TORNA POSSÍVEL, que é o ponto da issue', () => {
  it('⚠️ [Right] `hc7` E `fix-deuter` ao mesmo tempo, com os DOIS aplicados', () => {
    // A caixa nº 1 da definition of done, e a razão de a issue existir: uma criança com daltonismo que TAMBÉM
    // precise de alto contraste não podia ter os dois. Nenhuma chave antiga consegue exprimir este estado —
    // é por isso que o caso o constrói à mão.
    const os_dois = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(aplicacao(os_dois)).toEqual({ direto: 'hc-direto-7', filtro: 'fix-deuter' });
    expect(nosPadroes(os_dois), 'com um eixo fora do padrão a simulação tem de ficar travada').toBe(false);
  });

  it('[Right] mexer num eixo não mexe no outro — uma asserção em cada sentido', () => {
    const base = { tema: 'hc45', correcao: 'protan', simulacao: null };
    expect(aplicacao({ ...base, tema: 'padrao' }).filtro, 'tirar o tema apagou a correção').toBe('fix-protan');
    expect(aplicacao({ ...base, correcao: 'tricro' }).direto, 'tirar a correção apagou o tema').toBe('hc-direto-45');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// ⚠️ Uma rede de caracterizacao NASCE VERDE por definicao — ela descreve o que ja acontece. Entao a prova de
// que ela serve nao e' o verde: e' que cada estrago plausivel na migracao a poe vermelha. Sete, todas
// aplicadas por script ao `render/viz-axes.ts`, com contagem de ocorrencias:
//   · ⚠️ APAGANDO `fix-deuter` da tabela -> reprovam TRES. E o estrago que a issue chama de «the dangerous
//     half»: a crianca que escolheu aquela correcao volta ao padrao, em silencio, e o padrao e' exatamente a
//     tela que ela nao consegue usar.
//   · trocando `hc-direto-7` para o tema `hc45` — um engano de UM degrau, do tipo que passa numa leitura
//     rapida -> reprova o par. A crianca que pediu 7:1 receberia 4.5:1 e nada diria.
//   · fazendo `fix-protan` migrar para a SIMULACAO `sim-protan` -> reprovam TRES, e o do meio e' o que
//     interessa: o «restaurar padroes» do menu de empatia desliga simulacoes, entao esta troca fa-lo-ia
//     desligar a correcao de uma crianca daltonica — a partir do menu que existe para quem NAO e' daltonico.
//   · tirando o ramo de objeto do `migrarVisual` (fica nao-idempotente) -> reprova a idempotencia. A leitura
//     acontece por jogador e mais de uma vez por sessao; o ajuste derivaria sozinho entre duas leituras.
//   · `filtroChave` a devolver sempre `null` -> reprovam TRES, incluindo os dois casos do que a divisao TORNA
//     POSSIVEL. O eixo da correcao ficaria mudo.
//   · `temaDireto` a devolver `null` para todo tema -> reprovam DOIS: o par e a textura do sprite.
//   · `migrarVisual` a ESTOURAR em chave desconhecida -> reprova o caso do lixo. O dado vem do navegador de
//     uma crianca e pode ser de outra maquina ou de uma versao futura; um `throw` ali tira o jogo do ar por
//     causa de uma preferencia.
