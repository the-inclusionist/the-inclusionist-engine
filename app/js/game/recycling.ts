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

// ⚠️ O NOME DE CADA OBJETO SAIU DAQUI e virou dicionário (`lixo.obj.*` em `i18n/`), junto com o nome de cada
// cor (`lixo.cor.*`). Ele existia como um `OBJETO_DE` de texto pt-BR cravado neste arquivo, sem consumidor —
// e um nome que vai para a tela em pt-BR dentro de código de jogo é o pilar 3 quebrado em silêncio: o piso
// são TRÊS idiomas, e o que a criança ouve tem de nascer localizável. Quem anuncia (a raiz de composição)
// traduz `material` e `cor` na hora; este módulo continua sem saber que existe língua.

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
 * No alto da plataforma antes da água há uma placa de PROIBIDO JOGAR LIXO. O que ela faz, na formulação
 * corrigida pelo Dev em 2026-08-28, é UMA coisa só, e é sobre a criança e não sobre o objeto:
 *
 *   "Se estiver segurando lixo o jogador não pode seguir adiante após a placa. Se deixar cair o lixo, ele
 *   está desobedecendo a placa, se lançar o lixo, também. Uma vez que segura o lixo ele só poderá soltar na
 *   lixeira e não poderá seguir após a placa. Ou seja, pegar o lixo trava ele de soltá-lo ou arremessá-lo."
 *
 * ⚠️ E O MOTIVO CONTINUA SENDO O MESMO, que é o mais fino deste módulo: "a criança não pode ESCOLHER ter um
 * comportamento ruim, visto que a perda de pontos ainda é vista como RECOMPENSA para crianças que estão
 * procurando fazer uma má ação por um motivo como estar irritada com o professor ou com o jogo."
 *
 * Isso desmonta a solução óbvia. O reflexo de quem desenha jogo é: jogou lixo na água, perde ponto. Mas para
 * a criança que quer transgredir, a penalidade É o efeito procurado — ela confirma que a transgressão
 * funcionou. Um número que desce é feedback tão bom quanto um que sobe quando o que se quer é reação.
 *
 * ⚠️ A PRIMEIRA VERSÃO ERROU O ALVO DA BARREIRA, e vale registrar porque o erro é sedutor: ela barrava o
 * LIXO — quem cruzava a linha soltava o item ali, e o arremesso batia numa parede invisível. Só que soltar
 * o lixo JÁ É desobedecer. Barrar o objeto deixava a desobediência acontecer e depois consertava a
 * consequência; barrar a CRIANÇA faz a desobediência não ter por onde começar. E de quebra o mecanismo fica
 * legível: ela vê a placa, sente que não passa, e a relação entre as duas coisas é imediata.
 *
 * Por isso PEGAR LIXO TRAVA: com lixo na mão não há soltar e não há arremessar (ver `game/carry`), e a
 * única saída é a lixeira. */

/**
 * A BARREIRA DA PLACA — e ela é um SEGMENTO, não uma linha infinita.
 *
 * ⚠️ DECIDIDO PELO DEV EM 2026-08-28, depois de a primeira versão barrar a coluna inteira: "a barreira deve
 * valer só do piso da placa até o próximo tile sólido acima da placa."
 *
 * O motivo é o mesmo que faz a placa existir. Uma linha que atravessa o mapa de cima a baixo barra a criança
 * em andares onde a placa nem é visível — ela bate numa parede invisível, e o jogo vira um defeito aos olhos
 * dela. Barrando só o vão em que a placa está PLANTADA, a barreira e o aviso passam a ocupar o mesmo lugar:
 * onde ela não passa, ela vê o porquê.
 */
export interface BarreiraDaPlaca {
  /** A linha vertical que não se atravessa. */
  x: number;
  /** O y do teto do vão (o fundo do primeiro sólido acima da placa). Acima dele a barreira não existe. */
  topo: number;
  /** O y do piso em que a placa está plantada. Abaixo dele a barreira não existe. */
  piso: number;
}

/** A criança pode seguir para (`x`, `y`) carregando o que carrega? Só o LIXO é barrado, e só dentro do vão. */
export function podePassarDaPlaca(
  x: number, y: number, b: BarreiraDaPlaca | null, carregandoLixo: boolean,
): boolean {
  if (!carregandoLixo || b === null) return true;
  if (y <= b.topo || y > b.piso) return true;   // fora do vão da placa: passa, e nem sabe que havia barreira
  return x < b.x;
}

/**
 * O x em que a criança PARA, se a placa a barrar. Devolve o próprio x quando ela pode passar.
 *
 * Função e não booleano porque quem chama precisa do NÚMERO: barrar é grudar a criança na linha, e um
 * booleano faria cada chamador inventar o seu próprio "então onde ela fica?".
 */
export function travarNaPlaca(
  x: number, y: number, b: BarreiraDaPlaca | null, carregandoLixo: boolean,
): number {
  return podePassarDaPlaca(x, y, b, carregandoLixo) ? x : b!.x;
}
