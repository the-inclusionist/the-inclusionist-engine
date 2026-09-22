// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/panel-shell — A CASCA DE UM PAINEL DE AJUSTES, construída em vez de exigida.
//
// ========================= O ACHADO QUE ISTO CONSERTA =========================
// O segundo consumidor (a etapa C da issue #63) mediu-o e escreveu-o no achado 6:
//
//     «O CONTRATO DE MARKUP É INVISÍVEL. O ctx do painel pede `$` e `store`; o que ele REALMENTE exige é que
//      o documento do consumidor contenha `#typo`, `#typo-list`, `#typo-preview`, `#typo-close` e
//      `#typo-reset`. Nada no tipo diz isso — descobre-se por tentativa, e o modo de falhar é o pior
//      possível: o painel abre VAZIO, sem erro.»
//
// Cada `ui/settings-*.ts` preenche o INTERIOR do seu painel; o EXTERIOR — o véu, o cartão, o título, o
// rodapé de ações e o botão de restaurar — vinha do `app/index.html`, que saiu com o cartucho (#111). Desde
// então a engine EXIGE cinco ids por painel e não os declara em lado nenhum.
//
// ⚠️ E A REGRA DE MENU DO `CLAUDE.md` §4 DEPENDIA DE ALGUÉM SE LEMBRAR DELA. A introdução de um painel vai no
// `data-explain-idle` do cartão — nunca num `<p>` de prosa no topo —, porque um menu que explica item a item
// obriga a criança a LER TUDO para achar o que procura. A issue #62 mandava editar seis blocos de markup para
// isso; o markup saiu, e a regra ficou sem alvo. Aqui ela deixa de ser lembrete e passa a ser construção: a
// casca não tem por onde receber um `<p>` no topo.
//
// ========================= A FORMA, QUE FOI MEDIDA E NÃO INVENTADA =========================
// É a do painel de tipografia do `app/quiz.html`, que é o único que sobrou e o que o segundo consumidor
// exercitou de facto:
//
//     <div id="X" class="overlay" hidden>
//       <div class="overlay__card" role="dialog" aria-modal="true" aria-labelledby="X-title" [data-explain-idle]>
//         <h2 id="X-title">…</h2>
//         <button id="X-close">Voltar</button>                                      ← item 1 (ADR-0158)
//         <div id="X-list" class="ctrl-list" role="group" aria-label="…"></div>   ← o interior, do settings-*
//         <div class="overlay__actions">
//           <button id="X-reset">…</button>
//         </div>
//       </div>
//     </div>
//
// ⚠️ O RODAPÉ `.opt-explain` NÃO É CRIADO AQUI, e isso é deliberado: `ui/settings-panel.fillExplain` cria-o
// quando move a primeira dica para lá. Criá-lo vazio aqui daria uma região `aria-live` que anuncia nada, e
// duas mãos a criar o mesmo nó é como ele acabaria duplicado.
//
// Sem `innerHTML`: tudo por `criar` + `textContent`, no molde de `ui/loop-crash` e `ui/focus-trap`. O título
// e o rótulo da lista vêm do CHAMADOR já resolvidos — este módulo não traduz, para poder ser exercitado sem
// dicionário.
//
// ⚠️ E NÃO IMPORTA NADA. Uma casca que não usa `innerHTML` também não precisa de escapar texto: `textContent`
// escapa por construção. Chegou a haver aqui um `escapeHtml` importado «por conveniência» — que é como um
// módulo-folha deixa de o ser, e como um leitor futuro passa a procurar a interpolação que não existe.

/** As três coisas do `document` de que a casca precisa. Mesma forma de `ui/loop-crash`. */
export interface PanelShellCtx {
  /** `document.querySelector`, injetado — a casca nunca alcança o `document` global. */
  procurar: (sel: string) => HTMLElement | null;
  /** `document.createElement`, injetado. */
  criar: (tag: string) => HTMLElement;
}

export interface PanelShellSpec {
  /** O id do painel: `typo`, `audio`, `visual`… Gera `#X`, `#X-title`, `#X-list`, `#X-reset`, `#X-close`. */
  id: string;
  /**
   * O id da LISTA, quando ele não é `${id}-list`.
   *
   * 📏 MEDIDO NOS OITO EM 2026-09-11, e há exactamente uma divergência: `settings-motion` vive no overlay
   * `#animation` — com `#animation-reset` e `#animation-close`, que casam — e lê a lista em **`#motion-list`**.
   * É herança do monólito, onde o painel se chamava «motion» e o overlay «animation».
   *
   * ⚠️ E A SAÍDA NÃO É RENOMEAR. O id que um `settings-*` lê é contrato com o markup de quem já o usa, e a
   * regra do `CLAUDE.md` sobre tirar campo de contrato aplica-se inteira: mede-se o CATÁLOGO, não o consumidor
   * da casa — e o catálogo vive em repositórios que não são este. Um campo opcional custa uma linha e não
   * quebra ninguém; a renomeação custaria o painel de movimento a quem já tem markup.
   */
  idDaLista?: string;
  /** O título, JÁ TRADUZIDO. Vai por `textContent`. */
  titulo: string;
  /** O `aria-label` da lista, já traduzido — o nome do grupo que a criança ouve ao entrar nele. */
  rotuloDaLista: string;
  /** Os rótulos dos dois botões, já traduzidos. `rotuloFechar` é a palavra de VOLTAR (item 1, ADR-0158). */
  rotuloReset: string;
  rotuloFechar: string;
  /**
   * A introdução do painel, já traduzida. Vira o texto de REPOUSO do rodapé, via `data-explain-idle`.
   *
   * ⚠️ É O ÚNICO CAMINHO QUE ESTA CASCA OFERECE PARA UMA INTRODUÇÃO, e é o ponto da issue #62: não há por
   * onde passar um parágrafo de prosa para o topo do cartão. Ausente = o painel não tem introdução, que é
   * uma resposta legítima e não uma omissão.
   */
  introducao?: string;
}

/**
 * AS PALAVRAS DA CASCA, sem o id — tudo o que muda quando o idioma muda, e nada do que não muda.
 *
 * ⚠️ SEPARADAS DO `id` DE PROPÓSITO, e a separação é a que `ui/mount-panel` precisa: o id é identidade e
 * resolve-se uma vez; os rótulos são TEXTO TRADUZIDO e resolvem-se a cada abertura. Um tipo que os juntasse
 * obrigaria quem retraduz a repetir o id, e repetir uma identidade é como ela diverge.
 */
export type PanelLabels = Omit<PanelShellSpec, 'id'>;

/** O que a casca devolve: o nó e os ids que ela criou, para o painel não os adivinhar. */
export interface PanelShell {
  overlay: HTMLElement;
  card: HTMLElement;
  /** O `<h2>` do cartão. Exposto porque quem retraduz o painel escreve nele — ver `applyLabels`. */
  titulo: HTMLElement;
  lista: HTMLElement;
  reset: HTMLElement;
  fechar: HTMLElement;
  /** Os cinco selectores que este painel passa a garantir. É o contrato, agora dito em vez de descoberto. */
  ids: { overlay: string; title: string; lista: string; reset: string; fechar: string };
}

/** Os ids que um painel de `id` ocupa. Exportado porque um gate e um consumidor precisam de os nomear. */
export function shellIds(id: string, idDaLista?: string): PanelShell['ids'] {
  return {
    overlay: id,
    title: `${id}-title`,
    lista: idDaLista ?? `${id}-list`,
    reset: `${id}-reset`,
    fechar: `${id}-close`,
  };
}

/**
 * Monta (ou reaproveita) a casca do painel `spec.id` e devolve as suas partes.
 *
 * IDEMPOTENTE: se já existir um `#id`, ele é reutilizado e o conteúdo do cartão é reconstruído. Um painel que
 * a raiz monte duas vezes não pode acabar com dois véus — e a raiz monta mais do que uma vez, porque a
 * contagem de jogadores muda a grade de telas.
 */
export function mountShell(ctx: PanelShellCtx, spec: PanelShellSpec): PanelShell {
  const ids = shellIds(spec.id, spec.idDaLista);
  const overlay = ctx.procurar('#' + ids.overlay) ?? ctx.criar('div');
  overlay.id = ids.overlay;
  overlay.className = 'overlay';
  overlay.hidden = true;
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

  const card = ctx.criar('div');
  card.className = 'overlay__card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', ids.title);

  const h2 = ctx.criar('h2');
  h2.id = ids.title;
  card.appendChild(h2);

  // ADR-0158: «Voltar» is item 1 and nothing closes the panel after its rows. The way out is where the cursor lands
  // when the panel opens — a close button at the bottom made the child walk every row to leave. The id stays
  // `#X-close`, which is contract; only its place and its word changed.
  const fechar = botao(ctx, ids.fechar, 'mode-btn overlay__back');
  card.appendChild(fechar);

  const lista = ctx.criar('div');
  lista.id = ids.lista;
  lista.className = 'ctrl-list';
  lista.setAttribute('role', 'group');
  card.appendChild(lista);

  const acoes = ctx.criar('div');
  acoes.className = 'overlay__actions';
  const reset = botao(ctx, ids.reset, 'mode-btn');
  acoes.appendChild(reset);
  card.appendChild(acoes);

  overlay.appendChild(card);
  const casca: PanelShell = { overlay, card, titulo: h2, lista, reset, fechar, ids };
  applyLabels(casca, spec);
  return casca;
}

/**
 * ESCREVE AS PALAVRAS DA CASCA — separado da construção porque elas mudam DEPOIS de ela existir.
 *
 * 🔴 O DEFEITO QUE ISTO FECHA JÁ FOI MEDIDO NA BARRA DE ÍCONES, e está escrito em `boot/create-game.ts`: o
 * `initI18n` aplica pt de forma síncrona — para a página nunca ficar em branco — e, se o idioma preferido for
 * en ou es, PEDE a troca, que é assíncrona. Tudo o que o JavaScript monta nesse intervalo captura o texto de
 * recuo e ninguém o reconstrói. 📏 Medido num navegador em 2026-09-08, com `lang="en"`: a barra servia cinco
 * rótulos em inglês e três ainda em português, na mesma linha.
 *
 * ⚠️ E NÃO SERVE RECONSTRUIR A CASCA PARA CORRIGIR O TÍTULO. `mountShell` esvazia o cartão, e cada
 * `ui/settings-*` liga o seu `#X-reset` UMA VEZ, no `init` — remontar deixa o botão de repor no documento e
 * sem escuta, que é um botão morto com aparência de vivo (ADR-0106 §5). Escrever só as palavras não toca em
 * escuta nenhuma.
 *
 * IDEMPOTENTE: escrever os mesmos rótulos duas vezes é escrever os mesmos rótulos.
 */
export function applyLabels(casca: PanelShell, r: PanelLabels): void {
  casca.titulo.textContent = r.titulo;
  casca.lista.setAttribute('aria-label', r.rotuloDaLista);
  casca.reset.textContent = r.rotuloReset;
  casca.fechar.textContent = r.rotuloFechar;
  // the arrow is drawn by the stylesheet, out of the name (ADR-0159 rule 12)
  casca.fechar.setAttribute('data-glifo', '↩');
  // A introdução do painel é o texto de REPOUSO do rodapé (CLAUDE.md §4), nunca um `<p>` no topo.
  // ⚠️ A AUSÊNCIA TEM DE APAGAR, e não só deixar de escrever: numa retradução para um dicionário que não tem
  // a chave, o atributo antigo sobreviveria e o rodapé descansaria no idioma anterior.
  if (r.introducao) casca.card.setAttribute('data-explain-idle', r.introducao);
  else casca.card.removeAttribute('data-explain-idle');
}

function botao(ctx: PanelShellCtx, id: string, classe: string): HTMLElement {
  const b = ctx.criar('button');
  b.id = id;
  b.className = classe;
  b.setAttribute('type', 'button');
  // O rótulo entra pelo `applyLabels`, por `textContent` e não `innerHTML`: um rótulo traduzido é dado de
  // fora como qualquer outro, e um dicionário de consumidor pode trazer o que quiser dentro dele.
  return b;
}
