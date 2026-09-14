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

/** The typographic catalogue's active families (ADR-0176): what may be packaged. */
const ATIVAS = new Set(JSON.parse(readFileSync(join(process.cwd(), 'research', 'catalogo_tipografico.json'), 'utf8'))
  .fontes.filter((f) => f.status === 'ativo').map((f) => f.familia));

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const ler = (...p) => readFileSync(join(RAIZ_REPO, ...p), 'utf8');

const CSS = ler('app', 'public', 'vendor', 'fonts.css');
/** As famílias que o `fonts.css` declara — é o que o navegador de facto sabe desenhar. */
const DECLARADAS = new Set([...CSS.matchAll(/font-family:\s*['"]?([^;'"]+)/g)].map((m) => m[1].trim()));

/** Todo item do catálogo, com a marca de quem é OFERECÍVEL (não está `.off`). */
const ITENS = FONT_GROUPS.flatMap((g) => g.items.map((it) => ({ fam: it.fam, oferecivel: !it.off })));

describe('uma fonte oferecida no menu carrega de verdade (ADR-0012)', () => {
  it('[Interface] o catálogo e a folha existem e têm tamanho de gente', () => {
    // ⚠️ O piso desceu de 15 para 12 em 2026-09-07: o roster perdeu quatro faces (issue #87, item 3 — duas
    // por peso, duas que eram entradas `.off` sem ficheiro). Como o piso do `constantes-do-cartucho`, este
    // número não mede qualidade — mede que o import resolveu e a folha foi lida. Um catálogo vazio ou uma
    // folha ilegível dão ZERO, e é isso que ele apanha; quem guarda de verdade são os casos abaixo.
    expect(ITENS.length).toBeGreaterThanOrEqual(12);
    expect(DECLARADAS.size).toBeGreaterThanOrEqual(12);
  });

  it('🔴 [Zero] NENHUMA face declarada fica ÓRFÃ — o sentido que faltava a este crivo', () => {
    /*
     * 📏 MEDIDO em 2026-09-12, ao acrescentar vinte e duas faces: a corrente estava guardada em dois
     * sentidos e faltava o terceiro. Uma entrada do catálogo sem `@font-face` reprova; um `@font-face` cujo
     * woff2 não existe reprova; **um `@font-face` sem entrada no catálogo passava VERDE**.
     *
     * 🔴 E isso é uma face ÓRFÃ: bytes que entram no precache — hoje 106 entradas e 3512 KiB — e que nenhum
     * menu consegue oferecer. Ninguém a escolhe e toda escola a descarrega. Já era verdade das vinte e seis
     * faces de antes; não foi introduzido pelas novas, foi só medido por causa delas.
     *
     * ⚠️ A LISTA DE EXCEPÇÕES É NOMEADA E TEM DE DIZER PORQUÊ, senão vira a porta por onde a próxima órfã
     * entra. São as faces alcançadas por VARIÁVEL DE CSS em vez de escolhidas num menu — e, medido, é UMA.
     */
    const ALCANCADAS_POR_VARIAVEL = Object.freeze({
      // `--font-math` em `app/css/style.css`: os algarismos da matemática. Ela não é uma escolha de
      // tipografia — é a face que a engine impõe onde a forma do algarismo é a matéria (ADR-0010, pilar 5).
      'Atkinson Hyperlegible Mono': '--font-math (matemática)',
    });
    // Since the ADR-0176 erratum («Engine empacota tudo por enquanto») a declared face is orphan when the typographic
    // catalogue does not hold it as `ativo` — the catalogue, not the reading menu, says what exists; layer B faces are
    // packaged for ornament and never offered in the reading menu (R1).
    const orfas = [...DECLARADAS].filter((f) => !ATIVAS.has(f) && !(f in ALCANCADAS_POR_VARIAVEL));
    expect(orfas, 'a declared face the typographic catalogue does not hold as active: bytes in the precache nobody can use').toEqual([]);
    expect(ATIVAS.size, 'the catalogue was not read — the case would measure nothing').toBeGreaterThan(100);

    // 📌 O PAR, e sem ele a lista de excepções seria a porta aberta: cada excepção tem de estar MESMO
    // declarada. Uma entrada que sobreviva ao ficheiro que a justificava passa a autorizar uma órfã de graça.
    for (const fam of Object.keys(ALCANCADAS_POR_VARIAVEL)) {
      expect(DECLARADAS.has(fam), `a excepção «${fam}» já não existe no fonts.css — tire-a da lista`).toBe(true);
    }
  });

  it('⚠️ [Zero] NENHUMA fonte oferecível fica sem `@font-face`', () => {
    const fantasmas = ITENS.filter((i) => i.oferecivel && !DECLARADAS.has(i.fam)).map((i) => i.fam);
    expect(fantasmas, 'a criança escolhe e o navegador desenha outra coisa, sem erro nenhum').toEqual([]);
  });

  it('⚠️ [Boundary] o crivo só EXIGE face de quem é oferecível — e isso vale sem haver nenhuma desligada', () => {
    // ⚠️ ESTE CASO PERDEU O SUJEITO em 2026-09-07. Ele afirmava que uma fonte `.off` pode não ter face, e
    // apoiava-se em `Learning Curve` e `Kindergarten Pro` existirem no catálogo — as duas saíram do roster
    // (issue #87, item 3) por serem exactamente isso: entradas desabilitadas SEM ficheiro por trás.
    //
    // A regra continua a valer e o mecanismo continua a ser preciso (a Ronde do item 4 vai usá-lo), então o
    // caso passou a medir a REGRA em vez de contar instâncias: uma face desligada não entra no crivo das
    // fantasmas. Um caso que precisa de o catálogo ter um exemplar do seu tema reprova quando o roster muda,
    // que é o oposto de guardar o roster.
    const fantasma = { fam: 'Fonte Sem Ficheiro', oferecivel: false };
    const acusadas = [...ITENS, fantasma].filter((i) => i.oferecivel && !DECLARADAS.has(i.fam)).map((i) => i.fam);
    expect(acusadas, 'uma face DESLIGADA foi cobrada por não ter `@font-face`').toEqual([]);
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
    // `files` leva `app/public/vendor` e o `exports` publica a porta dos assets. Se um dos dois cair, o
    // consumidor liga um caminho que dá 404 — e o gate de `engine-package` não vê isso, porque olha
    // imports de código.
    //
    // ⚠️ A PORTA MUDOU DE NOME EM 2026-09-07 (#119), e a diferença é o ponto: era `./assets/*`, que casava
    // `app/public/` inteiro enquanto o `files` embarca só `vendor/`. Agora é `./assets/vendor/*`, que promete
    // exactamente o que viaja. ⚠️ E o caminho que o consumidor escreve NÃO MUDA — `assets/vendor/fonts.css`
    // casava na larga e casa na estreita —, que foi o que tornou a remoção segura.
    const pkg = JSON.parse(ler('package.json'));
    expect(pkg.files).toContain('app/public/vendor');
    expect(Object.keys(pkg.exports)).toContain('./assets/vendor/*');
    // E a porta larga NÃO volta: ela prometia pasta que o `files` não leva.
    expect(Object.keys(pkg.exports), 'a porta larga voltou; ver a #119').not.toContain('./assets/*');
  });
});
