// SPDX-License-Identifier: AGPL-3.0-or-later
// UMA FONTE OFERECIDA NO MENU TEM DE CARREGAR — senão o menu mente.
//
// ========================= O ACHADO =========================
// ⚠️ Medido em 2026-09-07: NINGUÉM neste repositório referencia `vendor/fonts.css`. Quem o ligava era o
// `app/index.html`, que saiu com o cartucho (issue #111), e nada tomou o lugar dele.
//
// O efeito é o painel de tipografia inteiro: ele oferece dezassete famílias, a criança escolhe uma, o menu
// marca-a como activa — e o navegador desenha a fonte do sistema, porque nenhum `@font-face` foi carregado.
// Não há erro em lado nenhum. A escolha é registada, persistida e anunciada; só não acontece.
//
// ⚠️ E É A MESMA FORMA DO ADR-0094: oferecer o que não se consegue entregar. Lá o motor neural deixou de
// aparecer no menu quando a porta não existe; aqui a saída é a inversa — a engine tem de LIGAR a folha,
// porque as fontes são dela e viajam no pacote pela porta `./assets/*`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS } from '../app/js/ui/fonts.js';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const ler = (...p) => readFileSync(join(RAIZ_REPO, ...p), 'utf8');

const CSS = ler('app', 'public', 'vendor', 'fonts.css');
/** As famílias que o `fonts.css` declara — é o que o navegador de facto sabe desenhar. */
const DECLARADAS = new Set([...CSS.matchAll(/font-family:\s*['"]?([^;'"]+)/g)].map((m) => m[1].trim()));

/** Todo item do catálogo, com a marca de quem é OFERECÍVEL (não está `.off`). */
const ITENS = FONT_GROUPS.flatMap((g) => g.items.map((it) => ({ fam: it.fam, oferecivel: !it.off })));

describe('uma fonte oferecida no menu carrega de verdade (ADR-0012)', () => {
  it('[Interface] o catálogo e a folha existem e têm tamanho de gente', () => {
    expect(ITENS.length).toBeGreaterThanOrEqual(15);
    expect(DECLARADAS.size).toBeGreaterThanOrEqual(15);
  });

  it('⚠️ [Zero] NENHUMA fonte oferecível fica sem `@font-face`', () => {
    const fantasmas = ITENS.filter((i) => i.oferecivel && !DECLARADAS.has(i.fam)).map((i) => i.fam);
    expect(fantasmas, 'a criança escolhe e o navegador desenha outra coisa, sem erro nenhum').toEqual([]);
  });

  it('[Boundary] uma fonte `.off` PODE não ter face — é por isso que ela está `.off`', () => {
    // `Learning Curve` e `Kindergarten Pro` estão desabilitadas no catálogo e ausentes da folha. Exigir-lhes
    // um `@font-face` seria pedir o ficheiro de uma fonte que o menu não deixa escolher.
    const desligadas = ITENS.filter((i) => !i.oferecivel);
    expect(desligadas.length).toBeGreaterThan(0);
  });

  it('[Interface] a folha PODE declarar mais do que o menu oferece', () => {
    // `Atkinson Hyperlegible Mono` está na folha e não no menu, e o ADR-0012 diz porquê: ela é a face
    // canónica da MATEMÁTICA — «it is a font and it is not a choice». Uma face sem linha de menu é
    // legítima; uma linha de menu sem face não é.
    const soNaFolha = [...DECLARADAS].filter((f) => !ITENS.some((i) => i.fam === f));
    expect(soNaFolha.length).toBeGreaterThanOrEqual(0);
  });

  it('⚠️ [Right] e o HOST da engine LIGA a folha — senão nada disto chega ao ecrã', () => {
    // O `app/index.html` era quem a ligava e saiu com o cartucho. Sem esta linha o gate acima fica verde
    // sobre um menu que não pinta nada: o catálogo concorda com uma folha que ninguém carregou.
    const host = ler('app', 'quiz.html');
    expect(host, '`vendor/fonts.css` não é carregado pelo único host da engine').toMatch(/vendor\/fonts\.css/);
  });

  it('[Interface] e o pacote entrega a folha ao consumidor', () => {
    // `files` leva `app/public/vendor` e o `exports` publica `./assets/*`. Se um dos dois cair, o
    // consumidor liga um caminho que dá 404 — e o gate de `engine-package` não vê isso, porque olha
    // imports de código.
    const pkg = JSON.parse(ler('package.json'));
    expect(pkg.files).toContain('app/public/vendor');
    expect(Object.keys(pkg.exports)).toContain('./assets/*');
  });
});
