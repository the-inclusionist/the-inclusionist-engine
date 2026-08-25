// SPDX-License-Identifier: AGPL-3.0-or-later
// core/password — O CODEC DE CÓDIGOS CURTOS copiados à mão. Módulo-FOLHA: zero dependências, zero I/O, zero DOM.
//
// ========================= PARA QUE ESTE CODEC EXISTE — E PARA QUE ELE NÃO EXISTE MAIS =========================
// Ele nasceu para outra coisa, e a honestidade do arquivo depende de dizer isso.
//
// A primeira versão era uma SENHA DE PROGRESSÃO: a criança anotava quatro letras no caderno e recuperava o
// nível de alfabetização numa máquina de escola restaurada de madrugada. O ADR-0034 registrou o desenho
// inteiro; o ADR-0037 o enterrou, e a razão veio do Dev, não de um defeito: **não existe salvar jogo, e não
// deve existir**. Os jogos têm cinco fases e terminam em quinze minutos. Uma senha para recuperar progresso
// de uma partida que acaba antes do recreio é máquina sem carga.
//
// O QUE SOBROU, e é o motivo de o arquivo continuar aqui: a única senha que o desenho tem é a que o PROFESSOR
// cria para a turma entrar na mesma sala. Enquanto não houver servidor, essa sala é o computador do professor
// na rede local. E um código de sala é o mesmo problema de engenharia que uma senha de progressão — poucos
// bits, copiados do quadro por uma criança de sete anos, onde um erro de cópia ACEITO é pior que um recusado.
// Por isso o codec permaneceu inteiro e o registro do lado do jogo (`game/progress`) foi apagado: o que morreu
// foi o significado dos campos, não a aritmética.
//
// ⚠️ NENHUM CHAMADOR HOJE. Este módulo está sem consumidor desde que `game/progress` saiu, e isso está dito
// aqui em vez de descoberto por alguém daqui a três meses. Ele fica porque a tela de sala vai precisar dele e
// porque apagá-lo custaria reescrever a verificação exaustiva que já está testada — não porque esteja em uso.
//
// ========================= O QUE ESTE MÓDULO SABE, E O QUE ELE NUNCA SABERÁ =========================
// A regra do ADR-0033 vale aqui inteira: "a entidade da engine pode declarar o que a ENGINE possui; não pode
// declarar o que o JOGO possui". Uma senha com os campos `nivel`, `pontos` e `fases` seria exatamente a
// violação que o ADR proíbe — seriam os campos DESTE jogo, congelados na engine, e o segundo consumidor
// (`quiz.html`) teria de fingir ter um "nivel" para caber.
//
// Então este módulo não conhece campo nenhum: ele recebe um ESQUEMA — uma lista de `{nome, bits}` que o jogo
// declara — e sabe empacotar inteiros pequenos em símbolos legíveis, com sobra de detecção de erro. O que a
// engine possui é a CODIFICAÇÃO; o que o jogo possui é o significado de cada campo.
//
// ========================= AS TRÊS DECISÕES QUE FAZEM O CÓDIGO SERVIR A UMA CRIANÇA =========================
//
// 1. O ALFABETO É DE 32 SÍMBOLOS, SEM I, L, O E U (o de Crockford). Os três primeiros saem por ambiguidade
//    visual — I/1, L/1, O/0 são o erro clássico de quem copia de um caderno a lápis; o U sai porque sem ele
//    o alfabeto não forma palavrão por acidente, e uma senha que sorteia uma ofensa na tela de uma sala de
//    aula é um problema real, não hipotético. O que sobra são 32 símbolos = 5 bits exatos por caractere.
//    A leniência de Crockford entra na LEITURA: quem digitar I, L ou O recebe 1, 1 e 0. Escrever nunca os
//    produz; ler perdoa quem os escreveu. E o ADR-0027 diz que a entrada não é teclado, é GRADE DE LETRAS —
//    32 símbolos cabem numa grade 8x4 legível a 320x180, que é o que a grade precisa desenhar.
//
// 2. A VERIFICAÇÃO É EXATA PARA OS DOIS ERROS QUE A CRIANÇA COMETE, e não "provável". Um dígito de soma
//    simples de 5 bits deixaria 1 código errado em 32 passar — e um código errado que PASSA é pior que um
//    rejeitado: ele leva a criança para OUTRA SALA, com a atividade de outra turma, e ninguém na sala entende
//    por quê. Aqui a soma é PONDERADA PELA POSIÇÃO, módulo 1021, em 2 símbolos:
//      · trocar UM símbolo por outro, em qualquer posição → SEMPRE detectado (a diferença que ele causa na
//        soma é (i+1)·d, e |(i+1)·d| < 1021, logo nunca cai em zero por acaso do módulo);
//      · TROCAR DOIS símbolos DO CORPO de lugar           → SEMPRE detectado ((i−j)·(vj−vi), idem).
//    Não é probabilidade: é aritmética, e é por isso que `criarCodec` limita o corpo a 32 símbolos — acima
//    disso o produto passaria de 1021 e a garantia cairia em silêncio. O que fica de fora da garantia é a
//    troca de um símbolo do corpo com um dos dois da soma; para essa, e para uma senha forjada ao acaso, a
//    chance de colar é ~1/1021.
//    ⚠️ O QUE DÁ A GARANTIA É O TAMANHO DO MÓDULO, NÃO A PRIMALIDADE — e eu conferi em vez de supor: trocar
//    1021 por 1024 (potência de dois) NÃO faz nenhum dos 26 casos deste módulo falhar. É informação sobre o
//    alcance do teste, e fica registrada aqui em vez de virar uma crença. 1021 continua sendo a escolha por
//    ser o maior primo abaixo do teto de dois símbolos: para as duas classes provadas os dois módulos
//    empatam, mas um módulo com fator 2^k é cego a erros MÚLTIPLOS cuja diferença total seja múltipla dele,
//    e um primo não tem esse buraco de graça.
//
// 3. `decodificar` DEVOLVE `null`, e não uma exceção nem um objeto "meio válido". Senha errada é o caso
//    NORMAL desta função — é o que acontece quando a criança erra uma letra —, e caso normal não se sinaliza
//    com exceção. Quem chama sabe o comprimento esperado (`codec.comprimento`) e pode distinguir "faltam
//    letras" de "senha errada" sem que este módulo invente vocabulário de interface para isso.

/** Um campo do esquema: um nome e quantos BITS ele ocupa (⇒ valores de 0 a 2^bits − 1). */
export interface CampoSenha {
  readonly nome: string;
  readonly bits: number;
}

export interface CodecSenha {
  /** Quantos caracteres a senha tem, sem separadores. Constante: toda senha deste esquema tem este tamanho. */
  readonly comprimento: number;
  /** Os campos, na ordem em que foram declarados (cópia — quem lê não altera o esquema). */
  readonly campos: readonly CampoSenha[];
  /** Empacota os valores. Lança se algum campo faltar ou não couber — ver a nota em `codificar`. */
  codificar(valores: Readonly<Record<string, number>>): string;
  /** Desempacota. `null` = senha inválida (comprimento, símbolo, soma ou enchimento). */
  decodificar(senha: string): Record<string, number> | null;
}

/** Crockford base32: sem I, L, O e U. Índice = valor de 5 bits. */
export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** O módulo da soma ponderada. Ver a decisão 2 no topo: é o TAMANHO dele que dá a garantia, e o limite de 32. */
const MODULO = 1021;
/** Símbolos do corpo, no máximo. Acima disso a garantia da soma cairia sem nenhum sintoma visível. */
const MAX_SIMBOLOS = 32;

const VALOR_DE = new Map<string, number>();
for (let i = 0; i < ALFABETO.length; i++) VALOR_DE.set(ALFABETO[i]!, i);
// A leniência de Crockford, só na LEITURA. Escrever jamais produz estes três.
VALOR_DE.set('I', 1); VALOR_DE.set('L', 1); VALOR_DE.set('O', 0);

/**
 * A soma ponderada pela posição, módulo `MODULO`, como DOIS símbolos.
 *
 * O peso `i+1` (e não `i`) é o que faz o primeiro símbolo contar: com peso 0, trocar o primeiro caractere
 * por qualquer outro passaria despercebido — e o primeiro caractere é justamente o que mais se digita errado.
 */
function soma(simbolos: readonly number[]): [number, number] {
  let c = 0;
  for (let i = 0; i < simbolos.length; i++) c = (c + (i + 1) * simbolos[i]!) % MODULO;
  return [(c >> 5) & 31, c & 31];
}

/**
 * Cria um codec para o esquema `campos`.
 *
 * ⚠️ LANÇA em esquema malformado, e isso é decisão: um esquema errado é erro de PROGRAMA, e um erro de
 * programa que só aparece como senha estranha três meses depois custa mais caro que um boot que não sobe.
 * É a mesma escolha de `boot/create-game` para a declaração malformada.
 */
// ⚠️ AS MENSAGENS DE ERRO ABAIXO ESTÃO EM INGLÊS, e os comentários deste arquivo não. Não é descuido: o gate
// `tests/engine-i18n.node.test.js` reprovou este módulo quando elas nasceram em português, e a gaveta que ele
// oferece — "mensagens de programador", onde já moram `core/contract`, `boot/create-game` e `render/sprites` —
// só me aceitaria subindo o teto global de 76 para 82 no mesmo commit que cria a dívida. Afrouxar o gate para
// caber nele é o defeito que o gate existe para impedir. Comentário não vai para tela nenhuma e segue em
// pt-BR, como no resto do repositório; STRING vai, mesmo que só até o console de quem programa.
export function criarCodec(campos: readonly CampoSenha[]): CodecSenha {
  if (campos.length === 0) {
    throw new Error('core/password: empty schema — a password with zero fields carries only its own checksum. Declare at least one field, or skip the codec.');
  }
  const vistos = new Set<string>();
  let bitsTotal = 0;
  for (const c of campos) {
    if (!c.nome) throw new Error('core/password: field without a name — the name is the key it gets in the object `decodificar` returns.');
    if (vistos.has(c.nome)) throw new Error(`core/password: field "${c.nome}" declared twice — the second one would shadow the first when reading.`);
    vistos.add(c.nome);
    if (!Number.isInteger(c.bits) || c.bits < 1 || c.bits > 30) {
      throw new Error(`core/password: field "${c.nome}" asks for ${c.bits} bits — use an integer from 1 to 30 (a 0-bit field stores nothing; above 30 the bitwise arithmetic in JS stops being exact).`);
    }
    bitsTotal += c.bits;
  }

  const simbolosCorpo = Math.ceil(bitsTotal / 5);
  if (simbolosCorpo > MAX_SIMBOLOS) {
    throw new Error(`core/password: ${bitsTotal} bits would take ${simbolosCorpo} symbols, and above ${MAX_SIMBOLOS} the weighted checksum stops detecting EVERY transposition (see decision 2 at the top). Store less, or split it into two passwords.`);
  }
  const listaCampos = campos.map((c) => Object.freeze({ nome: c.nome, bits: c.bits }));

  return {
    comprimento: simbolosCorpo + 2,
    campos: Object.freeze(listaCampos),

    codificar(valores) {
      // Bit a bit, do mais significativo ao menos, na ordem declarada. Escrito assim — e não com `<<` sobre
      // um acumulador — porque um esquema de 40 bits estouraria os 32 bits dos operadores do JS, e o sintoma
      // seria uma senha que decodifica errado só nos campos do fim.
      const bits: number[] = [];
      for (const c of listaCampos) {
        const v = valores[c.nome];
        const teto = 2 ** c.bits - 1;
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > teto) {
          throw new Error(`core/password: field "${c.nome}" got ${String(v)} — expected an integer from 0 to ${teto}. Fix the value BEFORE encoding (clamping here silently would write a password that restores different progress).`);
        }
        for (let b = c.bits - 1; b >= 0; b--) bits.push((v >> b) & 1);
      }
      while (bits.length % 5 !== 0) bits.push(0); // enchimento: zeros à direita, conferidos na leitura

      const simbolos: number[] = [];
      for (let i = 0; i < bits.length; i += 5) {
        simbolos.push((bits[i]! << 4) | (bits[i + 1]! << 3) | (bits[i + 2]! << 2) | (bits[i + 3]! << 1) | bits[i + 4]!);
      }
      const [s1, s2] = soma(simbolos);
      return [...simbolos, s1, s2].map((v) => ALFABETO[v]!).join('');
    },

    decodificar(senha) {
      if (typeof senha !== 'string') return null;
      const cru: number[] = [];
      for (const ch of senha.toUpperCase()) {
        if (ch === ' ' || ch === '-' || ch === '·') continue; // separadores de leitura (ver `formatar`)
        const v = VALOR_DE.get(ch);
        if (v === undefined) return null; // símbolo fora do alfabeto: não vale adivinhar o que ela quis dizer
        cru.push(v);
      }
      if (cru.length !== simbolosCorpo + 2) return null;

      const simbolos = cru.slice(0, simbolosCorpo);
      const [s1, s2] = soma(simbolos);
      if (s1 !== cru[simbolosCorpo] || s2 !== cru[simbolosCorpo + 1]) return null;

      const bits: number[] = [];
      for (const v of simbolos) for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1);
      // O enchimento tem de ser zero: `codificar` só produz zeros ali. Uma senha com lixo no fim não saiu
      // daqui, e aceitá-la seria aceitar uma senha que este módulo é incapaz de gerar.
      for (let i = bitsTotal; i < bits.length; i++) if (bits[i] !== 0) return null;

      const fora: Record<string, number> = {};
      let p = 0;
      for (const c of listaCampos) {
        let v = 0;
        for (let b = 0; b < c.bits; b++) v = v * 2 + bits[p++]!;
        fora[c.nome] = v;
      }
      return fora;
    },
  };
}

/**
 * Insere um separador a cada `grupo` caracteres — `'A1B2C3D4'` vira `'A1B2-C3D4'`.
 *
 * É acessibilidade, não enfeite: uma sequência sem grupos é lida caractere a caractere pelo leitor de tela e
 * copiada perdendo o lugar por quem lê da tela para o caderno. `decodificar` ignora o separador, então a
 * senha agrupada e a senha corrida são a MESMA senha — quem digitar sem o traço não é punido por isso.
 */
export function formatar(senha: string, grupo = 4, sep = '-'): string {
  if (grupo < 1) return senha;
  const partes: string[] = [];
  for (let i = 0; i < senha.length; i += grupo) partes.push(senha.slice(i, i + grupo));
  return partes.join(sep);
}
