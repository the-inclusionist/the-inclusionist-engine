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

/** Reconstrói markup? `innerHTML =` é a forma que este projeto usa, e a que faz a prosa voltar. */
const reconstroi = (f) => linhasDeCodigo(fonte(f)).some(([, l]) => /\.innerHTML\s*=/.test(l));

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

  it('[Boundary] e um painel que NÃO reconstrói não é obrigado a nada', () => {
    // `settings-empathy` atualiza por `textContent` em elementos que já existem: a prosa já foi movida e
    // continua movida. Exigir-lhe a chamada seria cerimónia — e cerimónia é o que faz um gate ser
    // contornado em vez de cumprido.
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
