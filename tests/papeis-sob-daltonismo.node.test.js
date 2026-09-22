// SPDX-License-Identifier: AGPL-3.0-or-later
// AS QUATRO CORES DE PAPEL CONTINUAM DIFERENTES PARA QUEM NÃO DISTINGUE CORES (issue #12, item 4).
//
// ========================= A PERGUNTA, E POR QUE ELA PRECISAVA DE MEDIÇÃO =========================
// O ADR-0011 decide *color-blocking*: no alto contraste, o PAPEL de um tile é dito pela cor — perigo é
// laranja-quente, escalável é ciano, água é azul, portão é magenta. A issue #12 pede o «estudo protan/deutan,
// para além da luminância», e a pergunta que ele responde é exactamente esta: **um daltónico continua a ver
// quatro papéis, ou dois deles colapsam num só?**
//
// Se colapsarem, a criança perde a informação que a cor carregava — e perde-a em silêncio, porque o jogo
// continua a desenhar quatro cores distintas para quem as distingue.
//
// ========================= ⚠️ A PRIMEIRA MEDIÇÃO QUE EU FIZ ESTAVA ERRADA =========================
// Comecei por medir a RAZÃO DE CONTRASTE (WCAG) entre os pares, que é a ferramenta que este repositório já
// tinha à mão — e ela deu um alarme falso enorme: `hazard × water` a 1,16:1 **sem simulação nenhuma**, e
// `hazard × water` a 1,00:1 sob tritanopia.
//
// A razão de contraste vê SÓ LUMINÂNCIA. E a paleta de papéis separa por MATIZ de propósito — é isso que
// *color-blocking* significa. Medir luminância nela é perguntar a pergunta errada com muita precisão: ela
// diria «indistinguíveis» sobre duas cores que qualquer pessoa separa num relance.
//
// O que responde é o **ΔE** (CIE76, em Lab), que é distância PERCEBIDA e vê matiz, saturação e luminância.
// Fica registado porque a versão errada teria produzido um gate que exigia da paleta uma propriedade que ela
// nunca prometeu — e que, para a cumprir, obrigaria a desfazer o color-blocking.
//
// ========================= O QUE FOI MEDIDO (2026-09-07) =========================
// O par mais apertado de cada visão, aplicando as matrizes de `render/cvd-matrices` à paleta de
// `render/hc-role-data`:
//
//     visão típica     ΔE 57,6   (water × gate)
//     protanopia       ΔE 25,1   (water × gate)
//     deuteranopia     ΔE 14,6   (water × gate)   ← o mais apertado dos doze
//     tritanopia       ΔE 29,2   (hazard × gate)
//
// ✅ **Nenhum papel colapsa noutro.** O color-blocking sobrevive às três simulações. O par a vigiar é
// água×portão sob deuteranopia, que é onde o azul e o magenta se aproximam mais.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { HC_ROLE_DEF, HC_ROLE_KEYS } from '../app/js/render/hc-role-data.js';
import { CVD_MATRIX } from '../app/js/render/cvd-matrices.js';
import { razaoDeContraste } from './fixtures/contraste-wcag.js';

/** As três SIMULAÇÕES — é o que uma pessoa daltónica vê. As `fix-*` são correcções e não entram aqui. */
const SIMULATIONS = ['sim-protan', 'sim-deuter', 'sim-tritan'];

/**
 * Aplica uma `feColorMatrix` (4 linhas de 5: R,G,B,A,offset) a um RGB 0-255.
 * É a MESMA matriz que o SVG usa em produção — se ela mudar, esta conta muda com ela.
 */
function aplicar([r, g, b], m) {
  const n = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const [R, G, B] = [r / 255, g / 255, b / 255];
  return [
    n(m[0] * R + m[1] * G + m[2] * B + m[4]),
    n(m[5] * R + m[6] * G + m[7] * B + m[9]),
    n(m[10] * R + m[11] * G + m[12] * B + m[14]),
  ];
}

/* ===================== ΔE (CIE76), a distância PERCEBIDA =====================
 * Mora aqui e não numa fixture porque só este gate a usa. Move-se para `tests/fixtures/` no dia em que um
 * segundo precisar dela — que foi exactamente o caminho da conta da WCAG, e a regra que o justificou é a
 * mesma: não se importa um ficheiro de teste a partir de outro. */
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function lab([r, g, b]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function deltaE(a, b) {
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Todos os pares de papéis, na visão dada (`null` = típica). */
function paresDe(matriz) {
  const vistas = Object.fromEntries(HC_ROLE_KEYS.map((k) => [k, matriz ? aplicar(HC_ROLE_DEF[k], matriz) : HC_ROLE_DEF[k]]));
  const out = [];
  for (let i = 0; i < HC_ROLE_KEYS.length; i++) {
    for (let j = i + 1; j < HC_ROLE_KEYS.length; j++) {
      const [a, b] = [HC_ROLE_KEYS[i], HC_ROLE_KEYS[j]];
      out.push({ nome: `${a}×${b}`, de: deltaE(vistas[a], vistas[b]) });
    }
  }
  return out;
}

/**
 * O piso de separação. Hoje o pior par mede 14,6 (água×portão sob deuteranopia); 12 dá a folga de uma
 * mudança pequena e reprova uma colisão de verdade.
 *
 * ⚠️ NÃO É UM ALVO DE QUALIDADE — é o ponto abaixo do qual dois papéis deixam de ser dois. Para referência:
 * ΔE ≈ 1 é o limiar de percepção em condições ideais; num tile de pixel-art visto de longe, quer-se muito
 * mais do que isso, e é por isso que 12 é um PISO e não uma meta.
 */
const PISO_DE_SEPARACAO = 12;

describe('color-blocking sobrevive ao daltonismo (ADR-0011, issue #12)', () => {
  it('[Zero] a paleta e as matrizes existem, e o crivo vê os quatro papéis', () => {
    expect(HC_ROLE_KEYS.length).toBe(4);
    for (const k of HC_ROLE_KEYS) expect(HC_ROLE_DEF[k], `${k} sem cor`).toHaveLength(3);
    for (const s of SIMULATIONS) expect(CVD_MATRIX[s], `${s} sem matriz`).toHaveLength(20);
    expect(paresDe(null)).toHaveLength(6); // 4 papéis = 6 pares
  });

  it('⚠️ [Right] nenhum par de papéis colapsa, em NENHUMA das três visões', () => {
    const apertados = [];
    for (const sim of [null, ...SIMULATIONS]) {
      const rotulo = sim ?? 'visão típica';
      for (const { nome, de } of paresDe(sim ? CVD_MATRIX[sim] : null)) {
        if (de < PISO_DE_SEPARACAO) apertados.push(`${rotulo}: ${nome} ΔE ${de.toFixed(1)}`);
      }
    }
    expect(apertados, 'dois papéis viraram um só:\n  ' + apertados.join('\n  ')).toEqual([]);
  });

  it('[Boundary] o par mais apertado é água×portão sob deuteranopia — e é o que se vigia', () => {
    const pior = paresDe(CVD_MATRIX['sim-deuter']).sort((a, b) => a.de - b.de)[0];
    expect(pior.nome).toBe('water×gate');
    expect(pior.de).toBeGreaterThan(PISO_DE_SEPARACAO);
    expect(pior.de).toBeLessThan(20); // se subir daqui, alguém melhorou a paleta e este número desce
  });

  it('⚠️ [Interface] a RAZÃO DE CONTRASTE é a ferramenta ERRADA aqui, e o caso prova-o com número', () => {
    // ⚠️ Este caso existe para que ninguém «conserte» este gate para a métrica que o repositório já tinha à
    // mão. A razão de contraste vê SÓ luminância; a paleta de papéis separa por MATIZ, de propósito — é isso
    // que color-blocking significa.
    //
    // `hazard` (laranja) e `water` (azul) são duas cores que qualquer pessoa separa num relance, e a razão de
    // contraste entre elas é 1,16:1 — que, lida como separação, diria «indistinguíveis». O ΔE diz 129.
    //
    // Um gate construído sobre a razão de contraste exigiria da paleta uma propriedade que ela nunca
    // prometeu, e cumpri-la obrigaria a DESFAZER o color-blocking, empurrando os papéis para luminâncias
    // diferentes — quer dizer, a piorar a coisa que o gate deveria proteger.
    const laranja = HC_ROLE_DEF.hazard, azul = HC_ROLE_DEF.water;
    expect(razaoDeContraste(laranja, azul)).toBeLessThan(1.5);
    expect(deltaE(laranja, azul)).toBeGreaterThan(100);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · pondo `water: [200, 60, 210]` (quase o magenta do portão) em `hc-role-data` → "[Right] nenhum par
//     colapsa" reprova nas QUATRO visões, e "[Boundary]" reprova junto. É o defeito que o gate existe para
//     apanhar: dois papéis a virar um.
//   · trocando a matriz `sim-deuter` pela identidade → "[Boundary] o par mais apertado" reprova, porque sob
//     visão típica o par mais próximo é outro (water×gate a ΔE 57,6, acima do tecto de 20 do caso).
//   · trocando `deltaE` por `razaoDeContraste` no crivo de pares → "[Right] nenhum par colapsa" reprova em
//     TODAS as visões, incluindo a típica. ⚠️ É a mutação mais instrutiva: ela mostra que a métrica errada
//     não falha por pouco, falha por completo — e que um gate assim teria sido lido como «a paleta está
//     partida» quando o partido era o gate.
