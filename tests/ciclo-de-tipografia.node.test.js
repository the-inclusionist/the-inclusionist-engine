// SPDX-License-Identifier: AGPL-3.0-or-later
// O CICLO DE TIPOGRAFIA DO 11.º BOTÃO, e a mão do país desta criança (ADR-0149 §1, ADR-0150 §1-§2).
//
// ========================= O QUE ESTE FICHEIRO DECIDE =========================
// 🎯 CADA PASSO MUDA A CAIXA **E** A FACE. Hoje `letterCase` (`core/state`, ADR-0028) e a face são dois
// controles em dois sítios, e «Andika em caixa alta» é UMA escolha pedagógica de quem alfabetiza. Uma criança
// não devia ter de saber o modelo para a fazer.
//
// 🔴 E A ÚLTIMA POSIÇÃO É A MÃO DO PAÍS DELA, com o recuo do COLONIZADOR quando o país não tem a sua. A regra
// é do Dev e é mais verdadeira do que a que substituiu: «o que os Estados Unidos ensinam» era um padrão
// vestido de país; a mão de Portugal para Angola é uma afirmação verdadeira sobre como a escola a ensinou.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { cicloDeTipografia, maosDaEtiqueta, INICIO_DO_CICLO } from '../app/js/ui/fonts.js';

describe('maosDaEtiqueta — a mão do país, e o recuo do colonizador', () => {
  it('🎯 [Right] a REGIÃO decide primeiro', () => {
    expect(maosDaEtiqueta('pt-BR')).toEqual(['pwbr']);
    expect(maosDaEtiqueta('es-MX')).toEqual(['pwmx']);
    expect(maosDaEtiqueta('es-PE')).toEqual(['pwpe']);
    expect(maosDaEtiqueta('es-CU')).toEqual(['pwcu']);
  });

  it('🔴 [Right] onde o país ensina DUAS mãos, devolve as duas — na ordem do Dev', () => {
    // A tradicional primeiro. Escolher uma seria escolher pela criança, que é o argumento do ADR-0108 §2.
    expect(maosDaEtiqueta('en-US')).toEqual(['pwustrad', 'pwusmod']);
    expect(maosDaEtiqueta('en-GB')).toEqual(['pwgbj', 'pwgbs']);
    expect(maosDaEtiqueta('es-ES')).toEqual(['pwes', 'pwesdeco']);
  });

  it('🔴 [Boundary] SEM REGIÃO cai no recuo por LÍNGUA — o caso que mais se esquece', () => {
    // ⚠️ Uma etiqueta sem região não é um erro: é uma criança cujo navegador não disse onde ela está.
    expect(maosDaEtiqueta('pt')).toEqual(['pwpt']);
    expect(maosDaEtiqueta('es')).toEqual(['pwes', 'pwesdeco']);
    expect(maosDaEtiqueta('en')).toEqual(['pwgbj', 'pwgbs']);
  });

  it('🔴 [Right] um país SEM mão própria recebe a do COLONIZADOR, e não a dos EUA', () => {
    // É a correcção que o Dev fez ao ADR-0149 §5, e é o coração do ADR-0150. Angola e Moçambique recebem
    // Portugal; Bolívia e Paraguai recebem Espanha; Irlanda e Nigéria recebem Inglaterra.
    expect(maosDaEtiqueta('pt-AO')).toEqual(['pwpt']);
    expect(maosDaEtiqueta('pt-MZ')).toEqual(['pwpt']);
    expect(maosDaEtiqueta('es-BO')).toEqual(['pwes', 'pwesdeco']);
    expect(maosDaEtiqueta('en-IE')).toEqual(['pwgbj', 'pwgbs']);
    expect(maosDaEtiqueta('en-NG')).toEqual(['pwgbj', 'pwgbs']);
    // 📌 O PAR que prova que o recuo MUDOU: nenhum deles cai nos Estados Unidos.
    for (const tag of ['pt-AO', 'es-BO', 'en-IE']) {
      expect(maosDaEtiqueta(tag), `${tag} caiu na mão dos EUA`).not.toContain('pwusmod');
    }
  });

  it('[Zero] língua fora do repertório, ou etiqueta vazia, devolve VAZIO', () => {
    // O repertório está limitado a inglês, português e espanhol (ADR-0012). Vazio é dizível: quem chama tira
    // a posição do ciclo em vez de mostrar uma mão que não é de ninguém.
    expect(maosDaEtiqueta('fr-FR')).toEqual([]);
    expect(maosDaEtiqueta('de')).toEqual([]);
    expect(maosDaEtiqueta('')).toEqual([]);
    expect(maosDaEtiqueta(null)).toEqual([]);
  });

  it('📌 [Boundary] a região é lida sem depender de MAIÚSCULAS nem da posição', () => {
    // `pt-br`, `pt-BR`, `pt-Latn-BR` — as três nomeiam o mesmo país, e o navegador entrega qualquer uma.
    expect(maosDaEtiqueta('pt-br')).toEqual(['pwbr']);
    expect(maosDaEtiqueta('pt-Latn-BR')).toEqual(['pwbr']);
  });
});

describe('cicloDeTipografia — as cinco posições, ou seis', () => {
  it('🎯 [Right] as quatro primeiras são fixas, e a CAIXA anda com a FACE', () => {
    const c = cicloDeTipografia('pt-BR');
    expect(c.slice(0, 4)).toEqual([
      { caixa: 'upper', fonte: 'andika' },
      { caixa: 'mixed', fonte: 'andika' },
      { caixa: 'mixed', fonte: 'atkinson' },
      { caixa: 'mixed', fonte: 'lexend' },
    ]);
  });

  it('🔴 [Right] o ciclo COMEÇA na Atkinson, que é a posição (c) e o padrão do projeto', () => {
    expect(cicloDeTipografia('pt-BR')[INICIO_DO_CICLO]).toEqual({ caixa: 'mixed', fonte: 'atkinson' });
  });

  it('🔴 [Boundary] SEIS posições onde o país ensina duas mãos, CINCO onde ensina uma', () => {
    expect(cicloDeTipografia('pt-BR')).toHaveLength(5);
    expect(cicloDeTipografia('en-US')).toHaveLength(6);
    expect(cicloDeTipografia('en-US')[5]).toEqual({ caixa: 'mixed', fonte: 'pwusmod' });
  });

  it('🔴 [Zero] sem mão nenhuma o ciclo tem QUATRO — e isso é a resposta certa', () => {
    // ⚠️ Melhor uma posição a menos do que uma que mostre a mão de um país que não é o daquela criança.
    const c = cicloDeTipografia('fr-FR');
    expect(c).toHaveLength(4);
    expect(c.some((p) => p.fonte.startsWith('pw')), 'entrou uma mão de país sem país').toBe(false);
  });

  it('📌 [Right] a POSIÇÃO (a) é a única em caixa alta — é o par da alfabetização', () => {
    // Sem isto, um ciclo que pusesse tudo em `mixed` passaria os casos de face acima.
    const c = cicloDeTipografia('pt-BR');
    expect(c.filter((p) => p.caixa === 'upper')).toEqual([{ caixa: 'upper', fonte: 'andika' }]);
  });
});

// ============================== MUTAÇÕES CONFERIDAS ==============================
// Sete, sete vermelhas — aplicadas por script com a contagem de ocorrências conferida ANTES de cada uma:
//
//   J1 a REGIÃO deixa de ser lida antes da língua        🔴 pt-BR cairia no recuo
//   J2 o recuo do inglês volta a ser os EUA              🔴 é a correcção inteira do ADR-0150
//   J3 só a PRIMEIRA mão do país entra no ciclo          🔴 os EUA perderiam a segunda
//   J4 o ciclo começa na posição (a) e não na (c)        🔴 abriria em caixa alta
//   J5 a posição (a) deixa de ser CAIXA ALTA             🔴 some o par da alfabetização
//   J6 língua fora do repertório ganha uma mão           🔴 a mão de um país que não é o dela
//   J7 o 11.º ícone monta sem quem o accione (pause-icons.node)  🔴 o §5 do ADR-0106
