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
//         <div id="X-list" class="ctrl-list" role="group" aria-label="…"></div>   ← o interior, do settings-*
//         <div class="overlay__actions">
//           <button id="X-reset">…</button>  <button id="X-close">…</button>
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
// escapa por construção. Chegou a haver aqui um `escaparHtml` importado «por conveniência» — que é como um
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
  /** O título, JÁ TRADUZIDO. Vai por `textContent`. */
  titulo: string;
  /** O `aria-label` da lista, já traduzido — o nome do grupo que a criança ouve ao entrar nele. */
  rotuloDaLista: string;
  /** Os rótulos dos dois botões, já traduzidos. */
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

/** O que a casca devolve: o nó e os ids que ela criou, para o painel não os adivinhar. */
export interface PanelShell {
  overlay: HTMLElement;
  card: HTMLElement;
  lista: HTMLElement;
  reset: HTMLElement;
  fechar: HTMLElement;
  /** Os cinco selectores que este painel passa a garantir. É o contrato, agora dito em vez de descoberto. */
  ids: { overlay: string; title: string; lista: string; reset: string; fechar: string };
}

/** Os ids que um painel de `id` ocupa. Exportado porque um gate e um consumidor precisam de os nomear. */
export function idsDaCasca(id: string): PanelShell['ids'] {
  return { overlay: id, title: `${id}-title`, lista: `${id}-list`, reset: `${id}-reset`, fechar: `${id}-close` };
}

/**
 * Monta (ou reaproveita) a casca do painel `spec.id` e devolve as suas partes.
 *
 * IDEMPOTENTE: se já existir um `#id`, ele é reutilizado e o conteúdo do cartão é reconstruído. Um painel que
 * a raiz monte duas vezes não pode acabar com dois véus — e a raiz monta mais do que uma vez, porque a
 * contagem de jogadores muda a grade de telas.
 */
export function montarCasca(ctx: PanelShellCtx, spec: PanelShellSpec): PanelShell {
  const ids = idsDaCasca(spec.id);
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
  // A introdução do painel é o texto de REPOUSO do rodapé (CLAUDE.md §4), nunca um `<p>` no topo.
  if (spec.introducao) card.setAttribute('data-explain-idle', spec.introducao);

  const h2 = ctx.criar('h2');
  h2.id = ids.title;
  h2.textContent = spec.titulo;
  card.appendChild(h2);

  const lista = ctx.criar('div');
  lista.id = ids.lista;
  lista.className = 'ctrl-list';
  lista.setAttribute('role', 'group');
  lista.setAttribute('aria-label', spec.rotuloDaLista);
  card.appendChild(lista);

  const acoes = ctx.criar('div');
  acoes.className = 'overlay__actions';
  const reset = botao(ctx, ids.reset, spec.rotuloReset, 'mode-btn');
  const fechar = botao(ctx, ids.fechar, spec.rotuloFechar, 'mode-btn is-on');
  acoes.appendChild(reset);
  acoes.appendChild(fechar);
  card.appendChild(acoes);

  overlay.appendChild(card);
  return { overlay, card, lista, reset, fechar, ids };
}

function botao(ctx: PanelShellCtx, id: string, rotulo: string, classe: string): HTMLElement {
  const b = ctx.criar('button');
  b.id = id;
  b.className = classe;
  b.setAttribute('type', 'button');
  // `textContent` e não `innerHTML`: um rótulo traduzido é dado de fora como qualquer outro, e um dicionário
  // de consumidor pode trazer o que quiser dentro dele.
  b.textContent = rotulo;
  return b;
}
