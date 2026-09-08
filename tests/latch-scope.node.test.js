// SPDX-License-Identifier: AGPL-3.0-or-later
// A ALTERNÂNCIA É DE UM TRANSPORTE, e em quatro deles não é escolha nenhuma (ADR-0104 §C, issue #114).
//
// ========================= O DEFEITO QUE ESTES CASOS SEGURAM =========================
// A alternância estava guardada por JOGADOR — por pessoa, e para todos os aparelhos ao mesmo tempo. Ligá-la
// no controle de tela, onde ninguém segura um botão virtual com conforto, ligava-a também no teclado, onde
// segurar uma tecla é exactamente o que a criança sabe fazer. Ninguém pediu isso e nada o dizia.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  UM_COMANDO_DE_CADA_VEZ, alternanciaSempreLigada, alternanciaEhEscolha,
  chaveDaAlternancia, chaveLegadaDaAlternancia, alternanciaDe,
} from '../app/js/input/latch-scope.js';
import { transportesPadrao } from '../app/js/input/transports.js';

const nada = { doTransporte: null, doLegado: null, padrao: false };

describe('input/latch-scope · a chave leva o transporte no nome', () => {
  it('[Right] a chave nova separa jogador E transporte; a antiga só separa jogador', () => {
    expect(chaveDaAlternancia('togglemove', 0, 'toque')).toBe('incl_togglemove_p0_toque');
    expect(chaveDaAlternancia('togglerun', 1, 'teclado')).toBe('incl_togglerun_p1_teclado');
    expect(chaveLegadaDaAlternancia('togglemove', 0)).toBe('incl_togglemove_p0');
  });

  it('⚠️ [Interface] a chave nova COMEÇA pela antiga, e é isso que a torna migrável', () => {
    // Se o nome novo não fosse um prolongamento do antigo, a herança abaixo teria de ser uma tabela de
    // conversão à parte — e uma tabela à parte é onde um par se perde sem ninguém ver.
    for (const base of ['togglemove', 'togglerun']) {
      for (const t of ['toque', 'teclado', 'gamepad']) {
        expect(chaveDaAlternancia(base, 0, t).startsWith(chaveLegadaDaAlternancia(base, 0))).toBe(true);
      }
    }
  });

  it('⚠️ [Interface] dois transportes NUNCA partilham chave — é o vazamento que o §C fecha', () => {
    const chaves = transportesPadrao({ gamepad: () => true, teclado: () => true, toque: () => true, rato: () => true })
      .map((t) => chaveDaAlternancia('togglemove', 0, t.id));
    expect(new Set(chaves).size, 'dois transportes escrevem no mesmo lugar').toBe(chaves.length);
    // E dois JOGADORES também não, que é a separação que já existia e não pode ter-se perdido no caminho.
    expect(chaveDaAlternancia('togglemove', 0, 'toque')).not.toBe(chaveDaAlternancia('togglemove', 1, 'toque'));
  });
});

describe('input/latch-scope · nos transportes de UM COMANDO ela não é preferência', () => {
  it('[Right] olhos, rosto, gestos e fala estão sempre ligados; os três de hoje não', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      expect(alternanciaSempreLigada(t), `${t} deixou de estar sempre ligado`).toBe(true);
      expect(alternanciaEhEscolha(t), `${t} passou a oferecer a opção`).toBe(false);
    }
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(alternanciaSempreLigada(t), `${t} passou a estar sempre ligado`).toBe(false);
      expect(alternanciaEhEscolha(t)).toBe(true);
    }
  });

  it('⚠️ [Zero] e um `false` guardado NÃO os desliga — nem pelo legado', () => {
    // O pior defeito possível, e no controle de quem tem menos alternativas: uma criança que tivesse
    // desligado a alternância no teclado herdaria esse `false` e ficaria com um controle de olhar que não
    // responde. Por isso a pergunta «este transporte é de um comando?» vem ANTES de qualquer leitura.
    const desligado = { doTransporte: false, doLegado: false, padrao: false };
    for (const t of UM_COMANDO_DE_CADA_VEZ) {
      expect(alternanciaDe(t, desligado), `${t} foi desligado por um valor guardado`).toBe(true);
    }
  });

  it('[Interface] os quatro nomes são exactamente quatro — acrescentar um é uma decisão', () => {
    // Um transporte entra nesta lista porque emite um comando de cada vez, e não porque seria conveniente.
    // Se alguém puser o toque aqui, a opção deixa de ser oferecida a quem a quer desligada.
    expect([...UM_COMANDO_DE_CADA_VEZ].sort()).toEqual(['fala', 'gestos', 'olhos', 'rosto']);
  });
});

describe('input/latch-scope · a resolução, e a herança da chave antiga', () => {
  it('[Right] o valor DESTE transporte vence tudo o resto', () => {
    expect(alternanciaDe('toque', { doTransporte: true, doLegado: false, padrao: false })).toBe(true);
    expect(alternanciaDe('toque', { doTransporte: false, doLegado: true, padrao: true })).toBe(false);
  });

  it('⚠️ [Boundary] sem valor deste transporte, o LEGADO herda — e herda para todos', () => {
    // O valor velho foi posto pela criança nalgum contexto e a chave não registava qual. As saídas eram
    // perder o ajuste, adivinhar um transporte, ou herdar para todos. Só a terceira não tira nada a quem
    // depende do ajuste, e o vazamento que ela mantém dura até ela mexer no assunto uma vez em cada aparelho.
    for (const t of ['toque', 'teclado', 'gamepad']) {
      expect(alternanciaDe(t, { doTransporte: null, doLegado: true, padrao: false })).toBe(true);
    }
  });

  it('[Zero] sem nada guardado, o padrão de fábrica responde', () => {
    expect(alternanciaDe('teclado', nada)).toBe(false);
    expect(alternanciaDe('teclado', { ...nada, padrao: true })).toBe(true);
  });

  it('⚠️ [Boundary] `false` guardado é um VALOR, e não uma ausência', () => {
    // O erro clássico deste desenho é escrever `l.doTransporte || l.doLegado || l.padrao`: um `false`
    // deliberado cairia para o legado e a criança que DESLIGOU a alternância vê-la-ia voltar sozinha.
    expect(alternanciaDe('teclado', { doTransporte: false, doLegado: true, padrao: true })).toBe(false);
    expect(alternanciaDe('teclado', { doTransporte: null, doLegado: false, padrao: true })).toBe(false);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · ⚠️ TIRANDO O TRANSPORTE DA CHAVE (de volta a `incl_${base}_p${jogador}`) -> reprovam DOIS. E o defeito
//     inteiro, na sua forma original: ligar a alternancia no controle de tela liga-a no teclado.
//   · pondo a pergunta «este transporte e de um comando?» DEPOIS das leituras -> reprova o caso do `false`
//     guardado. Uma crianca que tivesse desligado a alternancia no teclado herdaria esse `false` e ficaria
//     com um controle de olhar que nao responde — no controle de quem tem menos alternativas.
//   · trocando as duas conferencias de `null` por `l.doTransporte || l.doLegado || l.padrao` — o erro
//     classico deste desenho — -> reprovam DOIS. Um `false` deliberado viraria ausencia, e a alternancia
//     que a crianca DESLIGOU voltaria sozinha.
//   · tirando a heranca do legado -> reprovam DOIS. A crianca perderia o ajuste que ja tinha, que e o custo
//     que a heranca existe para nao cobrar.
//   · pondo `toque` na lista dos de um comando -> reprovam TRES. A opcao deixaria de ser oferecida a quem a
//     quer desligada, e um controle de tela SEGURA dois pontos — ele nao e de um comando so.
//   · tirando `olhos` da lista -> reprovam DOIS. E a mutacao que mostra que a lista e uma decisao e nao um
//     detalhe: sai um nome e um controle inteiro deixa de funcionar.
//   · `alternanciaEhEscolha` a devolver sempre `true` -> reprova o caso dos quatro. O painel desenharia um
//     botao que nao pode fazer nada, que e pior do que nao o desenhar.
