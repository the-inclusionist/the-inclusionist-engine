// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-typo — Typography panel (Estágio 4): extracted from game.js's renderTypo()/setGameFont(). Pure
// logic (catalog view-model, key→CSS-target mapping, persisted-value validation) is separated from the thin
// DOM-touching render()/setFont(). DI via initSettingsTypo(ctx): `$` (DOM selector), `srSay`, `store`
// (platform/storage shape) and `root` (the element the chosen font is applied to — document.documentElement in
// production). Overlay open/close plumbing (frontOverlay, focus management, the #typo hidden toggle, Escape
// handling) is the SHARED helper used by every settings panel and stays in game.js. The font catalog itself
// (FONT_GROUPS/FONT_BY_KEY) stays in ./fonts.js (Phase 2 extraction) — imported here, never duplicated.

// (`toggleLabel` saiu daqui em 2026-09-07: ele devolve «Ligado»/«Desligado», e este menu é uma ESCOLHA.)
import { t } from '../core/i18n.js';
import { FONT_BY_KEY, DEFAULT_FONT_KEY, faceAvailable, faceScale } from './fonts.js';
import { markChanged, markMenuChanged, CHANGED_CLASS } from './changed-mark.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface TypoStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

export interface SettingsTypoCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: TypoStore;
  /** Element the chosen font is applied to (dataset.fonte + --font-custom): document.documentElement in prod. */
  root: HTMLElement;
  /**
   * Move a prosa das linhas para o rodapé (`ui/settings-panel` → `fillExplain`). Chamado a CADA `render()`, e
   * não só ao abrir — que é o defeito que este parâmetro existe para fechar.
   *
   * `fillExplain` roda uma vez quando o overlay é frontalizado e reescreve cada `<span>` para conter só o
   * rótulo curto. Mas `render()` reconstrói o `#typo-list` inteiro a cada clique numa fonte, e as linhas novas
   * voltam com o `.opt-hint` dentro. Sem esta chamada a descrição aparece DUAS vezes — no rodapé, vinda da
   * primeira passada, e sob o nome da fonte, vinda do redesenho. O CLAUDE.md §4 avisa exatamente isso.
   *
   * OPCIONAL de propósito: um consumidor que monte este painel sem a casca (o segundo consumidor, um teste)
   * continua desenhando. O que ele não pode é desenhar prosa duplicada, e sem casca não há rodapé para duplicar.
   */
  fillExplain?: (card: HTMLElement | null) => void;
  /**
   * ESTA FAMÍLIA ESTÁ INSTALADA NO APARELHO? — em produção, `(f) => doc.fonts.check(\`16px "${f}"\`)`.
   *
   * É o que transforma o «enquanto» do ADR-0012 em código: a opção da Ronde fica desabilitada ENQUANTO
   * nenhuma das três faces estiver presente, e volta a ficar disponível quando o adulto instalar uma.
   *
   * ⚠️ INJECTADO E NUNCA `document.fonts` LIDO AQUI, pela regra que este ficheiro já segue para o `$`: um
   * global do navegador num módulo que corre em node é o ACHADO 15, e este projecto já pagou por ele com um
   * boot rebentado.
   * 📌 OPCIONAL, e aqui o padrão é mesmo seguro — ao contrário do `seguraTeclas` do `PauseIconsCtx`, onde os
   * dois lados erravam. Sem detector a linha fica desabilitada COM a mensagem, e a mensagem diz ao adulto as
   * três fontes que resolvem. O estado por omissão é o de hoje, e é accionável.
   */
  fonteInstalada?: (familia: string) => boolean;
}

export interface SettingsTypoApi {
  /** Re-renders #typo-list from current selection and (re)wires its buttons. Idempotent. */
  render: () => void;
  /** Selects+applies+persists a font by key; no-op for unknown/disabled keys. Mirrors old setGameFont(k,announce). */
  setFont: (k: string, announce?: boolean) => void;
  /** Currently selected font key. */
  getFontKey: () => string;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------


// A semantica da chave (validacao + migracao da chave antiga) mora em ui/fonts.ts, que e o dono do
// catalogo; re-exportada aqui para quem ja consome este modulo. Uma implementacao, nao duas.
export { resolveFontKey, persistFontKey } from './fonts.js';
import { resolveFontKey, persistFontKey } from './fonts.js';
import type { DomQuery } from '../core/dom-query.js';
import { controlRow, labelRow, sectionHeader } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
/*
 * 🎯 O QUE UMA ESCOLHA DE TIPOGRAFIA É mora em `./typo-choices.js` desde 2026-09-22 (nota BJ), e este ficheiro
 * ficou com o trabalho que o nome dele sempre descreveu: achar os nós que ele alcança e nunca criou, ligá-los,
 * e reflectir a escolha. Sem apelido deixado para trás — um re-export manteria vivo um caminho que nada aqui
 * usa e faria o retrato da superfície MENTIR, porque ele não vê re-exports (#204).
 */
import { typoGroups, typoRowSpec, fontCssTarget, type TypoRow } from './typo-choices.js';

/**
 * ⚠️ A MARCA DE SELEÇÃO, e ela existe porque COR NÃO É ESTADO.
 *
 * O `.mode-btn.is-on` pinta o botão com `var(--accent)` — o fundo amarelo que a emenda do ADR-0012 pede
 * por extenso. Mas quem não distingue a cor não vê estado nenhum, e é a mesma razão pela qual
 * `ui/activities-menu.ts:656` já emite ☑/☐ ao lado do `aria-checked`: «o estado em DUAS formas, e nenhuma
 * delas é cor».
 */
const MARCA_ESCOLHIDA = '●';
const MARCA_ALTERNATIVA = '○';

/**
 * Monta a lista UMA VEZ, dentro de um grupo de rádio só. Chamada de novo, REETIQUETA em vez de reconstruir.
 *
 * ⚠️ É UM GRUPO DE RÁDIO SÓ, ATRAVESSANDO AS TRÊS SECÇÕES, e isso é a decisão e não um detalhe de marcação: a
 * exclusividade é do MENU inteiro — uma fonte activa no total —, não de cada família. Três grupos diriam a
 * quem escuta que dá para ter uma sans E uma serif ao mesmo tempo. Por isso o `radiogroup` é do PAINEL e não
 * do kit: só o painel sabe onde a exclusividade acaba.
 *
 * 🔴 E O RÓTULO DE CADA LINHA É DESENHADO NA PRÓPRIA FACE, que é o comportamento central deste menu: uma lista
 * de dezassete NOMES não deixa ninguém escolher uma tipografia, e quem mais precisa de escolher é quem lê mal
 * a face que está a ver. A nota ao lado fica na face de LEITURA de propósito — ela explica a escolha, não é a
 * escolha. (Quando há `fillExplain`, ela nem chega a ficar na linha: vai para o rodapé.)
 */
export function mountTypoInside(ctx: PanelShellCtx, list: HTMLElement,
  fontKey: string, instalada?: (familia: string) => boolean): void {
  let radios = list.querySelector<HTMLElement>('[role="radiogroup"]');
  if (!radios) {
    radios = ctx.criar('div');
    radios.setAttribute('role', 'radiogroup');
    list.appendChild(radios);
  }
  radios.setAttribute('aria-label', t('font.grupo.rotulo'));
  for (const group of typoGroups(fontKey, instalada)) {
    const head = radios.querySelector(`[data-typo-group="${group.g}"]`)
      ? null
      : sectionHeader(ctx, group.g, '', group.rows.length);
    if (head) {
      head.setAttribute('data-typo-group', group.g);
      radios.appendChild(head);
    }
    for (const row of group.rows) {
      const spec = typoRowSpec(row);
      const old = ctx.procurar('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
      if (old) { labelRow(old, spec); dressRow(old, row); continue; }
      const { linha, controle } = controlRow(ctx, spec);
      controle.dataset.font = row.key;
      dressRow(linha, row);
      radios.appendChild(linha);
    }
  }
}

/** O que o kit não sabe sobre uma face: a própria face no rótulo, e a nota na face de leitura. */
function dressRow(where: HTMLElement, row: TypoRow): void {
  const label = where.querySelector<HTMLElement>(':scope > span');
  if (label) label.style.fontFamily = `'${row.fam}'`;
  const note = where.querySelector<HTMLElement>('.opt-hint');
  if (note) { note.style.fontFamily = 'var(--font)'; note.style.margin = '0'; }
}

/**
 * Reflecte a escolha sobre as linhas que já existem: a marca, o estado falado e a trava.
 *
 * 🔴 A MARCA ● / ○ EXISTE PORQUE COR NÃO É ESTADO. O `.mode-btn.is-on` pinta o botão com `var(--accent)` — o
 * fundo amarelo que a emenda do ADR-0012 pede por extenso —, mas quem não distingue a cor não vê estado
 * nenhum. É a mesma razão pela qual o menu de actividades já emite ☑/☐ ao lado do `aria-checked`: «o estado em
 * DUAS formas, e nenhuma delas é cor».
 *
 * 📌 A TRAVA é reflectida e não construída, porque ela pode MUDAR: a `ronde` só fica disponível no instante em
 * que o adulto instala uma das faces que a mensagem nomeia (ADR-0012, a palavra «enquanto»).
 */
function reflectTypo(list: HTMLElement, fontKey: string, instalada?: (familia: string) => boolean): void {
  // Percorre o que EXISTE na lista, e não o catálogo: reflectir é sobre os nós que já lá estão, e perguntar
  // ao catálogo outra vez seria montar a lista uma segunda vez só para a ler.
  for (const b of list.querySelectorAll<HTMLButtonElement>('button[data-font]')) {
    const it = FONT_BY_KEY[b.dataset.font ?? ''];
    const escolhida = b.dataset.font === fontKey;
    b.classList.toggle('is-on', escolhida);
    b.setAttribute('aria-checked', String(escolhida));
    b.textContent = escolhida ? MARCA_ESCOLHIDA : MARCA_ALTERNATIVA;
    b.disabled = !it || !faceAvailable(it, instalada);
  }
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsTypo(ctx: SettingsTypoCtx): SettingsTypoApi {
  let fontKey = resolveFontKey(ctx.store);

  /*
   * 📌 O CTX DO KIT SAI DO PRÓPRIO NÓ DA LISTA: `ownerDocument` é o documento onde ela VIVE, que é onde as
   * linhas têm de nascer. Assim o alcance global deste módulo continua zero (ADR-0221 passo 7d) e
   * `SettingsTypoCtx`, que é superfície publicada, não ganha membro obrigatório (ADR-0172).
   */
  const panelCtx = (list: HTMLElement): PanelShellCtx => ({
    procurar: (sel) => ctx.$<HTMLElement>(sel),
    criar: (tag) => list.ownerDocument.createElement(tag),
  });

  function setFont(k: string, announce = false): void {
    const it = FONT_BY_KEY[k];
    // A MESMA função das outras duas leituras: uma face que a lista mostra clicável tem de ser aceite aqui,
    // e uma que ela mostra cinzenta tem de ser recusada. Três respostas à mesma pergunta divergem.
    if (!it || !faceAvailable(it, ctx.fonteInstalada)) return;
    fontKey = k;
    persistFontKey(ctx.store, k);
    const target = fontCssTarget(k, it);
    ctx.root.dataset.fonte = target.fonte;
    /*
     * 🔴 A MARCA DA FACE LIGADA (ADR-0149 §3), e é ela que tira o espaçamento da BDA. `:root[data-cursiva]`
     * devolve `letter-spacing`/`word-spacing` a `normal`, porque espaçar uma cursiva parte-a nas junções que
     * a fazem cursiva — «para manter os conectores».
     *
     * ⚠️ APAGA QUANDO NÃO É, e não só escreve quando é: sem o `delete`, uma criança que escolhesse uma
     * cursiva e voltasse para a Atkinson ficava com a face de leitura SEM o espaçamento — o defeito na
     * direcção mais cara, porque quem volta para a face de leitura é quem precisa dele.
     */
    if (target.cursiva) ctx.root.dataset.cursiva = '1';
    else delete ctx.root.dataset.cursiva;
    if (target.customFamily) ctx.root.style.setProperty('--font-custom', target.customFamily);
    else ctx.root.style.removeProperty('--font-custom');
    // drawn at its floor, never under it (ADR-0176 §4): a face asking 20 px makes the text 25% larger; the others give it back
    ctx.root.style.setProperty('--fonte-escala', String(faceScale(it)));
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv) pv.style.fontFamily = `'${it.fam}'`;
    if (announce) ctx.srSay(t('sr.typo.font', { fam: it.fam }));
  }

  /*
   * As escutas ligam-se UMA VEZ, na lista, por delegação — e é a montagem única que o permite. Antes cada
   * render refazia os nós, logo cada render religava as dezassete; agora a lista é a mesma e o clique sobe
   * dela. ⚠️ Um botão `disabled` não emite clique, então a trava continua a ser o que protege a face que o
   * aparelho não tem — e não um guarda aqui, que seria a segunda resposta à mesma pergunta.
   */
  let listening = false;

  function render(): void {
    const el = ctx.$<HTMLElement>('#typo-list');
    if (!el) return;
    mountTypoInside(panelCtx(el), el, fontKey, ctx.fonteInstalada);
    reflectTypo(el, fontKey, ctx.fonteInstalada);
    if (!listening) {
      listening = true;
      el.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button[data-font]');
        const k = b?.dataset.font;
        if (!k) return;
        setFont(k, true);
        render();
      });
    }
    const cur = FONT_BY_KEY[fontKey];
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv && cur) pv.style.fontFamily = `'${cur.fam}'`;
    refreshMarks();
    // A ÚLTIMA COISA DO RENDER, e tem de ser: as linhas acabaram de ser recriadas com a prosa dentro delas.
    ctx.fillExplain?.(ctx.$<HTMLElement>('#typo .overlay__card'));
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Mora DENTRO do render porque é derivada, nunca guardada: ela é
   * recalculada de valor-atual-contra-padrão a cada desenho, então não tem como envelhecer no armazenamento.
   * Envelhecer na TELA ela tem — se algum dia alguém mudar a fonte sem redesenhar —, e é por isso que a
   * atualização anda junto com quem já redesenha, e não numa função própria que se possa esquecer de chamar.
   *
   * Aqui a linha marcada é a da fonte ESCOLHIDA, e só quando ela não é a padrão: as outras quinze não saíram
   * do padrão, foram apenas oferecidas.
   */
  function refreshMarks(): void {
    const changed = fontKey !== DEFAULT_FONT_KEY;
    const list = ctx.$<HTMLElement>('#typo-list');
    list?.querySelectorAll<HTMLElement>('.' + CHANGED_CLASS).forEach((el) => markChanged(el, false));
    const sel = list?.querySelector<HTMLElement>(`button[data-font="${fontKey}"]`);
    markChanged(sel?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="tipo"]'), [changed]);
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O menu mais simples dos oito: a tipografia guarda uma escolha só, então o reset é uma linha. Ainda assim
  // vale dizer para onde ele volta — a Atkinson Hyperlegible não é o padrão por ser bonita, é o padrão por ter
  // sido desenhada para quem tem baixa visão. Uma criança que experimentou seis fontes e não consegue mais ler
  // a tela precisa de um caminho de volta que termine na MAIS legível, não numa qualquer.
  //
  // O anúncio nomeia a fonte porque a mudança é visível para quem enxerga e invisível para quem não enxerga.
  const resetBtn = ctx.$<HTMLButtonElement>('#typo-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    setFont(DEFAULT_FONT_KEY, false);
    render();
    ctx.srSay(t('sr.typo.reset', { fam: FONT_BY_KEY[DEFAULT_FONT_KEY].fam }));
  });

  setFont(fontKey, false); // aplica a fonte persistida ao boot (== antigo `setGameFont(fontKey,false)`)

  return { render, setFont, getFontKey: () => fontKey };
}
