// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/wcag-contrast — A CONTA DA WCAG, escrita aqui e em nenhum outro lugar.
//
// Saiu de dentro de `contraste-menu.node.test.js` em 2026-09-07, quando um SEGUNDO gate passou a precisar
// dela (a marca de "saiu do padrão", ADR-0029 / issue #61). O ficheiro de origem já dizia «escrita aqui e em
// nenhum outro lugar» e já EXPORTAVA a função — a exportação estava lá havia semanas sem um único
// importador, à espera exactamente disto.
//
// ⚠️ E NÃO SE IMPORTA UM FICHEIRO DE TESTE A PARTIR DE OUTRO, que era o atalho óbvio: importar
// `contraste-menu.node.test.js` traria os `describe` dele para dentro do importador e as mesmas asserções
// correriam duas vezes, com dois nomes. Um helper é um módulo; um ficheiro de teste é um efeito colateral.
//
// A conta é a da WCAG 2.x §1.4.3 (relative luminance + contrast ratio), e vale igual para 1.4.11 (contraste
// de componente não-textual) — o que muda entre os critérios é o ALVO, não a aritmética. Quem consome
// escolhe o alvo e nomeia o par; este ficheiro não tem opinião sobre nenhum dos dois.

/** Canal sRGB → linear. É a etapa que separa "clarinho" de LUMINÂNCIA — sem ela a conta erra feio no escuro. */
function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminancia([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** A razão entre duas cores `[r,g,b]`, na ordem que der: a fórmula já ordena por luminância. */
export function razaoDeContraste(a, b) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `#rgb` ou `#rrggbb` → `[r,g,b]`. */
export function hex(s) {
  const h = s.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

/**
 * Lê `--nome:#rrggbb` de uma folha de estilo, a partir de `desde` (índice de caractere).
 *
 * ⚠️ O `desde` é o que torna esta função utilizável no ALTO CONTRASTE. Os tokens do tema base vivem no
 * `:root` do topo do ficheiro e os do `@media (prefers-contrast: more)` REDECLARAM os mesmos nomes mais
 * abaixo. Uma busca do início devolve sempre o primeiro, e um gate que julgasse o alto contraste com os
 * valores do tema base estaria a medir o tema errado sem que nada denunciasse.
 *
 * Lança — não devolve `undefined` — quando o token não existe: medir `undefined` dá um `NaN` que atravessa
 * a comparação em silêncio e sai verde.
 */
export function lerToken(css, nome, desde = 0) {
  const m = css.slice(desde).match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{3,8})'));
  if (!m) throw new Error(`token --${nome} não existe no style.css a partir do índice ${desde}`);
  return hex(m[1]);
}
