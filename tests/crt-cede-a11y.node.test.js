// SPDX-License-Identifier: AGPL-3.0-or-later
// O CRT DECORATIVO CEDE À ACESSIBILIDADE — e cada efeito tem uma saída, no menu Sensibilidade visual.
//
// ========================= A DECISÃO, E DE ONDE ELA VEM =========================
// O ADR-0020 sempre disse "modos de a11y SUPRIMEM o CRT decorativo — precedência a11y > estética". A emenda de
// 2026-08-26 mediu que isso NUNCA tinha sido implementado: com a vinheta ligada, `crt-vig-1` sobrevivia em
// `hc-direto`, `fix-deuter`, `lv-blur` e `blind`. A vinheta passou a ceder; a SCANLINE não, e ficou registrada
// como pergunta aberta — o Dev tinha dito "Scanline não deverá ceder a acessibilidade por enquanto".
//
// Em 2026-08-27 ele decidiu o contrário, e com uma ressalva que é a metade interessante:
//
//   "ceda o scanline e o CRT à acessibilidade, mas deixe uma opção de não ceder para cada um no menu conforto
//    visual."
//
// Ou seja: o PADRÃO respeita o pilar (a11y vence estética) e a EXCEÇÃO é da criança, não do programa. Quem tem
// baixa visão e gosta da scanline pode mantê-la; quem não mexe em nada recebe a tela limpa no modo de a11y.
//
// ⚠️ POR QUE ISTO É LÓGICA PURA E NÃO UM `if` DENTRO DO `applyCrt`. São três entradas por efeito (o nível, a
// preferência de manter, e se há a11y visual ativa) e oito combinações, das quais duas são armadilha: "manter"
// não pode LIGAR um efeito desligado, e ceder não pode APAGAR a preferência gravada. Um `if` em linha esconde
// as duas; uma função devolve as oito.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { efeitoDecorativoVisivel } from '../app/js/render/crt-cede.js';

/** Uma preferência mínima: o nível do efeito e se a criança pediu para ele NÃO ceder. */
const pref = (nivel, manterEmA11y = false) => ({ nivel, manterEmA11y });

describe('CRT decorativo · quem cede, quando, e a saída de cada efeito', () => {
  it('[Right] sem acessibilidade visual, o efeito ligado aparece', () => {
    expect(efeitoDecorativoVisivel(pref(1), false)).toBe(true);
  });

  it('[Zero] efeito desligado não aparece, com ou sem a11y', () => {
    expect(efeitoDecorativoVisivel(pref(0), false)).toBe(false);
    expect(efeitoDecorativoVisivel(pref(0), true)).toBe(false);
  });

  it('[Right] COM acessibilidade visual, o efeito CEDE — este é o padrão e é o pilar', () => {
    // "quando estética briga com a11y, a11y vence" (ADR-0010). Sem esta linha, a vinheta escurece as bordas
    // justamente no modo que existe para aumentar contraste, e a scanline risca a tela de quem já enxerga mal.
    expect(efeitoDecorativoVisivel(pref(1), true)).toBe(false);
  });

  it('[Right] a saída da criança vence o padrão — o efeito fica se ela pediu', () => {
    expect(efeitoDecorativoVisivel(pref(1, true), true)).toBe(true);
  });

  it('[Boundary] "manter" NÃO LIGA um efeito desligado', () => {
    // A armadilha do nome: "não ceder" fala sobre a supressão, não sobre o efeito. Se `manterEmA11y` ligasse a
    // scanline, uma criança que a desligou a veria voltar ao entrar em alto contraste — o oposto do pedido.
    expect(efeitoDecorativoVisivel(pref(0, true), true)).toBe(false);
    expect(efeitoDecorativoVisivel(pref(0, true), false)).toBe(false);
  });

  it('[Boundary] a saída sem a11y ativa não muda nada — ela só existe DENTRO do modo', () => {
    expect(efeitoDecorativoVisivel(pref(1, true), false)).toBe(true);
    expect(efeitoDecorativoVisivel(pref(1, false), false)).toBe(true);
  });

  it('[Interface] as oito combinações, escritas de uma vez — nenhuma sobra sem resposta', () => {
    // Right-BICEP: a tabela inteira, porque é ela que prova que "ceder" e "manter" não se atropelam.
    const tabela = [
      // nivel, manter, a11y  → visível
      [0, false, false, false], [0, false, true, false],
      [0, true, false, false], [0, true, true, false],
      [1, false, false, true], [1, false, true, false],
      [1, true, false, true], [1, true, true, true],
    ];
    for (const [nivel, manter, a11y, esperado] of tabela) {
      expect(efeitoDecorativoVisivel(pref(nivel, manter), a11y), `nivel=${nivel} manter=${manter} a11y=${a11y}`).toBe(esperado);
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `p.nivel > 0` e ignorando a a11y → "[Right] COM acessibilidade visual, o efeito CEDE" reprova,
//     e o efeito real é o defeito que o ADR-0020 mediu em 2026-08-26 voltando inteiro.
//   · devolvendo `p.manterEmA11y || !a11y` (esquecendo o nível) → "[Boundary] 'manter' NÃO LIGA um efeito
//     desligado" reprova, e o efeito real é a scanline ressuscitando para quem a tinha desligado.
//   · trocando `||` por `&&` na saída → "[Right] a saída da criança vence o padrão" reprova (4 casos).
//   · E A MUTAÇÃO DE **USO**, que é a que a lição do ADR-0045 manda conferir: fixar `manterEmA11y: false` na
//     chamada dentro de `applyCrt` → `tests/crt.browser.test.js` reprova. Sem ela, esta decisão estaria provada
//     certa e nunca provada CHAMADA — que foi exatamente o buraco que três módulos tinham em 26/08.
