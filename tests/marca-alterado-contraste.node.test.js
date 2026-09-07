// SPDX-License-Identifier: AGPL-3.0-or-later
// A MARCA DE "SAIU DO PADRÃO" TEM DE SER VISTA — medida, não estimada (ADR-0029, issue #61).
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// A issue #61 fecha com um aviso escrito pelo Dev e nunca cumprido: «⚠️ Não verificado: contraste da marca.
// WCAG 1.4.11 pede 3:1 para indicador não-textual, e NINGUÉM MEDIU.» Sete painéis passaram a marcar, o
// ADR-0029 descreveu três canais, e o único número que sustentava tudo isso era nenhum.
//
// É o mesmo defeito que o `contraste-menu` já corrigiu para o texto: um recurso de acessibilidade que promete
// e não mede é pior que a ausência dele, porque a professora confia no que está escrito.
//
// ========================= O QUE FOI MEDIDO (2026-09-07) =========================
// Alvo: 7:1, e a escolha é a mesma que o `contraste-menu` já fez para a borda do cursor — a WCAG 1.4.11 pede
// 3:1 para componente, e 3:1 é PISO, não teto. Tratar um mínimo como permissão para parar é o contrário do
// que este projeto faz. Nenhum par chegou perto de precisar da folga:
//
//   tema base          moldura sobre a linha (.ctrl-row)   18,42:1
//                      moldura sobre o botão (--panel)     15,30:1
//                      moldura sobre o .pm-btn             14,91:1
//   alto contraste     moldura sobre a linha               14,54:1
//                      moldura sobre o botão (--panel)     16,57:1
//                      moldura sobre o .pm-btn             11,77:1
//
// ⚠️ E A MEDIÇÃO ACHOU O QUE O AVISO NÃO PREVIA, que é o achado deste ficheiro:
//
//   MARCADO contra NÃO-MARCADO mede 1,45:1 no tema base e 1,27:1 no alto contraste.
//
// Quer dizer: por LUMINÂNCIA, as duas molduras são a mesma. Branco (#fff) contra `--ink-soft` (#cdd6f2), e
// amarelo (#ffe600) contra branco, são diferenças de MATIZ. Para quem vê em escala de cinza — acromatopsia,
// tela monocromática, impressão — o canal de COR da marca não entrega nada, nos dois temas.
//
// Isto NÃO é um defeito, e a distinção importa: é exactamente a razão de o ADR-0029 ter três canais e não
// um, e de o canal 2 ser uma CONTAGEM DE ANÉIS. O que muda é o estatuto do anel — ele deixa de ser reforço e
// passa a ser o que carrega a informação para uma parte do público. Por isso o caso `[Interface]` abaixo
// prende o anel: quem um dia o apagar «porque a cor já diz» estará a apagar a única coisa que diz.
//
// ⚠️ O comentário do `@media (prefers-contrast: more)` no `style.css` diz que sem a troca «marcado e
// não-marcado viram a mesma moldura». Isso continua verdade ao pé da letra — lá `--ink-soft` JÁ é branco, e
// sem a troca as duas seriam o MESMO valor, não apenas parecidas. A troca compra distinção de matiz; não
// compra contraste. As duas frases convivem, e ambas ficam presas por caso.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { razaoDeContraste, hex, lerToken } from './fixtures/contraste-wcag.js';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');

/** Onde começa a redeclaração de tokens do alto contraste. Tudo antes é tema base. */
const HC = CSS.indexOf('@media (prefers-contrast: more)');

const base = (nome) => lerToken(CSS, nome);
const alto = (nome) => lerToken(CSS, nome, HC);

/** O `background:#rrggbb` LITERAL de uma regra, lido da folha em vez de copiado para cá. */
function fundoDaRegra(seletor) {
  const m = CSS.match(new RegExp(seletor.replace('.', '\\.') + '\\{[^}]*background:\\s*(#[0-9a-fA-F]{3,8})'));
  if (!m) throw new Error(`o fundo literal de ${seletor} sumiu do style.css — o par deixou de existir`);
  return hex(m[1]);
}

/** 3:1 é o que a norma pede; 7:1 é o que este projecto paga. Ver o cabeçalho. */
const ALVO = 7;
const PISO_DA_NORMA = 3;

describe('a marca de "saiu do padrão" é VISÍVEL nos dois temas (ADR-0029, issue #61)', () => {
  it('[Zero] o gate está a ler o CSS de verdade, e achou os DOIS temas', () => {
    // Sem isto, um `indexOf` que devolvesse -1 faria `lerToken(css, nome, -1)` medir o último caractere e
    // rebentar — ou pior, faria a leitura do alto contraste devolver o valor do tema base em silêncio, e
    // todos os casos abaixo ficariam verdes a medir o mesmo tema duas vezes.
    expect(CSS.length).toBeGreaterThan(5000);
    expect(HC, 'o @media do alto contraste sumiu do style.css').toBeGreaterThan(0);
    expect(CSS.slice(0, HC), 'a marca deixou de ter token no tema base').toContain('--changed:');
  });

  it('[Right] a moldura da marca bate 7:1 contra TODA superfície onde é desenhada, nos dois temas', () => {
    const linha = fundoDaRegra('.ctrl-row');   // as linhas de opção dos painéis
    const pares = [
      ['base · moldura sobre a linha', base('changed'), linha],
      ['base · moldura sobre o botão', base('changed'), base('panel')],
      ['base · moldura sobre o .pm-btn', base('changed'), base('panel-btn')],
      ['alto · moldura sobre a linha', alto('changed'), linha],
      ['alto · moldura sobre o botão', alto('changed'), alto('panel')],
      // `--panel-btn` NÃO é redeclarado no alto contraste — o `.pm-btn` continua com o fundo do tema base,
      // e é contra ele que a moldura amarela se desenha. Ler `alto('panel-btn')` rebentaria, e rebentar aqui
      // seria certo: significaria que a folha mudou e este par deixou de ser o par real.
      ['alto · moldura sobre o .pm-btn', alto('changed'), base('panel-btn')],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO)
      .map(([nome, r]) => `${nome}: ${r.toFixed(2)}:1`);
    expect(falham, 'a marca ficou abaixo de 7:1 (a norma pede ' + PISO_DA_NORMA + ':1): ' + falham.join(' | ')).toEqual([]);
  });

  it('⚠️ [Interface] o ANEL é o que distingue marcado de não-marcado — a cor não distingue, e está medido', () => {
    // O achado do cabeçalho, preso por número dos dois lados.
    //
    // Primeiro a constatação: as duas molduras são indistinguíveis por luminância. Isto está afirmado como
    // asserção, e não como comentário, de propósito — se um dia alguém escolher cores que TAMBÉM contrastem
    // entre si, este caso reprova e obriga a reler o parágrafo em vez de o deixar mentir em silêncio.
    const rBase = razaoDeContraste(base('changed'), base('ink-soft'));
    const rAlto = razaoDeContraste(alto('changed'), alto('ink-soft'));
    expect(rBase, `marcado x não-marcado no tema base: ${rBase.toFixed(2)}:1`).toBeLessThan(PISO_DA_NORMA);
    expect(rAlto, `marcado x não-marcado no alto contraste: ${rAlto.toFixed(2)}:1`).toBeLessThan(PISO_DA_NORMA);

    // E por isso o canal de FORMA tem de existir: é ele que sobra em escala de cinza. A regra desenha um anel
    // INTERNO com `box-shadow`, de que o não-marcado não tem nenhum — é a contagem de anéis do ADR-0029.
    const regra = CSS.match(/\.is-changed\{([^}]*)\}/);
    expect(regra, 'a regra .is-changed sumiu do style.css').toBeTruthy();
    expect(regra[1], 'o ANEL do canal de FORMA saiu, e a cor sozinha não distingue nada em escala de cinza')
      .toMatch(/box-shadow:[^;]*inset[^;]*var\(--changed\)/);
  });

  it('[Boundary] o alto contraste REDECLARA a marca — sem isso ela seria o mesmo valor do não-marcado', () => {
    // A promessa literal do comentário do `@media` no style.css. Lá `--ink-soft` é `#fff`; se `--changed`
    // não fosse trocado, marcado e não-marcado seriam o MESMO `#fff` — não parecidos, iguais.
    expect(alto('ink-soft'), 'a premissa mudou: --ink-soft já não é branco no alto contraste').toEqual([255, 255, 255]);
    expect(alto('changed'), 'a marca voltou a ser a cor do não-marcado no alto contraste').not.toEqual(alto('ink-soft'));
    expect(base('changed'), 'a marca ficou igual ao não-marcado no tema base').not.toEqual(base('ink-soft'));
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando `--changed:#fff` por `--changed:#1c2542` (quase o fundo do botão) no `:root` → reprovam DOIS
//     casos, e o segundo é a prova de que o parágrafo do cabeçalho está preso e não apenas escrito:
//       "[Right] 7:1" cai nos três pares do tema base, com 1,22 / 1,01 / 1,01:1;
//       "[Interface]" cai porque uma moldura ESCURA passa a contrastar 10,41:1 com `--ink-soft` — quer
//       dizer, a afirmação "a cor não distingue" deixaria de ser verdade e o caso obriga a reescrevê-la.
//   · apagando o `box-shadow` de `.is-changed` → "[Interface] o ANEL" reprova: sobra a cor, que já está
//     medida como incapaz de distinguir.
//   · tirando `--changed:#ffe600` do `@media (prefers-contrast: more)` → reprovam três casos por exceção do
//     `lerToken` ("token --changed não existe a partir do índice 14591"), que é a falha certa: sem o token
//     não há o que medir, e devolver `undefined` daria NaN verde.
//   · ⚠️ trocando `--changed` no alto contraste para `#fff` (a cor do não-marcado) → "[Boundary]" reprova na
//     asserção do `.not.toEqual`, E "[Right]" continua VERDE (branco sobre preto mede 21:1). Registado
//     porque mostra o que cada caso guarda: o primeiro guarda a DISTINÇÃO, o segundo a VISIBILIDADE, e
//     nenhum dos dois substitui o outro.
