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
 * Só ANTES da água — os itens se espalham pelo trecho seco e não passam da placa.
 *
 * `aguaX` nulo = cenário sem água, e então o mapa inteiro serve.
 */
export function podeNascerEm(x: number, aguaX: number | null): boolean {
  return aguaX === null || x < aguaX;
}

/* ===================== A PLACA, E POR QUE ELA É BARREIRA E NÃO PENALIDADE =====================
 *
 * No alto da plataforma depois do pula-pula, antes da água, há uma placa de PROIBIDO JOGAR LIXO. Ela faz duas
 * coisas, e nenhuma delas é punir:
 *
 *   · quem passa por ali carregando lixo SOLTA o lixo, sozinho;
 *   · lixo arremessado para a frente bate numa barreira invisível na linha da placa e VOLTA.
 *
 * ⚠️ E O MOTIVO É O MAIS FINO DESTE MÓDULO, nas palavras do Dev: "a criança não pode escolher ter um
 * comportamento ruim, visto que a perda de pontos ainda é vista como RECOMPENSA para crianças que estão
 * procurando fazer uma má ação por um motivo como estar irritada com o professor ou com o jogo."
 *
 * Isso desmonta a solução óbvia. O reflexo de quem desenha jogo é: jogou lixo na água, perde ponto. Mas para a
 * criança que quer transgredir, a penalidade É o efeito procurado — ela confirma que a transgressão funcionou, e
 * o jogo passa a oferecer exatamente o que ela veio buscar. Um número que desce é feedback tão bom quanto um que
 * sobe quando o que se quer é reação.
 *
 * A barreira não julga e não reage: ela simplesmente não deixa acontecer. Sem punição, sem sermão, sem tela de
 * aviso — porque cada um desses seria uma resposta, e resposta é o prêmio. */

/** O que a placa faz com o lixo que chega até ela. */
export type EfeitoDaPlaca = 'solta' | 'volta' | 'nada';

/**
 * O personagem cruzou a linha da placa carregando lixo? Então ele o SOLTA ali.
 *
 * `placaX` nulo = cenário sem placa (sem água), e nada acontece.
 */
export function efeitoAoPassar(x: number, placaX: number | null, carregando: boolean): EfeitoDaPlaca {
  if (!carregando || placaX === null) return 'nada';
  return x >= placaX ? 'solta' : 'nada';
}

/**
 * O lixo arremessado atravessa a placa? NUNCA — ele bate na barreira invisível e volta.
 *
 * A barreira é UMA LINHA e não uma caixa: o que decide é o x de destino, não a trajetória, porque um arremesso
 * em arco pode passar por cima de uma barreira baixa e cair na água do outro lado. Barreira que se pula não é
 * barreira; é uma dificuldade a mais para a criança que já resolveu transgredir.
 */
export function arremessoAtravessa(destinoX: number, placaX: number | null): boolean {
  return placaX === null || destinoX < placaX;
}
