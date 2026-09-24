// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/panel-widgets — UMA LINHA DE MENU, construída em vez de exigida.
//
// ========================= O QUE ISTO CONSERTA, UM NÍVEL ABAIXO DO `panel-shell` =========================
// O `ui/panel-shell` curou o contrato invisível da MOLDURA: o painel exigia `#typo`, `#typo-list`,
// `#typo-reset`… e nada no tipo o dizia. 📏 Medido em 2026-09-11, o mesmo contrato invisível existe no
// INTERIOR: `ui/settings-audio` alcança TREZE controles que ele não cria, cada um com a tag certa
// (`#cane-div` tem de ser `<select>`, `#tts-vol` um `<input>`), e `ui/settings-mobility` alcança três. Nada no
// tipo diz isso também, e o modo de falhar é o mesmo — o painel abre e a linha simplesmente não está lá.
//
// Esse markup vivia no `app/index.html`, que saiu com o cartucho (#111). Desde então cada `settings-*` procura
// ids que ninguém cria.
//
// ========================= A REGRA DE MENU DO `CLAUDE.md` §4, POR CONSTRUÇÃO =========================
// «A explicação mora no RODAPÉ, e fica lá.» A linha carrega o rótulo curto em `<strong>` e nada mais à vista;
// toda a prosa entra num ÚNICO `.opt-hint` dentro do `<span>`, que a casca (`ui/settings-panel.fillExplain`)
// MOVE para o rodapé `.opt-explain`.
//
// ⚠️ E AQUI ELA DEIXA DE DEPENDER DE ALGUÉM SE LEMBRAR: esta função não tem por onde receber um segundo bloco
// de prosa, nem um `<p>` solto. O Dev já viu o resultado da outra forma — «o menu virou um manual, mais
// parecido com um arquivo de configuração do que com um menu de videogame».
//
// Sem `innerHTML`: tudo por `criar` + `textContent`, no molde do `ui/panel-shell`. O texto chega do CHAMADOR já
// traduzido, para este módulo poder ser exercitado sem dicionário.
import type { PanelShellCtx } from './panel-shell.js';

/**
 * A FORMA do controle, e não a tag — porque a pergunta que um painel faz é «isto liga e desliga?», não «isto é
 * um `<button>`?».
 *
 * 📏 As três saem de uma medição dos oito painéis: `interruptor` cobre onze dos controles que eles alcançam,
 * `escolha` três (`#cane-div`, `#tts-engine`, `#tts-voice`) e `cursor` três (`#audio-master-vol`,
 * `#navsound-master`, `#tts-vol`). Uma quarta forma entra quando um painel a exigir, e não antes.
 */
export type ControlShape = 'interruptor' | 'escolha' | 'cursor' | 'radio' | 'button';

export interface ControlRowSpec {
  /** O id do CONTROLE — `opt-facil`, `cane-div`. É por ele que o `settings-*` o encontra. */
  readonly id: string;
  /** O rótulo CURTO, já traduzido. Vai no `<strong>`, e é a única coisa à vista na linha. */
  readonly label: string;
  /**
   * A explicação, já traduzida. Vai num ÚNICO `.opt-hint`, que o `fillExplain` move para o rodapé.
   *
   * 📌 Ausente = esta linha não tem explicação, que é uma resposta legítima. O rodapé então descansa no texto
   * do painel (`data-explain-idle`) enquanto o cursor estiver nela.
   */
  readonly hint?: string;
  /** A forma do controle. Ausente: `interruptor`, que é o caso de onze dos dezassete medidos. */
  readonly shape?: ControlShape;
  /**
   * O nome que um leitor de tela anuncia, quando ele não é o rótulo.
   *
   * ⚠️ EXISTE PORQUE O TEXTO DO INTERRUPTOR É O ESTADO, e não o nome: um `<button>` cujo `textContent` diz
   * «▶ Desligado» anuncia «Desligado, botão» e a pessoa não sabe desligado O QUÊ. O `<strong>` ao lado resolve
   * isso para quem VÊ a linha inteira; para quem navega controlo a controlo, resolve-o este atributo.
   * Ausente, cai no `rotulo` — que é a resposta certa e não um recuo.
   */
  readonly ariaLabel?: string;
}

export interface ControlRow {
  /** A `.ctrl-row` inteira. É nela que o `markChanged` do ADR-0029 põe a marca de «saiu do padrão». */
  readonly row: HTMLElement;
  /** O controle em si, com o id pedido. */
  readonly controle: HTMLElement;
}

/**
 * Constrói uma linha de menu: rótulo curto, uma dica que vai para o rodapé, e um controle.
 *
 * A linha NÃO é inserida em lado nenhum — quem a monta decide a ordem, que nos menus deste projeto é parte da
 * decisão (ADR-0044 §2).
 */
export function controlRow(ctx: PanelShellCtx, spec: ControlRowSpec): ControlRow {
  const rowNode = ctx.create('div');
  rowNode.className = 'ctrl-row';

  const texto = ctx.create('span');
  const shortLabel = ctx.create('strong');
  shortLabel.textContent = spec.label;
  texto.appendChild(shortLabel);
  if (spec.hint) {
    // ⚠️ UM SÓ, e é o que o `fillExplain` procura. Dois `.opt-hint` na mesma linha davam duas descrições ao
    // mesmo controle, e o rodapé mostraria a primeira — a outra ficaria na linha, que é exactamente o defeito
    // que a regra §4 existe para impedir.
    const explanation = ctx.create('span');
    explanation.className = 'opt-hint';
    explanation.textContent = spec.hint;
    texto.appendChild(explanation);
  }
  rowNode.appendChild(texto);

  const controle = buildControl(ctx, spec);
  controle.id = spec.id;
  controle.setAttribute('aria-label', spec.ariaLabel ?? spec.label);
  rowNode.appendChild(controle);

  return { row: rowNode, controle };
}

/**
 * REESCREVE AS PALAVRAS DE UMA LINHA QUE JÁ EXISTE — o par do `ui/panel-shell.applyLabels`, um nível
 * abaixo.
 *
 * 🔴 O DEFEITO QUE ISTO FECHA FOI MEDIDO NUM NAVEGADOR A SÉRIO, em 2026-09-12, com `lang="en"`: o painel
 * auditivo servia o TÍTULO em inglês e as LINHAS em português, na mesma tela. A moldura ganhou a correcção
 * quando `MountPanelSpec.rotulos` passou a ser resolvido a cada abertura; o interior ficou para trás, porque
 * `montarInterior*` corre uma vez e captura o texto do intervalo de arranque — `initI18n` aplica o idioma de
 * recuo de forma síncrona e PEDE o preferido, que chega depois.
 *
 * ⚠️ E NENHUM TESTE UNITÁRIO O APANHA, porque todos correm num idioma só. É o mesmo buraco que a barra de
 * ícones já pagou em 08/09, agora um nível mais fundo.
 *
 * ⚠️ REESCREVER E NÃO RECONSTRUIR, pela razão que o `applyLabels` já escreveu: cada `ui/settings-*` liga
 * os cliques dos seus controles UMA VEZ, no arranque. Refazer a linha deixaria um controle no documento e sem
 * escuta — um botão morto com aparência de vivo (ADR-0106 §5).
 */
export function labelRow(rowNode: HTMLElement, spec: ControlRowSpec): void {
  const shortLabel = rowNode.querySelector<HTMLElement>('strong');
  if (shortLabel) shortLabel.textContent = spec.label;
  const explanation = rowNode.querySelector<HTMLElement>('.opt-hint');
  // ⚠️ A dica que SOME tem de ser apagada, e não só deixar de ser escrita: numa retradução para um dicionário
  // sem a chave, o texto antigo sobreviveria e o rodapé descansaria no idioma anterior.
  if (explanation) explanation.textContent = spec.hint ?? '';
  // The control is found by COMPARING its id, not by building a selector from it: a selector needs the id escaped, escaping
  // needs `CSS.escape`, and `CSS` is a browser global that THROWS where it does not exist — it took down a boot in a case's fake
  // document once (2026-09-21). No selector, nothing to escape, no global (ADR-0221 step 7d).
  const controle = [...rowNode.querySelectorAll<HTMLElement>('[id]')].find((el) => el.id === spec.id);
  if (controle) controle.setAttribute('aria-label', spec.ariaLabel ?? spec.label);
}

function buildControl(ctx: PanelShellCtx, spec: ControlRowSpec): HTMLElement {
  const controlShape = spec.shape ?? 'interruptor';
  if (controlShape === 'escolha') {
    const s = ctx.create('select');
    s.className = 'vol';
    return s;
  }
  if (controlShape === 'cursor') {
    const i = ctx.create('input');
    i.className = 'vol';
    i.setAttribute('type', 'range');
    // Os limites do cursor de volume, iguais aos que o painel de áudio já lê. Um `range` sem `min`/`max`
    // assume 0..100 com passo 1, e o volume deste projeto é 0..1 — sem isto, o primeiro passo salta tudo.
    i.setAttribute('min', '0');
    i.setAttribute('max', '100');
    i.setAttribute('step', '1');
    return i;
  }
  if (controlShape === 'button') {
    /*
     * 🎯 A QUINTA FORMA, e é a única que NÃO GUARDA um valor: as outras quatro respondem «em que posição
     * estou», esta FAZ uma coisa. O `ui/settings-controls` é o primeiro a exigi-la — o botão dele abre a
     * captura de uma tecla —, e a regra escrita no topo deste ficheiro é essa: uma forma entra quando um
     * painel a pede, e não antes.
     *
     * 📌 Sem `aria-pressed` e sem `role`: um botão que executa já É um botão para quem ouve, e um estado
     * anunciado que não existe é pior do que estado nenhum. Quem põe a CARA nele é o painel — no caso do
     * remapeamento, as teclas de agora —, porque só ele sabe o que o botão mostra.
     */
    const a = ctx.create('button');
    a.className = 'mode-btn';
    a.setAttribute('type', 'button');
    return a;
  }
  if (controlShape === 'radio') {
    /*
     * 🔴 UMA ESCOLHA NÃO É UM INTERRUPTOR, e a diferença é o que a emenda do ADR-0012 diz em tantas palavras:
     * «THE MENU IS A CHOICE, NOT A TOGGLE […] One font is active; the others are alternatives, not switches.»
     * Daí as três diferenças: sem a classe `switch` (que desenha uma chave de 52×28 px com bolinha, o desenho
     * de um estado que não existe), `role="radio"` em vez de nada, e `aria-checked` em vez de `aria-pressed` —
     * dezassete interruptores independentes anunciariam «Ligado/Desligado» para escolher UMA coisa.
     *
     * 📌 A quarta forma entra agora porque um painel a EXIGIU, que é a regra escrita no topo deste ficheiro. O
     * `ui/settings-typo` é o primeiro; quem agrupar os `role="radio"` num `role="radiogroup"` é o painel, e
     * não o kit, porque é o painel que sabe se a exclusividade é de uma secção ou do menu inteiro.
     */
    const r = ctx.create('button');
    r.className = 'mode-btn';
    r.setAttribute('type', 'button');
    r.setAttribute('role', 'radio');
    r.setAttribute('aria-checked', 'false');
    return r;
  }
  const b = ctx.create('button');
  // `switch` é a classe que o CSS deste projeto já dá aos interruptores, e `aria-pressed` é o que diz o estado
  // a quem ouve. Quem reflete o valor é o painel; o que nasce aqui é o estado HONESTO de quem ainda não leu
  // nada: desligado.
  b.className = 'mode-btn switch';
  b.setAttribute('type', 'button');
  b.setAttribute('aria-pressed', 'false');
  return b;
}

/* ===================== O CABEÇALHO DE SECÇÃO — «de quem é a vez de agir» ===================== */

/**
 * O cabeçalho de uma secção de painel: um título e uma etiqueta que o qualifica.
 *
 * 📏 Entra no kit porque QUATRO sítios o escreviam à mão como cadeia — `ui/map-hub`, `ui/settings-motion`
 * (duas vezes), `ui/settings-typo` e o `ui/settings-caa` que os trouxe aqui —, e a marcação de `.panel-sub__tag`
 * estava copiada em todos. É a mesma razão do `controlRow`: uma regra repetida em quatro ficheiros é uma regra
 * que diverge.
 *
 * ⚠️ E ELE RECUSA-SE A EXISTIR SOBRE O VAZIO, que é o comportamento pelo qual vale ser uma função. Um
 * «Aguardando negociação» sem uma linha por baixo conta a quem lê que há algo ali e não há, e a pessoa procura
 * o que o título promete. `rows` é o NÚMERO de linhas que a secção vai ter — passá-lo é o que torna esta
 * regra exercível por um caso, em vez de um `if` que nenhuma árvore fixa alcança.
 *
 * 📌 O título e a etiqueta chegam JÁ TRADUZIDOS, como no `controlRow`: o kit não decide língua, monta forma.
 */
export function sectionHeader(ctx: PanelShellCtx, title: string, tag: string, rows: number): HTMLElement | null {
  if (rows === 0) return null;
  const h = ctx.create('h3');
  h.className = 'panel-sub';
  h.textContent = title + ' ';
  const mark = ctx.create('span');
  mark.className = 'panel-sub__tag';
  mark.textContent = tag;
  h.appendChild(mark);
  return h;
}

/* ===================== OS PASSOS ⯇ ⯈ — escolher entre posições com esquerda e direita (ADR-0151) ===================== */

/**
 * O que um controle de passos precisa: um nome, as posições (já traduzidas) e a de agora.
 *
 * 🎯 PEDIDO DO DEV, e com uma forma exacta: o realce de contraste «deve funcionar trocando entre desligado,
 * linear, misto e quadrático da mesma forma que se troca o número de jogadores, isto é, apertando botões
 * direita e esquerda, e não através de uma barra», e os cantos arredondados «também». Uma barra esconde quantas
 * posições há; uma lista suspensa esconde-as todas até abrir. Os passos dizem sempre onde se está.
 *
 * 🔴 E A FORMA É UMA LINHA SÓ: «◀ Rótulo: valor ▶» (errata do ADR-0130, regra 3). A primeira construção pôs o rótulo
 * à esquerda e uma caixa «◀ pequeno ▶» à direita, e o Dev: «Não faça essa coisa estranha. Escreva "< Rounded
 * corner: off >"». É a forma de ciclar entre POUCAS posições — até cinco; acima disso, lista suspensa.
 */
export interface StepsSpec {
  /** O nome falado do controle — vai para o `aria-label`. */
  readonly label: string;
  /** As posições, na ordem, já traduzidas. */
  readonly values: readonly string[];
  /** O índice da posição de agora. */
  readonly current: number;
}

/**
 * O passo seguinte, PRESO nas pontas — e não em anel, e a diferença é a decisão.
 *
 * ⚠️ Num anel, «direita» a partir de «grande» voltava a «desligado»: quem ajusta à procura do máximo passaria por
 * ele sem aviso e desligaria o que queria aumentar. Preso, a ponta é uma parede que se sente — o número de
 * jogadores, que é o modelo que o Dev deu, também não dá a volta.
 */
export function nextStep(from: number, total: number, delta: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, from + Math.sign(delta)));
}

/**
 * Constrói o controle: UM elemento focável (`role="spinbutton"`) com as duas setas dentro.
 *
 * ⚠️ AS SETAS NÃO SÃO BOTÕES, e é de propósito: a navegação de menus trata todo `button` como item, e três
 * itens para um só ajuste fariam o cursor parar duas vezes em setas sem nome. O foco é do controle; as setas são
 * alvo de DEDO (`data-passo`), e ficam fora da árvore de acessibilidade — quem ouve recebe o `aria-valuetext`.
 *
 * O controle emite `passo` (`CustomEvent<number>`, -1 ou +1): a seta tocada emite-o daqui, e a esquerda e a
 * direita do teclado e do controle emitem-no pelo `ui/menu-nav`. Quem usa ouve um evento só.
 */
export function mountSteps(ctx: PanelShellCtx, spec: StepsSpec): HTMLElement {
  const el = ctx.create('div');
  el.className = 'passos';
  el.setAttribute('role', 'spinbutton');
  el.setAttribute('tabindex', '0');
  el.setAttribute('data-passos', '');
  const arrow = (delta: -1 | 1, glyph: string): HTMLElement => {
    const s = ctx.create('span');
    s.className = 'passo-seta';
    s.setAttribute('data-passo', String(delta));
    s.setAttribute('aria-hidden', 'true');
    s.textContent = glyph;
    s.addEventListener('click', () => el.dispatchEvent(new CustomEvent('passo', { detail: delta, bubbles: true })));
    return s;
  };
  const valor = ctx.create('span');
  valor.className = 'passo-valor';
  el.appendChild(arrow(-1, '◀'));
  el.appendChild(valor);
  el.appendChild(arrow(1, '▶'));
  updateSteps(el, spec);
  return el;
}

/** Reflecte a posição de agora: o valor escrito, o que se ouve, e as pontas que já não andam. */
export function updateSteps(el: HTMLElement, spec: StepsSpec): void {
  const lastIndex = Math.max(0, spec.values.length - 1);
  const from = Math.max(0, Math.min(lastIndex, spec.current));
  const texto = spec.values[from] ?? '';
  el.setAttribute('aria-label', spec.label);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(lastIndex));
  el.setAttribute('aria-valuenow', String(from));
  el.setAttribute('aria-valuetext', texto);
  const valor = el.querySelector<HTMLElement>('.passo-valor');
  // O RÓTULO ENTRA NO TEXTO: a linha inteira é o controle, «◀ Cantos arredondados: pequeno ▶». Quem ouve recebe o
  // mesmo em duas partes — o nome no `aria-label` e a posição no `aria-valuetext` —, sem o nome repetido.
  if (valor) valor.textContent = spec.label ? `${spec.label}: ${texto}` : texto;
  // A ponta que já não anda fica marcada — sem isto a seta de uma parede parece um botão avariado.
  el.querySelector<HTMLElement>('[data-passo="-1"]')?.classList.toggle('no-limite', from === 0);
  el.querySelector<HTMLElement>('[data-passo="1"]')?.classList.toggle('no-limite', from === lastIndex);
}
