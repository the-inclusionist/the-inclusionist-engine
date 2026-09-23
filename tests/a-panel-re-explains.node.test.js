// SPDX-License-Identifier: AGPL-3.0-or-later
// PAINEL QUE RECONSTRÓI LINHAS TEM DE REPOR A PROSA NO RODAPÉ.
//
// ========================= A REGRA, E ELA JÁ ESTAVA ESCRITA =========================
// O `CLAUDE.md` §4 carrega a decisão do Dev de 2026-08-25 e a sua consequência mecânica, por extenso:
//
//     «A explicação mora no RODAPÉ, e fica lá. […] Painel que re-renderiza precisa chamar `fillExplain` a
//      cada render, senão a prosa volta para dentro das linhas no primeiro clique.»
//
// `ui/settings-panel.fillExplain` roda UMA vez quando o overlay é frontalizado: ele varre as linhas, tira o
// `.opt-hint` de dentro de cada uma e move o texto para o rodapé `.opt-explain`. Quando um painel reconstrói
// as suas linhas por `innerHTML`, as linhas novas voltam com o `.opt-hint` LÁ DENTRO — porque o construtor
// as emite assim — e a prosa passa a aparecer duas vezes: no rodapé, da primeira passada, e sob cada rótulo,
// do redesenho.
//
// ========================= POR QUE UM GATE DE FONTE, E NÃO SÓ DE COMPORTAMENTO =========================
// ⚠️ ESTE DEFEITO JÁ FOI CONSERTADO DUAS VEZES E VOLTOU. A issue #109 consertou-o em `settings-visual` e
// `settings-empathy`; medido em 2026-09-07, CINCO painéis o tinham de novo — e um deles era o
// `settings-visual`. Um conserto pontual não impede a terceira vez; o que impede é a propriedade ser
// aferida sobre TODOS os painéis de uma vez, incluindo os que ainda não existem.
//
// A propriedade é estrutural e lê-se sem executar: um módulo de painel que reconstrói markup tem de saber
// repor a prosa. Não afere que a chamada está no lugar certo — isso é o caso de browser abaixo dele.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const UI = join(RAIZ_REPO, 'app', 'js', 'ui');
const CR = String.fromCharCode(13);

/** Os módulos de PAINEL. `settings-panel` é a casca — ela é quem tem o `fillExplain`, não quem o chama. */
const PAINEIS = readdirSync(UI)
  .filter((f) => f.startsWith('settings-') && f.endsWith('.ts') && f !== 'settings-panel.ts')
  .sort();

const fonte = (f) => readFileSync(join(UI, f), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO — a prosa deste repositório fala de `innerHTML` e de `fillExplain` o tempo todo. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

/**
 * ⚠️ RECONSTRUIR TAMBÉM SE FAZ POR PROCURAÇÃO, e foi assim que este crivo deixou passar um painel inteiro.
 *
 * A primeira versão perguntava só `\.innerHTML\s*=` no ficheiro do painel. O `settings-empathy` não tem
 * nenhum — e reconstrói na mesma, porque chama `ctx.renderVizGroup('#empathy-list', …)`, que é injetado e
 * cuja implementação (`render/viz-setters.ts`) faz `el.innerHTML = vizGroupHtml(modes, cur)`. As linhas
 * novas voltam com o `.opt-hint` lá dentro exatamente como as de qualquer outro painel; o que muda é só
 * QUEM as escreveu, e o crivo lia pelo autor em vez de ler pelo efeito.
 *
 * Medido em 2026-09-07: dos oito painéis, o `settings-empathy` é o único com ZERO `innerHTML =` — ou seja,
 * era o único que a isenção alcançava, e era precisamente o que precisava do gate. Um crivo que isenta
 * exatamente o caso doente não é um crivo frouxo: é um crivo com o sinal trocado.
 */
const RECONSTRUTORES_INJETADOS = ['renderVizGroup'];
const reconstroiPorMarkup = (f) => linhasDeCodigo(fonte(f)).some(([, l]) =>
  /\.innerHTML\s*=/.test(l) || RECONSTRUTORES_INJETADOS.some((n) => new RegExp(n + '\\s*\\(').test(l)));

/**
 * ⚠️ REBUILDING IS ALSO DONE IN NODES — AND THAT IS HOW THIS SIEVE QUIETLY STOPPED WATCHING FIVE OF EIGHT PANELS.
 *
 * 📏 Measured on 2026-09-23, with the kit adoption of ADR-0129 closed: the question above asks only for
 * `.innerHTML =`, and the conversion replaced exactly that. `-caa`, `-typo`, `-visual`, `-motion` and `-audio`
 * now build their rows as NODES, so the answer for all five became `false` — and the `[Zero]` case walked past
 * them asserting nothing, GREEN. Nothing ever went red: the gate simply stopped covering the very panels the
 * conversion touched, one commit at a time. It is the shape this repository has already met three times in
 * ledgers — a key that stops matching stops requiring — and the first time it has bitten a PREDICATE.
 *
 * 📌 And the requirement did not leave with the markup. A row BORN as a node after `fillExplain` has already run
 * carries its `.opt-hint` visible exactly like a row born from a string; what changed is only who wrote it,
 * which is the same mistake the injected-rebuilder note above was written to fix.
 */
const CRIADORES_DO_KIT = ['controlRow', 'sectionHeader', 'mountSteps'];
const constroiNos = (f) => linhasDeCodigo(fonte(f)).some(([, l]) =>
  /\bcreateElement\s*\(|\bcriar\s*\(/.test(l) || CRIADORES_DO_KIT.some((n) => new RegExp('\\b' + n + '\\s*\\(').test(l)));

const reconstroi = (f) => reconstroiPorMarkup(f) || constroiNos(f);

/**
 * ⚠️ A CHAMADA, E NÃO A MENÇÃO — e a diferença foi medida, não suposta.
 *
 * A primeira versão deste crivo procurava a palavra `fillExplain` em qualquer linha de código. Uma mutação
 * que APAGOU a chamada de `settings-visual` passou verde: o campo `fillExplain?:` na interface do `ctx`
 * bastava para satisfazer o regex. O gate media que o painel CONHECIA o nome, não que o usava — que é
 * exatamente o tipo de verde que não prova nada.
 *
 * Agora exige a forma da invocação: `fillExplain(` ou `fillExplain?.(`. Declarar o campo deixou de contar.
 */
const reexplica = (f) => linhasDeCodigo(fonte(f)).some(([, l]) => /fillExplain\s*\??\.?\s*\(/.test(l));

describe('painel que reconstrói linhas repõe a prosa no rodapé (CLAUDE.md §4, issue #109)', () => {
  it('[Interface] a varredura acha os painéis, e a casca fica de fora', () => {
    expect(PAINEIS.length).toBeGreaterThanOrEqual(7);
    expect(PAINEIS).not.toContain('settings-panel.ts');
  });

  it('⚠️ [Zero] NENHUM painel reconstrói markup sem saber repor a prosa', () => {
    const mudos = PAINEIS.filter((f) => reconstroi(f) && !reexplica(f));
    expect(mudos, 'reconstrói as linhas e a explicação volta para dentro delas no primeiro clique').toEqual([]);
  });

  it('⚠️ [Interface] o reconstrutor injetado da lista RECONSTRÓI MESMO — a isenção era sobre ele', () => {
    // A lista `RECONSTRUTORES_INJETADOS` é uma afirmação sobre OUTRO módulo, e afirmação sobre outro módulo
    // é a que apodrece sem ninguém reparar: se um dia `renderVizGroup` passasse a atualizar por
    // `textContent`, o nome ficaria na lista a obrigar painéis a uma chamada que já não faz falta — e o
    // gate viraria a cerimónia que ele existe para não ser.
    //
    // Este caso lê o outro lado. É a lição do `teste-que-lê-pela-ligação`: nomear o literal não basta,
    // é preciso exigir que o que ele nomeia continue a ser o que era.
    const VIZ = join(RAIZ_REPO, 'app', 'js', 'render', 'viz-setters.ts');
    const corpo = readFileSync(VIZ, 'utf8').split(CR).join('');
    const isInside = corpo.slice(corpo.indexOf('function renderVizGroup('));
    expect(isInside, 'renderVizGroup deixou de reconstruir; rever RECONSTRUTORES_INJETADOS')
      .toMatch(/\.innerHTML\s*=/);
  });

  it('⚠️ [Interface] os construtores do KIT criam nós mesmo — a segunda afirmação sobre outro módulo', () => {
    // Same lesson as the case above, applied to the list this commit added: `CRIADORES_DO_KIT` is a claim about
    // `ui/panel-widgets`, and a claim about another module is the one that rots unnoticed. `labelRow` and
    // `updateSteps` are deliberately NOT here — they rewrite rows that already exist, and a panel that only
    // relabels does not undo `fillExplain`.
    // ⚠️ E O CORPO SAI DO PARSER, não de um `indexOf` até ao próximo `export`. A primeira versão fatiava assim
    // e a fatia de `labelRow` engolia o `criarControle` privado que vem a seguir — uma mutação que listava o
    // `labelRow` como criador passou VERDE. É a quinta vez que um varredor à mão erra por não saber onde uma
    // construção acaba, e a resposta desta casa já está escrita: quem sabe é o `typescript`.
    const KIT = join(UI, 'panel-widgets.ts');
    const fonteDoKit = readFileSync(KIT, 'utf8');
    const arvore = ts.createSourceFile(KIT, fonteDoKit, ts.ScriptTarget.Latest, true);
    const corpos = new Map();
    arvore.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name) corpos.set(node.name.text, node.getText(arvore));
    });
    for (const n of CRIADORES_DO_KIT) {
      expect(corpos.has(n), `${n} deixou de ser uma função do kit; rever CRIADORES_DO_KIT`).toBe(true);
      expect(corpos.get(n), `${n} deixou de criar nós; rever CRIADORES_DO_KIT`).toMatch(/\bcriar\s*\(/);
    }
  });

  it('⚠️ [Zero] o crivo ALCANÇA os oito painéis — nenhum sai da vigilância em silêncio', () => {
    // 📏 Este caso existe porque a cobertura JÁ encolheu de 8 para 3 sem uma única falha, à medida que a
    // conversão para nós apagava os `innerHTML` que o crivo procurava. Medir a cobertura é o que transforma
    // esse encolhimento numa falha em vez de num silêncio.
    const forade = PAINEIS.filter((f) => !reconstroi(f));
    expect(forade, 'painel que nenhuma das duas formas de reconstrução alcança').toEqual([]);
  });

  it('[Boundary] e um painel que NÃO reconstrói não é obrigado a nada', () => {
    // A isenção continua a existir e continua a ser certa: um painel que só troque `textContent` em
    // elementos que já existem não desfaz o trabalho do `fillExplain`, e exigir-lhe a chamada seria
    // cerimónia — que é o que faz um gate ser contornado em vez de cumprido.
    //
    // ⚠️ O que mudou é QUEM cabe aqui. A versão anterior escrevia, como exemplo, que o `settings-empathy`
    // «atualiza por `textContent` em elementos que já existem» — e isso era falso: ele delega a
    // reconstrução da lista ao `renderVizGroup`. Hoje o conjunto está VAZIO, e um conjunto vazio é uma
    // resposta legítima: os oito painéis reconstroem, de uma das duas maneiras.
    const soTexto = PAINEIS.filter((f) => !reconstroi(f));
    for (const f of soTexto) {
      expect(reconstroi(f), `${f} passou a reconstruir e este caso não notou`).toBe(false);
    }
  });

  it('⚠️ [Cross-check] o crivo PEGA o defeito real, e não conta prosa que o menciona', () => {
    // Sem isto, o `[Zero]` podia estar verde por o regex não casar nada. As duas amostras são as formas
    // exatas que o repositório usa.
    const comoOsCinco = 'el.innerHTML = catsListHTML(keys, ctx.audioCats, state);';
    const comoOConserto = "ctx.fillExplain?.(ctx.$('#typo .overlay__card'));";
    expect(/\.innerHTML\s*=/.test(comoOsCinco)).toBe(true);
    expect(/fillExplain/.test(comoOConserto)).toBe(true);
    expect(linhasDeCodigo('// o painel chama fillExplain a cada innerHTML = ...'),
      'prosa que menciona as duas coisas não pode contar como código').toEqual([]);
  });
});
