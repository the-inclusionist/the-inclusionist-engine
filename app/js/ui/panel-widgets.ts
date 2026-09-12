// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/panel-widgets — UMA LINHA DE MENU, construída em vez de exigida.
//
// ========================= O QUE ISTO CONSERTA, UM NÍVEL ABAIXO DO `panel-shell` =========================
// O `ui/panel-shell` curou o contrato invisível da MOLDURA: o painel exigia `#typo`, `#typo-list`,
// `#typo-reset`… e nada no tipo o dizia. 📏 Medido em 2026-09-11, o mesmo contrato invisível existe no
// INTERIOR: `ui/settings-audio` alcança TREZE controles que ele não cria, cada um com a tag certa
// (`#cane-div` tem de ser `<select>`, `#tts-vol` um `<input>`), e `ui/settings-motor` alcança três. Nada no
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
export type FormaDoControle = 'interruptor' | 'escolha' | 'cursor';

export interface ControlRowSpec {
  /** O id do CONTROLE — `opt-facil`, `cane-div`. É por ele que o `settings-*` o encontra. */
  readonly id: string;
  /** O rótulo CURTO, já traduzido. Vai no `<strong>`, e é a única coisa à vista na linha. */
  readonly rotulo: string;
  /**
   * A explicação, já traduzida. Vai num ÚNICO `.opt-hint`, que o `fillExplain` move para o rodapé.
   *
   * 📌 Ausente = esta linha não tem explicação, que é uma resposta legítima. O rodapé então descansa no texto
   * do painel (`data-explain-idle`) enquanto o cursor estiver nela.
   */
  readonly dica?: string;
  /** A forma do controle. Ausente: `interruptor`, que é o caso de onze dos dezassete medidos. */
  readonly forma?: FormaDoControle;
  /**
   * O nome que um leitor de tela anuncia, quando ele não é o rótulo.
   *
   * ⚠️ EXISTE PORQUE O TEXTO DO INTERRUPTOR É O ESTADO, e não o nome: um `<button>` cujo `textContent` diz
   * «▶ Desligado» anuncia «Desligado, botão» e a pessoa não sabe desligado O QUÊ. O `<strong>` ao lado resolve
   * isso para quem VÊ a linha inteira; para quem navega controlo a controlo, resolve-o este atributo.
   * Ausente, cai no `rotulo` — que é a resposta certa e não um recuo.
   */
  readonly rotuloAria?: string;
}

export interface ControlRow {
  /** A `.ctrl-row` inteira. É nela que o `markChanged` do ADR-0029 põe a marca de «saiu do padrão». */
  readonly linha: HTMLElement;
  /** O controle em si, com o id pedido. */
  readonly controle: HTMLElement;
}

/**
 * Constrói uma linha de menu: rótulo curto, uma dica que vai para o rodapé, e um controle.
 *
 * A linha NÃO é inserida em lado nenhum — quem a monta decide a ordem, que nos menus deste projeto é parte da
 * decisão (ADR-0044 §2).
 */
export function linhaDeControle(ctx: PanelShellCtx, spec: ControlRowSpec): ControlRow {
  const linha = ctx.criar('div');
  linha.className = 'ctrl-row';

  const texto = ctx.criar('span');
  const forte = ctx.criar('strong');
  forte.textContent = spec.rotulo;
  texto.appendChild(forte);
  if (spec.dica) {
    // ⚠️ UM SÓ, e é o que o `fillExplain` procura. Dois `.opt-hint` na mesma linha davam duas descrições ao
    // mesmo controle, e o rodapé mostraria a primeira — a outra ficaria na linha, que é exactamente o defeito
    // que a regra §4 existe para impedir.
    const dica = ctx.criar('span');
    dica.className = 'opt-hint';
    dica.textContent = spec.dica;
    texto.appendChild(dica);
  }
  linha.appendChild(texto);

  const controle = criarControle(ctx, spec);
  controle.id = spec.id;
  controle.setAttribute('aria-label', spec.rotuloAria ?? spec.rotulo);
  linha.appendChild(controle);

  return { linha, controle };
}

function criarControle(ctx: PanelShellCtx, spec: ControlRowSpec): HTMLElement {
  const forma = spec.forma ?? 'interruptor';
  if (forma === 'escolha') {
    const s = ctx.criar('select');
    s.className = 'vol';
    return s;
  }
  if (forma === 'cursor') {
    const i = ctx.criar('input');
    i.className = 'vol';
    i.setAttribute('type', 'range');
    // Os limites do cursor de volume, iguais aos que o painel de áudio já lê. Um `range` sem `min`/`max`
    // assume 0..100 com passo 1, e o volume deste projeto é 0..1 — sem isto, o primeiro passo salta tudo.
    i.setAttribute('min', '0');
    i.setAttribute('max', '100');
    i.setAttribute('step', '1');
    return i;
  }
  const b = ctx.criar('button');
  // `switch` é a classe que o CSS deste projeto já dá aos interruptores, e `aria-pressed` é o que diz o estado
  // a quem ouve. Quem reflete o valor é o painel; o que nasce aqui é o estado HONESTO de quem ainda não leu
  // nada: desligado.
  b.className = 'mode-btn switch';
  b.setAttribute('type', 'button');
  b.setAttribute('aria-pressed', 'false');
  return b;
}
