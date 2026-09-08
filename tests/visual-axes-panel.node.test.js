// SPDX-License-Identifier: AGPL-3.0-or-later
// O MENU VISUAL COM DOIS CONTROLES (#104, ADR-0076) — a metade pura.
//
// ⚠️ O QUE AUTORIZA ESTA MUDANÇA está escrito no próprio `ui/settings-visual`, e continua verdadeiro sobre o
// dia em que foi escrito: «Os sete vivem num CONTROLE SÓ… `p.viz` guarda UM valor. Dois controles separados
// se sobrescreveriam em silêncio.» A razão que ele dá DEIXOU DE EXISTIR — o campo já não guarda um valor, e
// os escritores por eixo mexem num sem tocar no outro. O controle único contava uma exclusividade REAL;
// mantê-lo agora contaria uma que já não existe.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  eixosHtml, linhasDoEixo, escolhaDoBotao, ROTULO_DO_TEMA, ROTULO_DA_CORRECAO,
} from '../app/js/ui/visual-axes-panel.js';
import { TEMAS, CORRECOES, PADRAO } from '../app/js/render/viz-axes.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const t = (k) => pt[k] ?? k;

describe('ui/visual-axes-panel · dois eixos, dois rádios', () => {
  it('⚠️ [Right] os DOIS grupos saem, e cada valor de cada eixo tem a sua linha', () => {
    const html = eixosHtml(PADRAO, t);
    for (const v of TEMAS) expect(html, `falta o tema «${v}»`).toContain(`data-eixo="tema" data-valor="${v}"`);
    for (const v of CORRECOES) expect(html, `falta a correção «${v}»`).toContain(`data-eixo="correcao" data-valor="${v}"`);
  });

  it('⚠️ [Right] o marcado de um eixo é o do ESTADO daquele eixo, e não o do outro', () => {
    // É a asserção que prova que os dois rádios são dois. Com um campo só, marcar `hc7` obrigaria a
    // desmarcar `deuter` — e era isso que a criança perdia sem nada dizer.
    const html = eixosHtml({ tema: 'hc7', correcao: 'deuter', simulacao: null }, t);
    expect(html).toContain('data-eixo="tema" data-valor="hc7"');
    expect(html).toContain('data-eixo="correcao" data-valor="deuter"');
    const marcados = [...html.matchAll(/aria-checked="true"[\s\S]{0,80}?data-valor="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(marcados), 'os dois eixos não estão marcados ao mesmo tempo').toEqual(new Set(['hc7', 'deuter']));
  });

  it('[Right] cada eixo marca EXACTAMENTE um', () => {
    for (const tema of TEMAS) {
      const html = linhasDoEixo('tema', TEMAS, ROTULO_DO_TEMA, tema, t);
      expect((html.match(/aria-checked="true"/g) ?? []).length, tema).toBe(1);
    }
  });

  it('[Right] mantém a forma de LINHA VISÍVEL, e não uma caixa fechada', () => {
    // O `settings-visual` regista o erro que o Dev apanhou na primeira tentativa: dentro de um `<select>`,
    // um controle cuja razão de existir é ser ACHADO por quem enxerga mal fica «quase o mesmo que não ter
    // movido».
    const html = eixosHtml(PADRAO, t);
    expect(html).not.toContain('<select');
    expect(html).toContain('class="ctrl-row"');
    expect(html).toContain('role="radio"');
  });
});

describe('ui/visual-axes-panel · os nomes dos padrões', () => {
  it('⚠️ [Interface] NENHUM rótulo de padrão diagnostica quem lê', () => {
    // A última caixa da definition of done do ADR-0076: «modo sem deficiência visual» foi oferecido e
    // RECUSADO — ele diz à criança o que ela NÃO é, no menu que ela abriu para conseguir jogar. Um padrão
    // chama-se pelo que ele É.
    for (const dic of [pt, en, es]) {
      for (const chave of [ROTULO_DO_TEMA.padrao, ROTULO_DA_CORRECAO.tricro]) {
        const txt = dic[chave];
        expect(txt, `«${chave}» falta`).toBeTruthy();
        expect(txt, `«${txt}» diagnostica quem lê`).not.toMatch(/sem defici|no defici|sin defici|normal/i);
      }
    }
  });

  it('⚠️ [Interface] os dois padrões têm nome PRÓPRIO, e não o neutro partilhado', () => {
    // «Modo padrão» (`viz.normal`) era o neutro de quando os dois eixos eram um só. Com dois controles, um
    // «padrão» sem dizer padrão de QUÊ fica ambíguo nos dois — o ADR nomeia-os por isso.
    expect(ROTULO_DO_TEMA.padrao).not.toBe('viz.normal');
    expect(ROTULO_DA_CORRECAO.tricro).not.toBe('viz.normal');
    expect(pt[ROTULO_DO_TEMA.padrao]).not.toBe(pt[ROTULO_DA_CORRECAO.tricro]);
  });

  it('[Interface] todo rótulo dos dois eixos existe nos TRÊS idiomas', () => {
    for (const [nome, dic] of Object.entries({ pt, en, es })) {
      for (const chave of [...Object.values(ROTULO_DO_TEMA), ...Object.values(ROTULO_DA_CORRECAO)]) {
        expect(dic[chave], `«${chave}» falta em ${nome}`).toBeTruthy();
      }
    }
  });
});

describe('ui/visual-axes-panel · o que um clique quer dizer', () => {
  it('[Right] lê o eixo e o valor do botão', () => {
    expect(escolhaDoBotao({ eixo: 'tema', valor: 'hc7' })).toEqual({ eixo: 'tema', valor: 'hc7' });
    expect(escolhaDoBotao({ eixo: 'correcao', valor: 'deuter' })).toEqual({ eixo: 'correcao', valor: 'deuter' });
  });

  it('⚠️ [Zero] botão de outro assunto, eixo inventado ou valor de OUTRO eixo devolvem `null`', () => {
    // O painel tem outros botões (cores de papel, reset), e um `data-valor` sem `data-eixo` é de um deles.
    // ⚠️ E o cruzado é o que mais importa: `{eixo:'tema', valor:'deuter'}` escreveria uma correção no campo
    // do tema — um estado que o tipo não admite, chegando por um atributo de DOM que qualquer um pode editar.
    expect(escolhaDoBotao({})).toBeNull();
    expect(escolhaDoBotao({ eixo: 'roxo', valor: 'hc7' })).toBeNull();
    expect(escolhaDoBotao({ eixo: 'tema' })).toBeNull();
    expect(escolhaDoBotao({ eixo: 'tema', valor: 'deuter' }), 'aceitou uma correção no eixo do tema').toBeNull();
    expect(escolhaDoBotao({ eixo: 'correcao', valor: 'hc7' }), 'aceitou um tema no eixo da correção').toBeNull();
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · tirando o segundo grupo do `eixosHtml` -> reprovam DOIS. E o estado de hoje: um controle so, que com
//     dois eixos deixaria a correcao sem onde ser escolhida.
//   · `const sel = valor === valores[0]` (marca sempre o padrao, ignorando o estado) -> reprova o caso do
//     marcado por eixo. A crianca veria o menu a dizer que ela esta no padrao enquanto o jogo mostra outra
//     coisa — e o menu que ela abriu para se orientar passaria a desorientar.
//   · tirando a validacao cruzada do `escolhaDoBotao` -> reprova o caso do Zero. `{eixo:'tema',
//     valor:'deuter'}` escreveria uma correcao no campo do TEMA: um estado que o tipo nao admite, chegando
//     por um atributo de DOM que qualquer um pode editar.
//   · apontando o rotulo do tema padrao de volta para `viz.normal` -> reprova o caso dos nomes proprios.
//     «Modo padrao» era o neutro PARTILHADO de quando os dois eixos eram um so; com dois controles, um
//     «padrao» sem dizer padrao de QUE fica ambiguo nos dois.
//
// ⚠️ E UMA MUTACAO MINHA SAIU NULA, registada porque a licao vale: envolver `atual` num `String()` quando ele
// ja e string nao muda nada, entao o verde nao dizia nada sobre o gate. Uma mutacao que nao pode falhar nao
// e' prova de cobertura — e' so uma edicao. Foi trocada pela de cima, que muda comportamento a serio.
