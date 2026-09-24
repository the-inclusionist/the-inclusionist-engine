// SPDX-License-Identifier: AGPL-3.0-or-later
// input/vocabulary-migration — O ÚNICO SÍTIO DA ENGINE QUE PODE DIZER `jump`, E POR QUANTO TEMPO.
//
// ========================= POR QUE ESTE MÓDULO EXISTE SEPARADO =========================
// O gate `action-vocabulary-boundary` reprova a engine por nomear os verbos do jogo, e estava certo ao
// reprovar esta tabela quando ela nasceu dentro de `input/keyboard.ts`. Só que a tabela PRECISA de os nomear:
// traduzir o vocabulário antigo é literalmente a função dela.
//
// ⚠️ E A SAÍDA NÃO FOI LEVANTAR O TETO. Levantar um teto que "só encolhe" é o afrouxamento que o gate existe
// para impedir, e uma exceção sem endereço vira precedente para a próxima. A saída foi QUARENTENAR: o
// acoplamento inteiro mora aqui, num ficheiro cujo nome diz que ele é histórico, com um teto próprio e uma
// data de morte.
//
// ⚠️ QUANDO ISTO SE APAGA: quando não restar dado salvo no formato antigo. Não há como saber isso do lado do
// código — o dado está no navegador de cada criança —, então o critério é de tempo e é do Dev. Enquanto
// houver, apagar este ficheiro apaga o remapeamento de quem o fez.
//
// ========================= O QUE SE PERDE SE ISTO ESTIVER ERRADO =========================
// Quem remapeou teclas normalmente remapeou por NECESSIDADE — alcance de mão, dedo que não estica, teclado
// sem numpad. Um esquema salvo que deixe de casar não dá erro: as teclas simplesmente param de responder, e
// a criança conclui que o jogo quebrou. É perda de uma adaptação, não de uma preferência.

/**
 * ⚠️ O DADO SALVO NÃO É UM `KeyScheme`, e a issue #118 tornou isso um erro de compilação em vez de uma
 * suposição. Um `KeyScheme` é FECHADO nas quatorze posições e completo; o que está no navegador da criança é
 * uma SOBREPOSIÇÃO — parcial por construção (`loadKB` funde-a sobre os padrões com `Object.assign`) e capaz
 * de carregar chaves que este código não conhece, o que o cabeçalho de `migrateScheme` já dizia com todas as
 * letras: «chave desconhecida atravessa intacta».
 *
 * Dar-lhe o tipo fechado obrigaria este ficheiro a inventar as posições que faltam no dado antigo — quer
 * dizer, a escrever teclas que a criança nunca escolheu, no exacto módulo que existe para não lhe perder o
 * remapeamento. O tipo aberto é o honesto aqui, e é só aqui.
 */
export type SavedScheme = Record<string, readonly string[]>;

/**
 * Nome de plataforma → posição abstrata. **ADR-0086 §2**, e não o ADR-0074.
 *
 * ⚠️ A DIFERENÇA ENTRE OS DOIS REGISTROS É A TECLA DA CRIANÇA. O ADR-0074 dizia `jump → action1` e
 * `run → action4`; o ADR-0086 corrigiu para `run → action1` e `jump → action2`, medindo que a correção é a
 * leitura CONSERVADORA — ela deixa cada verbo na tecla e no botão que já ocupava. Traduzir por engano pela
 * tabela do 0074 não daria erro nenhum: moveria o pulo de `J` para `U` em silêncio.
 */
export const OLD_VOCABULARY: Readonly<Record<string, string>> = Object.freeze({
  run: 'action1',
  jump: 'action2',
  especial: 'action3',
  swap: 'action4',
  // ⚠️ E UMA QUINTA ENTRADA QUE NÃO É UM VERBO DE PLATAFORMA. A camada de toque chamava `pause` a posição
  // que todo o resto chama `start` — duas palavras para a mesma coisa, e a do toque era a única que não
  // existia no conjunto abstrato. Um mapa de toque gravado antes disto tem `start: 'pause'` no slot do
  // START, e sem esta linha esse botão deixaria de pausar: `decide()` passa a procurar `'start'` e
  // receberia `'pause'`, que já não é nada — sem erro, sem aviso, e o único botão de pausa de um tablet.
  pause: 'start',
});

/**
 * ⚠️ O SEGUNDO DADO SALVO, e ele quase passou. O mapa de toque (`incl_touchmap`) guarda SLOT → AÇÃO, ou seja
 * o nome da ação está no VALOR e não na chave: `{ b0: 'jump', b1: 'especial' }`. O tradutor de esquemas de
 * teclado, que traduz CHAVES, passaria por cima dele sem tocar em nada.
 *
 * ⚠️ E O DANO SERIA PIOR DO QUE NO TECLADO. `normalizeTouchMap` funde o guardado SOBRE o padrão, então um
 * `b0: 'jump'` gravado sobrescreveria o `b0: 'action2'` correto — e o botão da tela deixaria de fazer
 * qualquer coisa. Num tablet de escola pública o toque não é o caminho alternativo: é o único.
 *
 * Foi um teste de NAVEGADOR que o encontrou (`tests/touch.browser.test.js`), depois de a suíte `node` já
 * estar verde — o que é o argumento para os dois projetos existirem.
 */
export function migrateTouchMap(touchMap: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!touchMap) return null;
  const migrated: Record<string, string> = {};
  for (const [slot, action] of Object.entries(touchMap)) {
    migrated[slot] = OLD_VOCABULARY[action] ?? action;
  }
  return migrated;
}

/**
 * ⚠️ O TERCEIRO DADO SALVO, encontrado por varredura e não por acidente. Depois de o segundo aparecer num
 * teste de navegador, a pergunta certa deixou de ser «este está migrado?» e passou a ser «QUANTOS formatos
 * persistidos existem?». São três, e este é o do assistente de controle: `incl_padmap_<id>` guarda
 * AÇÃO → BINDING FÍSICO, `{ jump: { b: 0 }, run: { b: 2 } }`, um por modelo de controle.
 *
 * ⚠️ E ELE É O MAIS CARO DE PERDER DOS TRÊS. Um mapa desses existe porque a criança (ou quem a acompanha)
 * passou por um assistente de nove passos apertando botão a botão, provavelmente porque o controle dela não
 * é «standard» — controles genéricos e adaptados raramente são. Perdê-lo manda essa pessoa de volta ao
 * assistente inteiro.
 *
 * `_skip` e qualquer chave desconhecida atravessam, pela mesma razão das outras duas migrações.
 */
export function migrateControlMap<T>(touchMap: Record<string, T> | null | undefined): Record<string, T> | null {
  if (!touchMap) return null;
  const migrated: Record<string, T> = {};
  for (const [key, value] of Object.entries(touchMap)) {
    migrated[OLD_VOCABULARY[key] ?? key] = value;
  }
  return migrated;
}

/** O objeto salvo, tal como `input/keyboard` o persiste. `p34` é o formato mais antigo de todos. */
export interface SavedKB {
  solo?: SavedScheme;
  p2?: SavedScheme[];
  p3?: SavedScheme[];
  p4?: SavedScheme[];
  p34?: (SavedScheme | null)[];
}

/**
 * Traduz UM esquema salvo do vocabulário antigo para o abstrato.
 *
 * ⚠️ CHAVE DESCONHECIDA ATRAVESSA INTACTA, e é decisão e não descuido: `up`, `down`, `left` e `right` nunca
 * mudaram de nome, e um esquema pode carregar uma chave que este código não conhece — dado de uma versão
 * futura, ou lixo. Apagá-la seria destruir dado que não entendemos, e é o que faria as quatro direções
 * sumirem. É também o que torna esta função IDEMPOTENTE: aplicada sobre um esquema já migrado, nenhuma chave
 * casa e o resultado é igual à entrada, o que importa porque `loadKB` pode correr mais de uma vez na sessão.
 */
export function migrateScheme(saved: SavedScheme | null | undefined): SavedScheme | null {
  if (!saved) return null;
  const migrated: SavedScheme = {};
  for (const [key, keys] of Object.entries(saved)) {
    const newKey = OLD_VOCABULARY[key] ?? key;
    // ⚠️ Esquema MEIO migrado (as duas chaves presentes): a UNIÃO, nunca a sobreposição. Perder uma tecla é
    // o dano que este módulo existe para impedir; ter a mesma tecla duas vezes não é dano nenhum.
    migrated[newKey] = migrated[newKey] ? [...new Set([...migrated[newKey], ...keys])] : [...keys];
  }
  return migrated;
}

/** Traduz o objeto salvo inteiro — o esquema solo e as listas por contagem de jogadores. */
export function migrateSaved(s: SavedKB | null | undefined): SavedKB | null {
  if (!s) return null;
  const list = (arr: (SavedScheme | null)[] | undefined): SavedScheme[] | undefined =>
    (Array.isArray(arr) ? arr.map((m) => migrateScheme(m) as SavedScheme) : undefined);
  const out: SavedKB = {};
  const solo = migrateScheme(s.solo);
  if (solo) out.solo = solo;
  for (const g of ['p2', 'p3', 'p4'] as const) {
    const v = list(s[g]);
    if (v) out[g] = v;
  }
  // `p34` migra de VOCABULÁRIO aqui e de FORMA em `loadKB`, que já o fazia antes deste módulo existir.
  // Sem esta linha, o dado mais velho de todos seria o único a perder-se.
  if (Array.isArray(s.p34)) out.p34 = s.p34.map((m) => migrateScheme(m));
  return out;
}
