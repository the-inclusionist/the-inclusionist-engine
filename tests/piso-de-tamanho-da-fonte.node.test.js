// SPDX-License-Identifier: AGPL-3.0-or-later
// O MÍNIMO DE UMA CALIGRÁFICA VIRA GATE QUANDO ENCOSTA NO TAMANHO QUE A TELA USA (#87, item 2).
//
// ========================= O QUE FALTAVA, E ERA A METADE QUE IMPORTA =========================
// O item 2 da #87 diz, com estas palavras: «Abaixo disso a face deixa de ser difícil e vira ilegível — tem
// de ser gate, não recomendação.» O que existia era metade: `ui/fonts` declara `minPx` (Pinyon 24,
// UnifrakturMaguntia 20) e `tests/settings-typo.node.test.js` afere que a DECLARAÇÃO está lá.
//
// ⚠️ MAS NADA EM PRODUÇÃO LIA O NÚMERO. Medido em 2026-09-07: `minPx` aparece em três linhas de `ui/fonts.ts`
// — a definição do campo e os dois valores — e em mais lado nenhum do `app/js`. Um mínimo que só o teste lê
// é uma recomendação com aparência de gate, que é precisamente o que a issue recusa.
//
// ========================= O NÚMERO QUE FALTAVA DO OUTRO LADO =========================
// Um mínimo só é aferível contra o tamanho que a tela USA. Medido no `app/css/style.css`:
//
//   · o menor `font-size` declarado em PIXELS é **14px** (o recuo de `--hud-fs`, no `#game-hud`);
//   · há **28** regras em `em`, e essas não se computam estaticamente.
//
// ⚠️ E A DIREÇÃO DA IGNORÂNCIA É A QUE SALVA O ARGUMENTO. Não sei o menor tamanho REAL desenhado — mas sei
// que as regras relativas só podem descer a partir do que herdam. Portanto 14px é um TETO do piso: o menor
// tamanho de facto é **14px ou menos**. E é isso que basta, porque a conclusão é «não desça abaixo de».
//
// ========================= A CONSEQUÊNCIA, QUE DEIXA DE SER GOSTO =========================
// Pinyon pede 24 e Maguntia pede 20. Ambas acima de 14. Logo **nenhuma das duas pode ser oferecida no menu
// desta interface** — e o `OFERECIVEIS` já as exclui, mas excluía-as por PAPEL, que é uma regra de desenho.
// A partir daqui a exclusão também está presa a um NÚMERO: se alguém puser uma caligráfica no menu, ou der
// `minPx` a uma face geral, ou baixar o piso da tela, isto reprova.
//
// ⚠️ O que este ficheiro NÃO afirma: que 14px é o piso real. Afirma que é um teto dele, e a asserção usa-o
// só nessa direção. Um caso que dissesse «o piso é 14» estaria a inventar precisão que a medição não tem.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS, OFERECIVEIS, papelDaFonte } from '../app/js/ui/fonts.js';

const RAIZ = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const CSS = readFileSync(join(RAIZ, 'app', 'css', 'style.css'), 'utf8');

/** Os `font-size` em px, incluindo o recuo de um `var(--x, Npx)` — que é o que o HUD realmente usa. */
const EM_PX = [...CSS.matchAll(/font-size:\s*(?:var\([^,)]+,\s*)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
/** As regras relativas. Não entram na conta; entram no ARGUMENTO, porque só descem. */
const RELATIVAS = [...CSS.matchAll(/font-size:\s*\.?\d+(?:\.\d+)?r?em/g)].length;

const TETO_DO_PISO = Math.min(...EM_PX);

describe('o tamanho mínimo de uma face é aferido contra o que a tela usa (#87 item 2)', () => {
  it('⚠️ [Cross-check] a leitura do CSS acha tamanhos — senão tudo abaixo seria vazio', () => {
    // Um regex que deixasse de casar daria `Math.min()` = Infinity, e todas as comparações abaixo ficariam
    // verdes para sempre. Este caso é o que impede o gate de morrer em silêncio, que já aconteceu neste
    // repositório com outra regex.
    expect(EM_PX.length, 'nenhum font-size em px encontrado no style.css').toBeGreaterThan(0);
    expect(Number.isFinite(TETO_DO_PISO)).toBe(true);
    expect(RELATIVAS, 'nenhuma regra relativa; rever a prosa do cabeçalho').toBeGreaterThan(0);
  });

  it('[Right] o teto do piso é um número de tela plausível, e não um acidente de leitura', () => {
    // Larga de propósito: o caso não existe para prender o valor — existe para apanhar uma leitura absurda
    // (0, ou 200) que faria as asserções seguintes dizerem qualquer coisa.
    expect(TETO_DO_PISO).toBeGreaterThanOrEqual(8);
    expect(TETO_DO_PISO).toBeLessThanOrEqual(24);
  });

  it('⚠️ [Zero] NENHUMA face oferecida no menu pede mais do que a tela dá', () => {
    // A regra inteira, e a única que precisa de existir. `minPx` ausente = a face não tem mínimo declarado.
    const grandes = OFERECIVEIS
      .filter((it) => typeof it.minPx === 'number' && it.minPx > TETO_DO_PISO)
      .map((it) => `${it.k} pede ${it.minPx}px e a tela desce a ${TETO_DO_PISO}px ou menos`);
    expect(grandes, 'face oferecida que a interface desenharia abaixo do legível').toEqual([]);
  });

  it('⚠️ [Interface] e a exclusão das caligráficas deixa de ser só desenho — passa a ter número', () => {
    // O `OFERECIVEIS` filtra por PAPEL. Este caso afirma a segunda razão, independente da primeira: cada
    // caligráfica pede MAIS do que esta interface garante. Se um dia a tela subir o piso, este caso reprova
    // — e reprova a pedir uma releitura, não um conserto: a essa altura a exclusão passaria a ser só desenho
    // outra vez, e o ADR-0012 é que decide isso.
    const CALIGRAFICAS = FONT_GROUPS.flatMap((g) => g.items).filter((it) => papelDaFonte(it) === 'caligrafica');
    expect(CALIGRAFICAS.length, 'não há caligráficas; este caso não mede nada').toBeGreaterThan(0);
    for (const it of CALIGRAFICAS) {
      expect(it.minPx, `${it.k} não declara mínimo`).toBeTypeOf('number');
      expect(it.minPx, `${it.k} pede ${it.minPx}px, que a tela já garante — reler o ADR-0012 emendado`)
        .toBeGreaterThan(TETO_DO_PISO);
      expect(OFERECIVEIS.includes(it), `${it.k} está no menu e a tela desenha-a ilegível`).toBe(false);
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o filtro por papel do `OFERECIVEIS` (`ui/fonts`) → "[Zero] NENHUMA face oferecida" reprova
//     nomeando `pinyon` e `ufmag` com os dois números lado a lado. É a #87 item 2 aferida em vez de escrita.
//   · acrescentando ao catálogo uma face GERAL (sem `papel`, logo oferecida) com `minPx: 20` → "[Zero]"
//     reprova com «pede 20px e a tela desce a 14px ou menos». O gate não depende de a face ser caligráfica:
//     depende de o número não caber na tela.
//   · subindo TODAS as SETE declarações de `font-size` em px do `style.css` para 26px → "[Interface] a
//     exclusão das caligráficas" reprova nas duas, a pedir releitura do ADR-0012. ⚠️ Registado como
//     reprovação DESEJADA e não como defeito: subir o piso da tela muda a premissa da exclusão.
//
//     ⚠️ E REGISTADO TAMBÉM O QUE ME CORREU MAL, porque é a lição e não o resultado: tentei-a primeiro
//     trocando UMA ocorrência de `var(--hud-fs,14px)`. Há duas, e há mais cinco declarações em px noutras
//     regras — entre elas o `font-size:16px` do `html,body`. A suíte ficou verde e eu ia registá-la como
//     «mutação que não falha», quando o que tinha acontecido era a mutação NÃO TER SIDO APLICADA ao número
//     que o gate lê. Contar as ocorrências antes de substituir é o que separa as duas coisas.
//   · trocando o regex de `px` por um que não casa → "[Cross-check] a leitura do CSS acha tamanhos" reprova.
//     Sem ele, `Math.min()` daria Infinity e os dois casos seguintes ficariam verdes para sempre.
