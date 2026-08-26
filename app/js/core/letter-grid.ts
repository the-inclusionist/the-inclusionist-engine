// SPDX-License-Identifier: AGPL-3.0-or-later
// core/letter-grid — ENTRADA DE TEXTO SEM TECLADO, e é essa a coisa que este arquivo é.
//
// ========================= POR QUE ISTO EXISTE =========================
// O ADR-0027 diz o que falta ao motor em uma linha: *"the engine needs a LETTER GRID SELECTOR, not a
// keyboard"*. Um console não tem teclado, e o alvo desta engine é uma máquina de escola operada por
// direcional — quando não por UM botão só. Digitar, aqui, é mover um cursor por uma grade e confirmar.
//
// O consumidor é o CÓDIGO DA SALA DA PROFESSORA. Não é a senha de progressão da criança: o ADR-0037 a
// enterrou junto com a ideia de salvar jogo — não existe save, e o Inclusionist não guarda nada sobre uma
// criança. O que o ADR-0037 diz que sobrevive é o `core/password`, e por outro motivo: *"the teacher's room
// code is the same engineering problem… it stays because the room screen will need it"*. O modo de falha
// mudou de forma junto: um código errado que seja ACEITO não carrega o progresso de outra criança — larga
// esta criança na sala de outra turma, fazendo a atividade de outra professora.
//
// O segundo consumidor já está previsto e é o que impede este módulo de nascer como componente de senha: os
// jogos de palavras do catálogo do `inclusionist-demos` precisam da mesma coisa.
//
// ========================= O CORTE (ADR-0041) =========================
// MECÂNICA aqui, TELA no `ui/`. É a mesma divisão que o `core/password` acabou de usar, e ela existe para
// preservar a propriedade mais cara que o `core/` tem: ser testável sem navegador. O `core/scenes` foi
// escrito de propósito sem PIXI e sem DOM por esse motivo, e um módulo que DESENHE dentro do `core/` abre
// uma porta que a próxima tela atravessa sem discussão.
//
// O que NÃO está aqui, e é honesto dizer: a repetição de tecla. Ela é temporização de entrada e mora com o
// `input/`, junto das bordas de tecla — o ADR-0041 a listou como conteúdo desta metade e ela não é.
//
// ========================= A ESCOLHA DE ENROLAMENTO, E O MOTIVO =========================
// Nas bordas o cursor enrola em TOROIDE: andar para a direita mantém a LINHA, andar para baixo mantém a
// COLUNA. A alternativa — a da direita na última coluna cair na linha seguinte, como texto — é comum em
// teclados de console e está errada aqui, e o motivo é o leitor de tela: a leitura anuncia "linha 2,
// coluna 1", e um movimento horizontal que mude a linha faz o anúncio contradizer a direção que a criança
// apertou. Movimento previsível vale mais que economia de apertos.
//
// SEM I/O NO IMPORT, e sem estado de módulo: `criarGrade()` devolve a instância e quem compõe a possui. É a
// D13 do `inclusionist-demos`, e é o que permite duas grades na mesma página sem uma pisar na outra.

/** As quatro direções que um direcional produz. Nomes em português porque são vocabulário do jogo, não da web. */
export type Direcao = 'esquerda' | 'direita' | 'cima' | 'baixo';

/** Onde o cursor está, em coordenadas de grade — o que a tela desenha e o leitor de tela anuncia. */
export interface Posicao {
  readonly linha: number;
  readonly coluna: number;
}

export interface GradeDeLetras {
  /** A grade, como dado: quem desenha lê daqui em vez de recontar. */
  readonly simbolos: readonly string[];
  readonly colunas: number;
  readonly linhas: number;
  /** Quantas casas o valor aceita. `0` = sem limite (jogos de palavra). */
  readonly capacidade: number;

  /** Índice linear do cursor, `0..simbolos.length-1`. */
  indice(): number;
  /** A posição do cursor em linha/coluna, base ZERO — quem anuncia soma 1 se quiser falar "linha 1". */
  posicao(): Posicao;
  /** O símbolo sob o cursor. */
  sob(): string;

  /** Move o cursor uma casa, enrolando em toroide. */
  mover(dir: Direcao): void;
  /** Leva o cursor ao símbolo dado. Devolve `false` — e não move — quando ele não está na grade. */
  irPara(simbolo: string): boolean;

  /** Acrescenta o símbolo sob o cursor ao valor. Não faz nada quando o valor já está cheio. */
  digitar(): void;
  /** Apaga a última casa. Não faz nada quando o valor está vazio. */
  apagar(): void;
  /** Esvazia o valor. O cursor NÃO se mexe: quem apagou continua olhando para onde estava. */
  limpar(): void;
  /** O que foi digitado até agora. */
  valor(): string;
  /** Quantas casas ainda faltam. `null` quando não há capacidade declarada. */
  faltam(): number | null;
  /** `true` quando o valor atingiu a capacidade. Sempre `false` sem capacidade declarada. */
  completo(): boolean;
}

export interface OpcoesDaGrade {
  /** Os símbolos, em ordem de leitura (esquerda→direita, cima→baixo). */
  simbolos: string;
  /** Largura da grade. As linhas saem da divisão, e a última pode ficar incompleta. */
  colunas: number;
  /** Quantas casas o valor aceita; omitir ou `0` deixa sem limite. */
  capacidade?: number;
}

/**
 * A grade, como instância.
 *
 * `colunas` precisa ser inteiro ≥ 1 e `simbolos` não pode ser vazio: uma grade sem casas não tem cursor, e
 * um cursor sem casa é a origem de todo `undefined` que aparece três telas adiante. As mensagens são
 * SELETORES e não prosa — o gate de i18n de engine proíbe frase em qualquer idioma aqui, e o nome do campo
 * que falhou é mais útil que uma frase de qualquer forma.
 */
export function criarGrade(opcoes: OpcoesDaGrade): GradeDeLetras {
  const simbolos = [...opcoes.simbolos];
  const colunas = opcoes.colunas;
  if (simbolos.length === 0) throw new Error('simbolos');
  if (!Number.isInteger(colunas) || colunas < 1) throw new Error('colunas');

  const linhas = Math.ceil(simbolos.length / colunas);
  const capacidade = opcoes.capacidade ?? 0;
  if (!Number.isInteger(capacidade) || capacidade < 0) throw new Error('capacidade');

  let cursor = 0;
  let digitado = '';

  /** Enrolamento de um eixo, escrito uma vez: `((v % n) + n) % n` sobrevive a negativo, que `v % n` não. */
  const enrolar = (v: number, n: number): number => ((v % n) + n) % n;

  /**
   * A ÚLTIMA LINHA PODE SER INCOMPLETA — 32 símbolos em 8 colunas dão 4 linhas cheias, mas 30 dariam uma
   * linha com 6. Descer numa coluna que não existe na linha de destino cairia num buraco, e este é o ponto
   * que decide o que fazer: o cursor pula a linha incompleta naquela coluna e segue descendo. Assim toda
   * tecla move, sempre, para uma casa que existe — e o leitor de tela nunca anuncia vazio.
   */
  function indiceDe(linha: number, coluna: number): number {
    for (let i = 0; i < linhas; i++) {
      const l = enrolar(linha + i, linhas);
      const idx = l * colunas + coluna;
      if (idx < simbolos.length) return idx;
    }
    return cursor; // inalcançável com colunas ≥ 1: a linha 0 sempre tem a coluna 0
  }

  function posicao(): Posicao {
    return { linha: Math.floor(cursor / colunas), coluna: cursor % colunas };
  }

  function mover(dir: Direcao): void {
    const { linha, coluna } = posicao();
    if (dir === 'esquerda' || dir === 'direita') {
      // Enrola DENTRO da linha, e a linha incompleta enrola no tamanho dela, não no da grade.
      const inicio = linha * colunas;
      const largura = Math.min(colunas, simbolos.length - inicio);
      cursor = inicio + enrolar(coluna + (dir === 'direita' ? 1 : -1), largura);
      return;
    }
    cursor = indiceDe(linha + (dir === 'baixo' ? 1 : -1), coluna);
  }

  return {
    simbolos,
    colunas,
    linhas,
    capacidade,
    indice: () => cursor,
    posicao,
    sob: () => simbolos[cursor]!,
    mover,
    irPara(simbolo: string): boolean {
      const i = simbolos.indexOf(simbolo);
      if (i < 0) return false;
      cursor = i;
      return true;
    },
    digitar(): void {
      if (capacidade > 0 && digitado.length >= capacidade) return;
      digitado += simbolos[cursor]!;
    },
    apagar(): void { digitado = digitado.slice(0, -1); },
    limpar(): void { digitado = ''; },
    valor: () => digitado,
    faltam: () => (capacidade > 0 ? capacidade - digitado.length : null),
    completo: () => capacidade > 0 && digitado.length >= capacidade,
  };
}
