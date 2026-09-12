// SPDX-License-Identifier: AGPL-3.0-or-later
// O TAMANHO DO ALVO, MEDIDO NO LAYOUT DE VERDADE — item 6 do ADR-0044.
//
// ========================= POR QUE ESTE GATE É DE NAVEGADOR, E NÃO DE TEXTO =========================
// Os outros gates de CSS deste repositório leem o `style.css` e conferem declarações. Aqui isso não bastaria:
// a altura de um botão não está declarada em lugar nenhum — ela SAI de `padding` + `line-height` + `font-size`
// + o que a cascata fizer com os três. Foi assim que os 35,6 px do cartão de pausa apareceram: ninguém os
// escreveu, eles resultaram. Um gate que lesse `min-height:44px` no arquivo provaria que a linha existe, não
// que o botão tem 44 px.
//
// Então este arquivo IMPORTA O `style.css` de verdade, monta um cartão de pausa com a marcação de produção e
// MEDE com `getBoundingClientRect`. É a mesma diferença entre "o modo promete 7:1" e "o par mede 7,80:1".
//
// ========================= O QUE 44 É, E O QUE NÃO É =========================
// 44 NÃO é o mínimo da WCAG — o 2.5.8 pede 24×24 CSS px, e o cartão já passava nisso com folga. 44 é a
// recomendação da Apple (HIG), e este projeto trata piso como piso.
//
// MAS A DEFESA MAIS FORTE NÃO É NENHUMA DAS DUAS NORMAS — é a régua física que este projeto já tinha. O Dev
// questionou o número ("44 é exagero"), e a resposta que sobreviveu ao questionamento veio do painel de toque
// dele mesmo: "11–12,5 mm = mão de criança (6–12 anos)… mínimo 11 mm: abaixo disso o polegar erra mais e
// segurar cansa antes (base: alvo de polegar ~9,6 mm)". A 96 px/pol, 44 CSS px = 11,6 mm — dentro da faixa.
// O caso [Interface] no fim prende esse RACIOCÍNIO, e não só o número: quando alguém propuser baixar o alvo,
// o que se perde não é "a recomendação da Apple", são milímetros de polegar.
//
// ========================= O QUE EU TINHA ERRADO, E ELE CORRIGIU =========================
// O questionamento foi: "a tela é desenhada para 320×180 e o mínimo em uso é 640×360, logo o botão precisa de
// 22 no desenho de base". O raciocínio é CERTO — para o que é desenhado DENTRO da canvas. Não é o caso
// destes botões, e a medição diz por quê: o 320×180 é o buffer da canvas, e `#game-region`/`#dom-layer` são
// 640×360 CSS com `transform: none`. A camada DOM nunca entra naquele sistema de coordenadas.
//
// O que ele acertou em cheio foi o TAMANHO DO QUADRO: o gate media 420×300, um número que eu inventei. O piso
// de verdade é 640×360, e é ele que o [Boundary] usa agora. Medir num quadro que ninguém vive é não medir.
//
// ⚠️ E A MEDIÇÃO EXPÔS UM CUSTO ainda não resolvido: a 640×360 o cartão tem 413px de conteúdo para 353
// visíveis — os sete itens de 44px NÃO CABEM e a lista rola. Para quem navega às cegas a rolagem é inofensiva
// (o anel dá a volta e cada item se anuncia); para o dedo é uma rolagem a mais. A escolha entre rolar,
// encolher espaçamentos ou esconder o cabeçalho é do Dev.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { screenPauseMarkup } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';
import { alvoMinimoDeToque } from '../app/js/ui/layout.js';

/** O alvo do ADR-0044 §6, em CSS px. */
const ALVO_PX = 44;

/**
 * O MENOR QUADRO EM USO, e ele não é o 320×180 do desenho.
 *
 * Isto foi corrigido pelo Dev depois de eu ter escrito o gate com um "420×300" que era invenção minha. O
 * 320×180 é o BUFFER da canvas; o navegador o amplia 2× e a região fica em 640×360 CSS. E a camada DOM — o
 * cartão de pausa, a barra de acessibilidade, os controles de toque — não entra nesse sistema de
 * coordenadas: MEDIDO no jogo construído, `#game-region` e `#dom-layer` são 640×360 CSS com
 * `transform: none`. Um botão declarado 44px mede 44 CSS px na tela, não 88.
 *
 * Medir num quadro que a produção não tem é medir uma coisa que ninguém vive. O gate passa a usar o piso de
 * verdade.
 */
const MENOR_QUADRO = { w: 640, h: 360 };

/**
 * POR QUE 44, e a defesa mais forte não é a norma — é a régua do próprio projeto.
 *
 * A WCAG 2.5.8 pede 24×24 e a Apple recomenda 44; as duas são argumentos de autoridade. O que decide aqui é
 * a MEDIDA FÍSICA, que o painel de toque deste jogo já fixou: "11–12,5 mm = mão de criança (6–12 anos)…
 * mínimo 11 mm: abaixo disso o polegar erra mais e segurar cansa antes (base: alvo de polegar ~9,6 mm)".
 *
 * A 96 px/pol, 44 CSS px = 11,6 mm — dentro da faixa da mão de criança. E 22 px, que seria a conta se estes
 * botões vivessem no espaço 320×180, dariam 5,8 mm: abaixo do alvo de polegar que o próprio painel cita, e
 * abaixo do piso de 24 px da WCAG. A conversão supõe 96 px/pol; no hardware de escola só o aparelho responde.
 */
const MM_POR_PX = 25.4 / 96;

let palco;

/** Monta um cartão de pausa REAL dentro de um quadro do tamanho pedido, e devolve o `.screen-pause`. */
function montar(largura, altura) {
  palco = document.createElement('div');
  palco.className = 'player-screen';
  palco.style.cssText = `position:relative;width:${largura}px;height:${altura}px`;
  const sp = document.createElement('div');
  sp.className = 'screen-pause';
  sp.innerHTML = screenPauseMarkup({
    player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS,
    dynLabel: () => null, t: (k) => k,
  });
  palco.appendChild(sp);
  document.body.appendChild(palco);
  return sp;
}

const itensVisiveis = (sp) => [...sp.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { if (palco) palco.remove(); palco = null; });

describe('menu de pausa · 44 px, centrado e mais largo (ADR-0044, item 6)', () => {
  it('[Zero] o gate está medindo layout de verdade', () => {
    // Sem isto, um `style.css` que não carregasse deixaria todo caso abaixo medindo caixas de altura zero —
    // e um gate que passa por não medir nada é pior que nenhum.
    const sp = montar(900, 700);
    const itens = itensVisiveis(sp);
    expect(itens).toHaveLength(PM_BTNS.length);
    expect(itens[0].getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(sp).position, 'o style.css não foi aplicado').toBe('absolute');
  });

  it('[Right] todo item da lista tem ao menos 44 px de altura', () => {
    const sp = montar(900, 700);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Boundary] no MENOR quadro em uso (640×360) o alvo não encolhe', () => {
    // A regra quebrava exatamente aqui: `.screen-pause .pm-btn` apertava o padding para caber mais coisa no
    // quadro menor — que é o pior lugar possível para encolher um alvo de toque. O cartão rola; o botão não.
    //
    // E o quadro é o de VERDADE agora: 640×360, o piso que a produção usa. A primeira versão media 420×300,
    // um número que eu inventei — e medir um quadro que ninguém vive é não medir.
    const sp = montar(MENOR_QUADRO.w, MENOR_QUADRO.h);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'no quadro apertado, item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Right] a lista é UMA coluna — o que se vê é a ordem em que se anda', () => {
    // Era `grid-template-columns:1fr 1fr`. Numa grade de duas colunas a seta anda em ordem de DOM, então
    // "para baixo" pula para a coluna da direita — a mesma mentira que os submenus da abertura contavam.
    const sp = montar(900, 700);
    const esquerdas = new Set(itensVisiveis(sp).map((b) => Math.round(b.getBoundingClientRect().left)));
    expect([...esquerdas], 'a lista voltou a ter mais de uma coluna').toHaveLength(1);
  });

  it('[Right] a lista é CENTRADA no cartão e mais larga que um botão de antes', () => {
    const sp = montar(900, 700);
    const card = sp.querySelector('.pause-card').getBoundingClientRect();
    const lista = sp.querySelector('.pause-menu:not([hidden])').getBoundingClientRect();
    const desvio = Math.abs((lista.left + lista.right) / 2 - (card.left + card.right) / 2);
    expect(desvio, 'a lista saiu do centro do cartão').toBeLessThan(2);
    // 262 px era a largura MEDIDA de um item antes desta decisão (ver o ADR-0044). "Mais larga" tem de ser
    // um número, senão é opinião.
    expect(lista.width, 'a lista não ficou mais larga que os 262 px medidos antes').toBeGreaterThan(262);
  });

  it('[Interface] 44 CSS px é a MEDIDA FÍSICA que o painel de toque deste jogo já exigia', () => {
    // O caso existe para prender o RACIOCÍNIO, e não só o número. Quando alguém propuser baixar o alvo — e a
    // proposta é razoável à primeira vista, porque 44px de 360 é 12% da altura da tela —, é esta linha que
    // diz o que se perde: não "a recomendação da Apple", mas milímetros de polegar.
    expect(+(ALVO_PX * MM_POR_PX).toFixed(1), '44 CSS px saiu da faixa da mão de criança (11–12,5 mm)').toBeGreaterThanOrEqual(11);
    expect(+(22 * MM_POR_PX).toFixed(1), 'a alternativa de 22 px daria menos que o alvo de polegar (9,6 mm)').toBeLessThan(9.6);
    expect(ALVO_PX, 'abaixo de 24 o alvo furaria o piso da WCAG 2.5.8, não só a recomendação da Apple').toBeGreaterThanOrEqual(24);
  });

  it('[Interface] o submenu de opções obedece à MESMA régua', () => {
    // Ele é a lista onde a criança passa mais tempo, item por item, ajustando o que a atrapalha. Seria o
    // último lugar a merecer botão menor — e o primeiro a escapar de um gate que só olhasse a raiz.
    const sp = montar(900, 700);
    sp.querySelector('.pause-menu[data-sub="raiz"]').hidden = true;
    sp.querySelector('.pause-menu[data-sub="opcoes"]').hidden = false;
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item do submenu abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
    expect(itensVisiveis(sp).length).toBe(PM_OPTIONS_BTNS.length);
  });
});

// ===================================================================================================
// A RÉGUA POR ALTURA DE VIEWPORT (ADR-0095) — o alvo deixou de ser UM número
// ===================================================================================================
// ⚠️ ESTE BLOCO É A RESPOSTA À PERGUNTA QUE O CABEÇALHO DESTE FICHEIRO DEIXOU EM ABERTO. Ele mediu que a
// 640×360 o cartão não cabe e a lista rola, e escreveu que «a escolha entre rolar, encolher espaçamentos ou
// esconder o cabeçalho é do Dev». O Dev escolheu uma QUARTA saída, que não estava na lista: o alvo passa a
// ser função da ALTURA DO VIEWPORT, com os dois extremos ancorados nas duas normas.
//
//     altura ≥ 720   44 px   WCAG 2.2 · 2.5.5 (Enhanced) — AAA
//     altura ≥ 540   34 px   o degrau do meio
//     altura <  540  24 px   WCAG 2.2 · 2.5.8 (Minimum)  — AA
//
// ⚠️ E A RÉGUA É UM PISO, NÃO UM VALOR. Nada obriga o cartão a usar 24 px em 360; o que ela dá é a LICENÇA
// de descer até lá. Medido: em 360 o excesso é de 42 px e descer os sete itens a 24 libertaria 140 — a
// decisão resolve o encaixe com margem larga, e é essa margem que o `[Boundary]` do excesso vigia.
describe('o alvo de toque segue a régua da altura de viewport (ADR-0095)', () => {
  /** A altura MEDIDA do menor item visível, no quadro pedido. */
  function menorItem(largura, altura) {
    const sp = montar(largura, altura);
    return Math.min(...itensVisiveis(sp).map((b) => b.getBoundingClientRect().height));
  }

  it('[Interface] a régua é do CÓDIGO, não deste teste — e os degraus são os três do Dev', () => {
    // ⚠️ A régua vive em `ui/layout` e é importada aqui. Copiá-la para dentro do gate seria a divergência
    // clássica: alguém muda o degrau no código, o gate segue aferindo o degrau antigo e continua verde.
    expect(alvoMinimoDeToque(720)).toBe(44);
    expect(alvoMinimoDeToque(540)).toBe(34);
    expect(alvoMinimoDeToque(360)).toBe(24);
  });

  it('[Right] em cada um dos três degraus o item medido respeita o PISO daquele degrau', () => {
    for (const h of [360, 540, 720]) {
      const piso = alvoMinimoDeToque(h);
      const medido = menorItem(640, h);
      expect(medido, `a ${h}px de altura o item mede ${medido.toFixed(1)}px, abaixo do piso de ${piso}px`)
        .toBeGreaterThanOrEqual(piso - 0.5);
      palco.remove(); palco = null;
    }
  });

  /** Monta o cartão com a variável que `layout()` escreveria para aquela altura — o caminho de produção. */
  function montarComRegua(largura, altura) {
    const sp = montar(largura, altura);
    palco.style.setProperty('--alvo-min', alvoMinimoDeToque(altura) + 'px');
    return sp;
  }

  it('⚠️ [Right] o item SEGUE a régua quando `layout()` escreve a variável', () => {
    // ⚠️ SEM ESTE CASO O CONSERTO NÃO ESTAVA PROVADO. Os casos acima montam o cartão sem `layout()`, então
    // `--alvo-min` não existe e o `.pm-btn` cai no fallback de 44 px — que é o valor de ANTES. Eles ficavam
    // verdes sobre um CSS que nunca tinha lido a régua.
    const sp = montarComRegua(640, 360);
    const h = Math.min(...itensVisiveis(sp).map((b) => b.getBoundingClientRect().height));
    expect(h, 'o item ignorou `--alvo-min` e ficou no literal de antes').toBeLessThan(ALVO_PX);
    expect(h).toBeGreaterThanOrEqual(alvoMinimoDeToque(360) - 0.5);
  });

  it('⚠️ [Right] e a 720 ele volta aos 44 — a régua sobe tanto quanto desce', () => {
    const sp = montarComRegua(1280, 720);
    const h = Math.min(...itensVisiveis(sp).map((b) => b.getBoundingClientRect().height));
    expect(h).toBeGreaterThanOrEqual(ALVO_PX - 0.5);
  });

  it('⚠️ [Right] com a régua aplicada, o cartão CABE a 640×360 — a rolagem some', () => {
    // Este é o custo que abriu o ADR-0095: 391 px de conteúdo para 349 visíveis, 42 de excesso. Com o
    // alvo a seguir a régua, os sete itens passam a caber — que é a coisa toda que a decisão comprou.
    const sp = montarComRegua(MENOR_QUADRO.w, MENOR_QUADRO.h);
    const card = sp.querySelector('.pause-card');
    expect(card.scrollHeight - card.clientHeight, 'o cartão continua a rolar').toBeLessThanOrEqual(0);
  });

  it('🔴 [Right] e o SUBMENU também cabe a 640×360 — antes do ADR-0151 ele transbordava 24 px e nada o via', () => {
    // 📏 MEDIDO em 2026-09-12: com oito entradas (o «voltar» e sete painéis) o submenu rolava 24 px no quadro
    // mínimo, enquanto este ficheiro só media a raiz. É a lista onde a criança passa mais tempo.
    const sp = montarComRegua(MENOR_QUADRO.w, MENOR_QUADRO.h);
    sp.querySelector('.pause-menu[data-sub="raiz"]').hidden = true;
    sp.querySelector('.pause-menu[data-sub="opcoes"]').hidden = false;
    expect(itensVisiveis(sp).length, 'o caso mediria um submenu vazio').toBe(PM_OPTIONS_BTNS.length);
    const card = sp.querySelector('.pause-card');
    const excesso = card.scrollHeight - card.clientHeight;
    expect(excesso, `o submenu transborda ${excesso}px a 640×360`).toBeLessThanOrEqual(0);
  });

  it('[Boundary] ⚠️ o EXCESSO foi PAGO — o teto de 42 px chegou a zero', () => {
    // ⚠️ ESTE CASO MUDOU DE ASSUNTO EM 07/09, e a história vale mais que o número. Ele nasceu como TETO:
    // «a 640×360 o cartão tem 391 px de conteúdo para 349 visíveis, então rola 42», com a nota de que a
    // régua do ADR-0095 dava a licença de resolver e o CSS ainda não a usava — `.pm-btn` tinha
    // `min-height:44px` literal e nem lia o `--tap`.
    //
    // O CSS passou a ler `--alvo-min`. O teto foi pago e vira ZERO, que é o que um teto que encolhe faz
    // quando chega ao fim: deixa de ser orçamento e passa a ser afirmação.
    //
    // ⚠️ E ELE MEDE O CAMINHO DE PRODUÇÃO — com a variável que `layout()` escreve. Medi-lo sem ela seria
    // aferir o fallback de 44 px, que é o valor de ANTES: o caso ficaria verde sobre um cartão que ninguém
    // consertou.
    const sp = montarComRegua(MENOR_QUADRO.w, MENOR_QUADRO.h);
    const card = sp.querySelector('.pause-card');
    const excesso = card.scrollHeight - card.clientHeight;
    expect(excesso, `o cartão voltou a transbordar: ${excesso}px`).toBeLessThanOrEqual(0);
  });

  it('[Zero] a régua NUNCA desce abaixo de 24 — tela menor mostra menos itens, não alvos menores', () => {
    // Uma tela mais baixa que 360 não compra o direito de encolher mais: abaixo de 24 não é «AA num
    // aparelho pequeno», é furar o piso da 2.5.8.
    expect(alvoMinimoDeToque(0)).toBe(24);
    expect(alvoMinimoDeToque(180)).toBe(24);
    expect(alvoMinimoDeToque(-1)).toBe(24);
    expect(alvoMinimoDeToque(NaN)).toBe(24);
  });

  it('[Boundary] os degraus abrem NO número, e nunca descem quando a tela cresce', () => {
    expect(alvoMinimoDeToque(539)).toBe(24);
    expect(alvoMinimoDeToque(540)).toBe(34); // o degrau abre EM 540, não depois
    expect(alvoMinimoDeToque(719)).toBe(34);
    expect(alvoMinimoDeToque(720)).toBe(44);
    expect(alvoMinimoDeToque(4000), 'acima de 720 o piso é teto: 44 continua a valer').toBe(44);
    let anterior = 0;
    for (let h = 0; h <= 1200; h += 7) {
      const v = alvoMinimoDeToque(h);
      expect(v, `a régua DESCEU de ${anterior} para ${v} em ${h}px`).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
  });

  it('⚠️ [Right] o ESPAÇAMENTO protege o dedo onde o tamanho desce — 24 px entre centros', () => {
    // ⚠️ O ADR-0095 NOMEIA ISTO E NADA O AFERIA: «onde o TAMANHO não pode proteger o dedo, o ESPAÇAMENTO
    // passa a ser o que protege — a mesma saída que a própria 2.5.8 dá na sua exceção de spacing».
    //
    // A exceção da WCAG 2.5.8 é uma medida, não uma intenção: um alvo menor que 24×24 ainda cumpre o
    // critério se couber um CÍRCULO DE 24 px centrado nele sem tocar outro alvo. Entre itens empilhados
    // isso é a distância entre CENTROS — e é ela que se mede aqui, nos três degraus.
    //
    // Medir o `gap` do CSS não serviria: o que separa dois dedos é a distância real, e ela sai da altura do
    // item MAIS o gap. Ler a folha diria que a regra está escrita, não que ela acontece.
    //
    // ⚠️ E ESTE CASO NÃO SE DEIXA REPROVAR BAIXANDO A RÉGUA — está medido, e fica escrito para que ninguém o
    // redescubra. Baixar o piso de `REGUA_DE_ALVO` de 24 para 14 reprova os TRÊS casos de tamanho e deixa
    // este VERDE. O motivo é o número que a própria lista de mutações abaixo já tinha: sem `min-height`
    // nenhum, um `.pm-btn` mede ~35,6 px, porque a altura real vem do `padding:.5rem .8rem` mais a
    // line-height do `--ui-fs`. O `min-height` só morde quando pede MAIS que isso; 14 px não pede.
    //
    // Isso não faz do caso um verde vazio — faz dele um gate de OUTRA coisa, e a distinção importa: ele não
    // protege a régua (os três casos de tamanho fazem isso), protege o `gap` e o `padding`. Uma mão futura
    // que aperte `.pause-menu{gap}` ou encolha o padding do item para ganhar linha na tela de 360 encontra
    // este caso vermelho — que é exatamente a mão que a exceção de spacing da 2.5.8 existe para deter.
    for (const h of [360, 540, 720]) {
      const sp = montarComRegua(640, h);
      const centros = itensVisiveis(sp)
        .map((b) => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; })
        .sort((a, b) => a - b);
      for (let i = 1; i < centros.length; i++) {
        const d = centros[i] - centros[i - 1];
        expect(d, `a ${h}px de altura, dois itens ficaram a ${d.toFixed(1)}px de centro a centro`)
          .toBeGreaterThanOrEqual(24);
      }
      palco.remove(); palco = null;
    }
  });

  it('[Interface] o que se PERDE em 360 fica com número, porque AA honesto não é AA silencioso', () => {
    // ⚠️ Este caso é o contrapeso do `[Interface] 44 CSS px é a MEDIDA FÍSICA` lá em cima, e os dois têm de
    // conviver: a 96 px/pol, 24 CSS px são 6,4 mm — ABAIXO do alvo de polegar de 9,6 mm que o painel de
    // toque deste jogo cita. A régua não faz esse custo desaparecer; ela decide pagá-lo em 360 para que o
    // alvo esteja À VISTA em vez de atrás de uma rolagem. Quem propuser estender os 24 px para cima da
    // régua encontra aqui o que estaria a gastar.
    expect(+(24 * MM_POR_PX).toFixed(1)).toBeLessThan(9.6);
    expect(+(44 * MM_POR_PX).toFixed(1)).toBeGreaterThanOrEqual(11);
    expect(alvoMinimoDeToque(720), 'a tela grande continua a dever a faixa da mão de criança').toBe(ALVO_PX);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando `min-height:44px` de `.pm-btn` → "[Right] todo item" reprova medindo ~35,6 px.
//   · devolvendo `.screen-pause .pm-btn{padding:.3rem .5rem}` sem altura mínima → "[Boundary] o quadro
//     apertado" reprova, e os outros casos continuam verdes — que é exatamente o buraco que ele fecha.
//   · devolvendo `grid-template-columns:1fr 1fr` a `.pause-menu` → "[Right] a lista é UMA coluna" reprova
//     com duas larguras distintas.
//   · baixando `ALVO_PX` para 22 (a proposta que o Dev levantou) → "[Interface] 44 CSS px é a MEDIDA FÍSICA"
//     reprova em DUAS asserções: 5,8 mm fica abaixo do alvo de polegar e 22 fura o piso de 24 da WCAG.
//   · devolvendo `min-height:44px` LITERAL a `.pm-btn`, no lugar de `var(--alvo-min,44px)` → os três casos da
//     régua reprovam: o item de 360 mede 44 onde a régua manda 24, e a folha volta a ignorar a decisão.
//   · baixando o PISO da `REGUA_DE_ALVO` de 24 para 14 → reprovam os três casos de tamanho e ⚠️ NÃO reprova o
//     do ESPAÇAMENTO. Não é buraco: um `.pm-btn` mede ~35,6 px por `padding` + line-height (o número da
//     primeira linha desta lista), então um `min-height` de 14 nunca chega a morder. O caso do espaçamento
//     afere `gap`/`padding`, e é por eles que ele fica vermelho — está escrito no corpo do próprio caso.
