// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-buttons — the items of the pause card the engine mounts: root, the game's options and the inclusion settings.
//
// Menu data for `ui/pause-icons`. They lived in `ui/activities-menu`, the platformer's title menu, which left the engine
// (ADR-0174, issue #171); the card is the engine's, so its buttons stay.

/** One row of the per-screen pause menu. `letra` marks the label that ABC/abc rewrites live. */
export interface PauseBtnDef {
  readonly act: string;
  /**
   * Rótulo CRU, e ele só é usado quando o botão tem rótulo dinâmico (`letra`/`nivel`).
   *
   * Virou opcional, e o motivo é o gate de i18n: `pmBtnMarkup` resolve todo botão comum por `t('pause.' +
   * act)`, então o texto aqui nunca ia para tela nenhuma — era português cru dentro de um módulo de ENGINE,
   * parado, esperando alguém confiar nele. Nenhuma entrada de hoje marca `letra` ou `nivel`, então nenhuma
   * precisa dele; a chave `pause.*` é a fonte, e ela existe nos três idiomas.
   */
  readonly lbl?: string;
  readonly letra?: boolean;
  readonly nivel?: boolean;
}

/** The pause menu's items — MENU DATA, so it lives with the other menu tables. The pause slice (ui/pause-icons)
 *  receives it through its own ctx instead of re-declaring it; nobody owns two copies of a list of buttons. */
export const PM_BTNS: readonly PauseBtnDef[] = [
  // ===================== A ORDEM É A DECISÃO (ADR-0044 §2) =====================
  // Eram DOZE itens, e `resume` — a SAÍDA — era a 11ª parada do cartão, porque os dez ícones de a11y vinham
  // antes na ordem de leitura. Quem pausa e não enxerga varria dez alternadores e um cabeçalho antes de achar
  // "Continuar". Menu de onde não se sai é armadilha, e a armadilha custa mais caro para quem não a enxerga.
  //
  // `resume` PRIMEIRO porque é para isso que serve uma pausa. `quit` ÚLTIMO porque é o desfecho menos
  // desejado dela — e, como a lista é ANEL (item 1), uma tecla para CIMA a partir de `resume` chega nele:
  // longe na leitura, perto no dedo.
  //
  // Os sete painéis de ajuste desceram para `PM_OPTIONS_BTNS`.
  //
  // 🔴 SEIS desde 2026-09-12 (ADR-0151), e o número é MEDIDO, não gosto: com nove itens (ADR-0147) o cartão
  // transbordava 64 px a 640×360, a tela-alvo; sete cabem exactamente, e a régua de alvo já está no piso
  // (ADR-0095: «tela menor mostra menos itens, não alvos menores»). O critério do §2 continua o mesmo —
  // `resume` primeiro, `quit` último, e como a lista é ANEL, CIMA a partir de `resume` cai no `quit`.
  //
  // 📌 SAÍRAM DOIS, e cada um tem para onde ir: `acessibilidade` (a barra rápida) passa ao botão SELECT, e
  // `print` vai com ele — «basta apertar SELECT que se tem a visão apropriada pra print», nas palavras do Dev.
  // Os `act` continuam a existir e a funcionar para quem passar a sua própria lista; só não estão nesta.
  { act: 'resume' },
  // «Ajuda — Como jogar» SOBE para segundo: é a primeira coisa que quem pausou sem saber jogar procura.
  { act: 'ajuda' },
  // ⚠️ O `act` CONTINUA `addplayer` e o RÓTULO é que é «número de jogadores» (ADR-0147 §3): `ui/shell.ts`
  // implementa `pauseActs.addplayer` e quatro casos de `shell.browser.test.js` chamam-no.
  { act: 'addplayer' },
  // «Configurações de inclusão»: o que a criança CARREGA entre jogos (ADR-0146, nome do ADR-0151).
  { act: 'options' },
  // «Opções do jogo»: o que é DESTE jogo. A porta cai sozinha quando o jogo não declara nada seu.
  { act: 'opcoesdojogo' },
  { act: 'quit' },
];

/**
 * A TERCEIRA LISTA: o que é DESTE jogo (ADR-0146, ADR-0145).
 *
 * ⚠️ NASCE COM O «VOLTAR» E MAIS NADA, e o vazio é a decisão: a engine não sabe o que um jogo tem de seu — o
 * jogo declara-o. Uma lista que a engine preenchesse seria a cadeira de rodas no xadrez outra vez.
 *
 * 📌 E por isso a porta cai sozinha: `raizQueAcciona` deixa cair uma porta cuja sala está vazia, e com esta
 * lista reduzida ao `pmback` é exactamente esse o caso de um jogo que não declara nada.
 */
export const PM_JOGO_BTNS: readonly PauseBtnDef[] = [
  { act: 'pmback' },
];

/**
 * O SUBMENU DE OPÇÕES — os sete painéis que saíram da lista raiz, na ordem que o Dev ditou.
 *
 * A saída vem PRIMEIRO aqui também, pela mesma razão que `resume` vem primeiro lá: a regra do ADR-0044 é
 * sobre menus, não sobre um menu. Um submenu de onde não se sai é a mesma armadilha, um nível abaixo.
 *
 * 'letra' virou 'caa' (ADR-0028): era um CICLO de duas posições cujo rótulo mudava junto (`letra: true`), e
 * virou a porta de um menu. Sem ciclo não há rótulo dinâmico, então ele volta a ser traduzível como os
 * irmãos — o `letra: true` existia só para o i18n não sobrescrever o ABC/abc que o ciclo escrevia.
 */
export const PM_OPTIONS_BTNS: readonly PauseBtnDef[] = [
  // 🔴 «CONFIGURAÇÕES DE INCLUSÃO» DESDE 2026-09-12 (ADR-0151), e SAÍRAM DOIS:
  //   · `caa` (Comunicação) — a caixa da letra já anda no ciclo do 11.º botão da barra, que vira o ciclo de
  //     COMUNICAÇÃO e ganha ARASAAC e PCS (desabilitados até a licença deixar);
  //   · `tipo` (Tipografia) — «quem escolhe a tipografia é o jogo, o jogador escolhe suas fontes via o menu de
  //     acessibilidade rápida».
  // 📏 E O NÚMERO É O QUE CABE: com oito entradas este submenu transbordava 24 px a 640×360, e nenhum crivo o
  // via — só a raiz era medida. O caso do submenu está agora no `pausa-44px`.
  // ✅ O painel «Áudio» (música, ambiente, interacção, earcons), separado da acessibilidade auditiva, ENTROU com o
  // painel que ele abre — nunca antes: uma porta para um painel que não existe seria o botão morto do ADR-0106 §5.
  { act: 'pmback' },
  { act: 'empatia' },
  { act: 'audio' },
  { act: 'som' },
  { act: 'motora' },
  { act: 'visual' },
  { act: 'anim' },
];
