// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage.ts — Camada única de persistência (localStorage) — módulo-folha. À prova de exceção:
// localStorage LANÇA em file:// e no modo privado de alguns navegadores, e isso derrubava o boot inteiro (por
// isso todo acesso é try/catch). Centralizar aqui: um lugar para trocar a estratégia (namespacing, IndexedDB…)
// sem caçar ~60 pontos. Migração gradual — nem todo game.js usa isto ainda.

// SOBRECARGAS PORQUE O PADRÃO DECIDE O TIPO DE RETORNO. Com um `fallback: string`, o resultado NÃO pode ser
// nulo — a assinatura antiga devolvia `string | null` de qualquer jeito, e cada chamador com padrão pagava
// por um `null` impossível. Isso apareceu como erro em quatro pontos do composition root, todos com padrão.
export function get(key: string, fallback: string): string;
export function get(key: string, fallback?: null): string | null;
export function get(key: string, fallback: string | null = null): string | null {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function set(key: string, value: string | number | boolean): boolean {
  try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
export function remove(key: string): void { try { localStorage.removeItem(key); } catch { /* noop */ } }

export function getBool(key: string, fallback = false): boolean { const v = get(key, null); return v == null ? fallback : v === '1'; }
export function setBool(key: string, on: boolean): void { set(key, on ? '1' : '0'); }

export function getNum(key: string, fallback = 0): number {
  const v = get(key, null); const n = v == null ? NaN : parseFloat(v);
  return isFinite(n) ? n : fallback;
}

export function getJSON<T = unknown>(key: string, fallback: T | null = null): T | null {
  try { const s = get(key, null); return s == null ? fallback : (JSON.parse(s) as T); } catch { return fallback; }
}
export function setJSON(key: string, obj: unknown): void { try { set(key, JSON.stringify(obj)); } catch { /* noop */ } }

/* ===================== os DOIS escopos (save com namespace, ADR-0027 passo 7) ===================== */
//
// O namespacing óbvio — um prefixo por jogo em TUDO — seria um defeito de acessibilidade grave, e vale dizer
// por quê antes de dizer o que foi feito.
//
// Uma criança cega configura o modo cego, a bengala, a voz, a velocidade da narração. Uma criança daltônica
// escolhe a correção. Uma criança disléxica escolhe a fonte. Se cada jogo do catálogo tivesse o próprio
// espaço de nomes, ela teria de REFAZER tudo isso em cada jogo do catálogo — e quem mais depende dos ajustes
// é justamente quem tem menos margem para refazê-los. (O número que estava aqui era 35, do plano que morreu
// em 2026-08-28; o catálogo do MVP são 300+ jogos, o que só torna o argumento mais forte.)
//
// Então são DOIS escopos, e a linha entre eles não é técnica, é de quem a coisa pertence:
//
//   · COMPARTILHADO (`incl_*`, como sempre foi) — o que pertence à CRIANÇA: acessibilidade, tipografia,
//     idioma, voz, controles, toque. Segue com ela de jogo em jogo, de propósito. O segundo consumidor (o
//     quiz) já lê a fonte escolhida no jogo de plataforma, e isso está CERTO.
//   · DO JOGO (`incl.<jogo>.*`) — o que pertence a ESTA partida: atividade, nível, cenário, gravação da
//     demonstração. Dois jogos com um "nível 3" não são o mesmo nível 3.
//
// A LEITURA HERDA DA CHAVE ANTIGA e a escrita vai só para a nova (`getWithLegacy`). Sem passo de migração no
// boot, porque `core/state` lê no IMPORT — uma migração agendada chegaria tarde. E a chave velha fica onde
// está: é dado da criança, não meu para apagar, e a sua permanência é o que torna um retorno possível.

/**
 * Nome completo de uma chave do escopo DO JOGO.
 *
 * ⚠️ O ID ENTRA COMO ARGUMENTO, e ele já foi uma constante aqui (`JOGO_ID = 'inclusionist'`). Pelo teste do
 * ADR-0080 — *um segundo jogo quereria um valor diferente aqui?* — a resposta é sim e é imediata: dois jogos
 * no mesmo perfil de navegador colidiam em `activity`, `quizlevel`, `cenario`, `tabsel`, `fracnot` e em toda
 * gravação `attract_*`. Um sobrescrevia o progresso do outro sem erro nenhum.
 *
 * ⚠️ E O ID NÃO VEM DA DECLARAÇÃO, que era o desenho óbvio. Ele não pode: `game/state` lê o armazenamento no
 * IMPORT, e o import corre antes de qualquer `createGame()`. Um id vindo da declaração chegaria depois de as
 * três chaves já terem sido resolvidas — contra vazio, e em silêncio. Quem sabe o próprio id é o JOGO, que o
 * passa como constante sua; o ADR-0080 proíbe a ENGINE de o saber, não o jogo.
 */
export function gameKey(jogo: string, nome: string): string { return 'incl.' + jogo + '.' + nome; }

/**
 * THE KEYS OUTSIDE EVERY ENGINE SCOPE (study item E2): not the child's `incl_*` (and the older `inclusionist.*`), not a
 * game's `incl.<game>.*`. 📏 Measured: pinball stores `pinball:*`. ⚠️ A game's data stored in the CHILD's scope
 * (chess's `incl_chess_*`) is not seen: the engine's own `incl_` keys are not one closed list, so that question would
 * accuse the engine.
 */
export function keysOutsideScopes(chaves: Iterable<string>): string[] {
  return [...chaves].filter((k) => !k.startsWith('incl_') && !k.startsWith('inclusionist.') && !k.startsWith('incl.'));
}

/**
 * Lê a chave NOVA; se ela ainda não existe, herda o valor da LEGADA. Só de leitura: quem grava, grava na nova.
 * É o que permite renomear chave sem um passo de migração e sem perder o ajuste de ninguém.
 */
export function getWithLegacy(nova: string, legada: string, fallback: string): string;
export function getWithLegacy(nova: string, legada: string, fallback?: null): string | null;
export function getWithLegacy(nova: string, legada: string, fallback: string | null = null): string | null {
  const v = get(nova, null);
  if (v !== null) return v;
  const antigo = get(legada, null);
  return antigo !== null ? antigo : fallback;
}

/** O par de `getWithLegacy` para valor em JSON — a herança tem de valer para os dois formatos, senão metade
 *  das chaves migra e a outra metade some, que é o pior dos dois mundos. */
export function getJsonWithLegacy<T = unknown>(nova: string, legada: string, fallback: T | null = null): T | null {
  const v = getJSON<T>(nova, null);
  if (v !== null) return v;
  const antigo = getJSON<T>(legada, null);
  return antigo !== null ? antigo : fallback;
}

// Registro das chaves conhecidas (documentação em UM lugar; a fonte de verdade ainda é o uso). Vai sendo
// completado à medida que os lotes migram. Chaves com {i}/{cen}/{id} são parametrizadas por jogador/cenário/controle.
export const KEYS = {
  // empatia motora/auditiva
  onebtn: 'incl_onebtn', wheelchair: 'incl_wheelchair', modocego: 'incl_modocego', caneDiv: 'incl_cane_div',
  hearingloss: 'incl_hearingloss',
  // atividade / quiz / cenário — ESCOPO DO JOGO (ver os dois escopos acima). `*Legado` é o nome antigo, de
  // onde a leitura herda uma vez; a escrita vai só para o novo.
  //
  // ⚠️ SÃO FUNÇÕES DO ID DO JOGO, e as da criança são strings. A diferença de FORMA é o que impede o engano:
  // não há como prefixar por engano uma preferência da criança, porque ela não tem onde receber o id — e não
  // há como esquecer de escopar uma chave da partida, porque sem o argumento não compila. A regra que antes
  // vivia só num comentário passou a viver no tipo.
  activity: (jogo: string): string => gameKey(jogo, 'activity'), activityLegado: 'incl_activity',
  quizlevel: (jogo: string): string => gameKey(jogo, 'quizlevel'), quizlevelLegado: 'incl_quizlevel',
  cenario: (jogo: string): string => gameKey(jogo, 'cenario'), cenarioLegado: 'incl_cenario',
  tabsel: (jogo: string): string => gameKey(jogo, 'tabsel'), tabselLegado: 'incl_tabsel',
  fracnot: (jogo: string): string => gameKey(jogo, 'fracnot'), fracnotLegado: 'incl_fracnot',
  // visual / contraste / cor
  viz: 'incl_viz', lq: 'incl_lq', cbsafe: 'incl_cbsafe', ownercolors: 'incl_ownercolors',
  outfg: 'incl_outfg', outbg: 'incl_outbg', hcrole: 'incl_hcrole', juice: 'incl_juice', crt: 'incl_crt2',
  crtLegacy: 'incl_crt', // formato antigo (booleano); crt.ts migra p/ incl_crt2 na 1ª leitura (fresh)
  // áudio / voz / i18n
  ttsEngine: 'incl_tts_engine', ttsVoice: 'incl_tts_voice', ttsVoz: 'incl_tts_voz', lang: 'incl_lang', // audiocat_{k}
  // comunicação / legendas (ADR-0028: todo menu persiste)
  letterCase: 'incl_lettercase', captions: 'incl_captions',
  // ⚠️ O NÍVEL TEA (calmo / silencioso) PASSOU A PERSISTIR EM 2026-09-07, e antes não persistia: era um
  // `let calmMode = 0` em `ui/pause-icons`, com o comentário «deliberately NOT persisted — verbatim: game.js
  // never wrote it to storage». O «verbatim» é a chave — foi PRESERVADO na extração do monólito, não
  // decidido. O custo era da criança que mais precisa dele: quem usa o modo silencioso voltava a pô-lo a
  // cada sessão, e é para quem o barulho inesperado custa mais. O ADR-0028 diz que todo menu persiste.
  tea: 'incl_tea',
  menuIndex: 'incl_menuindex', // "6 de 10" no fim do anuncio de item (ADR-0044, item 3)
  // tipografia / controles / toque
  fontKey: 'incl_font_k', padDesign: 'incl_paddesign', padDir: 'incl_paddir', touchmap: 'incl_touchmap',
  padBtnMm: 'incl_padbtnmm', padGapMm: 'incl_padgapmm', padStickMm: 'incl_padstickmm',
  padTravelMm: 'incl_padtravelmm', padDpadMm: 'incl_paddpadmm',
  // movimento reduzido (objeto inteiro num JSON so) + a chave antiga de alternar-movimento, que
  // loadPlayerA11y ainda le uma vez para migrar quem vinha da versao anterior
  reducedMotion: 'inclusionist.reducedmotion.v1', toggleMoveLegacy: 'inclusionist.togglemove',
  // POR JOGADOR — parametrizadas pelo indice da tela. Eram sufixos '_p'+i montados a mao em varios
  // pontos do game.js; virar funcao aqui e o que impede que um deles escreva num nome torto.
  /**
   * @deprecated ⚠️ A CHAVE LEGADA do modo visual — UM valor, do tempo em que só cabia um (issue #104).
   *
   * Continua a ser LIDA, e é isso que impede a criança de perder o que já escolheu; continua a ser ESCRITA
   * enquanto os controles ainda escreverem um valor de cada vez, porque um leitor antigo (o cartucho na
   * versão publicada) faz `if (v && VIZ_BY_KEY[v])` e rejeitaria um JSON — escrever a forma nova AQUI
   * apagaria o ajuste dela em silêncio, que é exactamente o defeito que a migração existe para não cometer.
   */
  vizP: (i: number): string => 'incl_viz_p' + i,
  /**
   * O ESTADO VISUAL de dois eixos, em JSON (ADR-0076, issue #104).
   *
   * ⚠️ CHAVE NOVA AO LADO DA VELHA, e não a mesma chave com conteúdo novo. É o mesmo desenho que o campo
   * `visual` usa ao lado do `viz`: as duas formas coexistem enquanto houver leitores das duas, cada um lê a
   * que entende, e a velha só morre quando não sobrar quem a leia. `migrarVisual` aceita as duas, então o
   * recuo — chave nova ausente, chave velha presente — devolve exactamente o que a criança escolheu.
   */
  visualP: (i: number): string => 'incl_visual_p' + i,
  sinkP: (i: number): string => 'incl_sink_p' + i,
  easyP: (i: number): string => 'incl_easy_p' + i,
  /**
   * ⚠️ AS DUAS DE BAIXO SÃO AS CHAVES LEGADAS desde 2026-09-08 (ADR-0104 §C, issue #114). Continuam a ser
   * LIDAS — é o ajuste da criança, e a herança dele é o que a impede de o perder — e não voltam a ser
   * escritas. O que se escreve é a chave COM TRANSPORTE, porque a alternância é do APARELHO e não da pessoa:
   * ligá-la no controle de tela, onde ninguém segura um botão virtual com conforto, ligava-a também no
   * teclado, onde segurar uma tecla é exactamente o que a criança sabe fazer.
   *
   * ⚠️ E A CHAVE NOVA NÃO MORA AQUI, de propósito. Ela é `chaveDaAlternancia`, em `input/latch-scope` — este
   * ficheiro é módulo-FOLHA e `platform/` não importa de `input/`, que é a camada acima. Montá-la aqui
   * exigiria ou uma aresta ao contrário ou uma segunda cópia do nome, e a segunda cópia é exactamente o que
   * o comentário do bloco acima existe para impedir. O dono do nome é quem conhece a regra do transporte.
   */
  toggleMoveP: (i: number): string => 'incl_togglemove_p' + i,
  toggleRunP: (i: number): string => 'incl_togglerun_p' + i, // alternância do botão de CORRER (irmã da de movimento)
  rmWalkP: (i: number): string => 'incl_rmWalk_p' + i,
  rmBreathP: (i: number): string => 'incl_rmBreath_p' + i,
  rmFlavorP: (i: number): string => 'incl_rmFlavor_p' + i,
  // demo/attract: uma gravação por cenário (fn em vez de string — chave parametrizada). ESCOPO DO JOGO: a
  // gravação é de uma fase DESTE jogo e não faz sentido nenhum em outro.
  attract: (jogo: string, cen: string): string => gameKey(jogo, 'attract_' + cen),
  attractLegado: (cen: string): string => 'incl_attract_' + cen,
};
