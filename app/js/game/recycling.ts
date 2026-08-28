// SPDX-License-Identifier: AGPL-3.0-or-later
// game/recycling — quatro materiais, quatro lixeiras, e um ponto que NÃO move nada.
//
// ========================= O DESENHO, NAS PALAVRAS DO DEV =========================
// "Coloque uma latinha de alumínio, uma garrafa pet de plástico, um pote de vidro e uma caixa de papelão,
// espalhadas aleatoriamente pelo ambiente porém nada depois da parte com água, somente antes, feito moedas, mas
// na altura do chão. No canto inferior esquerdo do mapa, 4 lixeiras: azul para papel, vermelha para plástico,
// amarela para metal e verde para vidro. Para item colocado na lixeira correta o jogador ganha um ponto."
//
// ========================= O PONTO É DE COMPORTAMENTO, E ISSO É A DECISÃO =========================
// "Lata na lixeira é boa ação, pontos na barra segmentada só via minigames."
//
// Pelo ADR-0049 §1, ponto registra que a pessoa TRABALHOU e não move nada: não pinta a barra de dez segmentos,
// não muda nível, não alimenta a adaptação. É exatamente isso que torna seguro uma boa ação valer ponto — se
// pintasse a barra, uma criança boa de plataforma subiria de nível ESCOLAR sem ter respondido nada.
//
// Por isso `Descarte` devolve `segmentoDaBarra` e `mudaNivel` EXPLICITAMENTE, sempre nulos. Poderiam
// simplesmente não existir; existem para que a próxima pessoa que ligar isto ao placar veja a decisão em vez de
// ter de deduzi-la, e para que o gate possa afirmá-la.
//
// ========================= AS CORES SÃO CONTEÚDO, NÃO PALETA =========================
// Azul/papel, vermelho/plástico, amarelo/metal e verde/vidro são a Resolução CONAMA 275/2001, que é o padrão das
// lixeiras da rua brasileira. A criança que aprende a cor aqui reconhece a de fora — e é isso que faz disto
// conteúdo da BNCC e não decoração. Trocar uma cor por gosto ensina errado.

/** Os quatro materiais que aparecem no cenário. */
export const MATERIAIS = ['papel', 'plastico', 'metal', 'vidro'] as const;
export type Material = typeof MATERIAIS[number];

/** As quatro cores de lixeira, no padrão CONAMA 275/2001. */
export const LIXEIRAS = ['azul', 'vermelha', 'amarela', 'verde'] as const;
export type Lixeira = typeof LIXEIRAS[number];

/** O objeto de cada material, para quem for desenhar: latinha, garrafa PET, pote e caixa. */
export const OBJETO_DE: Readonly<Record<Material, string>> = Object.freeze({
  papel: 'caixa de papelão',
  plastico: 'garrafa PET',
  metal: 'latinha de alumínio',
  vidro: 'pote de vidro',
});

/** Qual lixeira recebe cada material. */
export const LIXEIRA_DE: Readonly<Record<Material, Lixeira>> = Object.freeze({
  papel: 'azul',
  plastico: 'vermelha',
  metal: 'amarela',
  vidro: 'verde',
});

/** O que aconteceu ao soltar um material numa lixeira. */
export interface Descarte {
  acertou: boolean;
  /** 1 no acerto, 0 no erro. **Nunca negativo** — ver abaixo. */
  pontos: number;
  /** SEMPRE `null`: boa ação não entra na barra de dez segmentos (ADR-0049 §5). */
  segmentoDaBarra: null;
  /** SEMPRE `false`: boa ação não move a dificuldade acadêmica (ADR-0048 §5). */
  mudaNivel: false;
}

/**
 * Descarta um material numa lixeira.
 *
 * ⚠️ ERRAR NÃO TIRA PONTO, e isso é decisão e não esquecimento. O ADR-0049 recusa mecânica que pune, e a lixeira
 * errada é o momento em que a criança descobre qual é a certa — não o momento de perder o que ela já fez. Uma
 * penalidade aqui ensinaria a não tentar, que é o oposto do conteúdo.
 */
export function descartar(material: Material, lixeira: string): Descarte {
  const acertou = LIXEIRA_DE[material] === lixeira;
  return { acertou, pontos: acertou ? 1 : 0, segmentoDaBarra: null, mudaNivel: false };
}

/**
 * Este x pode receber um item?
 *
 * Só ANTES da água. A regra é do Dev e tem motivo de jogo: item que cai na água some ou fica inalcançável, e a
 * criança perderia um ponto por geometria em vez de por escolha — que é o tipo de injustiça que uma criança lê
 * como "o jogo é contra mim".
 *
 * `aguaX` nulo = cenário sem água, e então o mapa inteiro serve.
 */
export function podeNascerEm(x: number, aguaX: number | null): boolean {
  return aguaX === null || x < aguaX;
}
