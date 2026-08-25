// SPDX-License-Identifier: GPL-3.0-or-later
// render/viz-modes.ts — os 16 modos visuais de acessibilidade (dados) + índices derivados. Módulo-folha, ZERO
// deps. Alto contraste (renderização direta 3 níveis), simulação/correção de daltonismo, baixa visão, cegueira.
// A aplicação dos modos (setPlayerViz/applyVpFilters/overlays) fica no game.js. Ver docs/PESQUISA-ALTO-CONTRASTE.md.
// SEM campo `filter` aqui, de proposito: quem diz "modo -> filtro CSS" e VIZ_FILTER, logo abaixo. Os seis
// modos de daltonismo traziam o `url(#cvd-*)` repetido dentro do proprio registro, mas ninguem lia `m.filter`
// — todo consumo passa por VIZ_FILTER, que alem dos seis cobre baixa visao e cegueira. Duas copias, uma so
// lida: se divergissem, a errada seria a silenciosa. E como o campo era opcional, o tipo tambem calaria.
/**
 * `sim` — este modo SIMULA uma deficiência em quem não a tem, em vez de CORRIGIR a tela para quem a tem.
 *
 * O `kind` não responde a isso e nunca respondeu: `sim-deuter` (simular daltonismo) e `fix-deuter` (corrigir
 * daltonismo) compartilham `kind:'filter'`, ainda que sirvam a duas pessoas opostas. Enquanto ninguém
 * precisava distinguir, a lacuna era inofensiva. Passou a não ser quando o menu de empatia ganhou um
 * "restaurar padrões" (ADR-0028): desligar as simulações é o objetivo do botão, e desligar as correções junto
 * seria tirar de uma criança daltônica a única correção que ela tem — a partir do menu que existe para quem
 * NÃO tem a deficiência. Um reset que faz isso é pior que a armadilha que ele deveria desfazer.
 *
 * Só os 9 modos marcados simulam. Os 3 `fix-*` corrigem, os 3 `hc-direto*` corrigem, e `normal` não faz nada.
 */
/**
 * Um modo de visão. `nome` e `desc` guardam CHAVE i18n, não texto — mesma decisão de `CenarioTema.nome` e
 * `RM_LABEL`, e pelo mesmo motivo: uma tabela de `const` com texto resolve UMA vez, no import, e fica
 * congelada no idioma do boot. Este menu é o que uma criança de baixa visão ou daltônica lê para configurar o
 * PRÓPRIO jogo; deixá-lo em português numa build em inglês tira dela a única página que ela precisava ler.
 *
 * Quem EXIBE resolve (`render/viz-setters`, `consumer-quiz`), e por isso este módulo continua FOLHA: dado
 * puro, sem dependência nenhuma, importável dos dois lados da fronteira.
 */
export type VizMode = { key: string; kind: string; nome: string; desc: string; lv?: string; sim?: true };
export const VIZ_MODES: VizMode[] = [
  {key:'normal', kind:'normal', nome:'viz.normal',        desc:'viz.desc.normal'},
  {key:'hc-direto', kind:'hcnew', nome:'viz.hc-direto', desc:'viz.desc.hc-direto'},
  {key:'hc-direto-45', kind:'hcnew', nome:'viz.hc-direto-45', desc:'viz.desc.hc-direto-45'},
  {key:'hc-direto-7', kind:'hcnew', nome:'viz.hc-direto-7', desc:'viz.desc.hc-direto-7'},
  {key:'sim-deuter', sim:true, kind:'filter', nome:'viz.sim-deuter', desc:'viz.desc.sim-deuter'},
  {key:'sim-protan', sim:true, kind:'filter', nome:'viz.sim-protan',   desc:'viz.desc.sim-protan'},
  {key:'sim-tritan', sim:true, kind:'filter', nome:'viz.sim-tritan',   desc:'viz.desc.sim-tritan'},
  {key:'fix-protan', kind:'filter', nome:'viz.fix-protan', desc:'viz.desc.fix-protan'},
  {key:'fix-deuter', kind:'filter', nome:'viz.fix-deuter', desc:'viz.desc.fix-deuter'},
  {key:'fix-tritan', kind:'filter', nome:'viz.fix-tritan', desc:'viz.desc.fix-tritan'},
  {key:'lv-blur',     sim:true, kind:'lowvision', lv:'blur',     nome:'viz.lv-blur',         desc:'viz.desc.lv-blur'},
  {key:'lv-haze',     sim:true, kind:'lowvision', lv:'haze',     nome:'viz.lv-haze',            desc:'viz.desc.lv-haze'},
  {key:'lv-tunnel',   sim:true, kind:'lowvision', lv:'tunnel',   nome:'viz.lv-tunnel',   desc:'viz.desc.lv-tunnel'},
  {key:'lv-macular',  sim:true, kind:'lowvision', lv:'macular',  nome:'viz.lv-macular',   desc:'viz.desc.lv-macular'},
  {key:'lv-diabetic', sim:true, kind:'lowvision', lv:'diabetic', nome:'viz.lv-diabetic',desc:'viz.desc.lv-diabetic'},
  {key:'blind', sim:true, kind:'blind', nome:'viz.blind', desc:'viz.desc.blind'},
];
export const VIZ_BY_KEY: Record<string, VizMode> = Object.fromEntries(VIZ_MODES.map((m): [string, VizMode] => [m.key, m]));
export const VIZ_FILTER: Record<string, string> = {'sim-deuter':'url(#cvd-deuter)','sim-protan':'url(#cvd-protan)','sim-tritan':'url(#cvd-tritan)',
  'fix-protan':'url(#cvd-fix-protan)','fix-deuter':'url(#cvd-fix-deuter)','fix-tritan':'url(#cvd-fix-tritan)',
  'lv-blur':'blur(2.4px)', 'lv-haze':'contrast(.58) brightness(1.14) blur(.6px)', 'lv-tunnel':'blur(.5px)', 'lv-macular':'', 'lv-diabetic':'blur(.8px)', 'blind':'brightness(0)'};
export const VIZ_CYCLE: string[] = VIZ_MODES.map((m) => m.key);

/**
 * Este modo simula uma deficiência? Chave desconhecida (ou vazia) → false, porque a pergunta que o chamador
 * está fazendo é "posso desligar isto sem tirar nada de ninguém?", e a resposta honesta diante do
 * desconhecido é não.
 */
export function simulatesDisability(key: string): boolean {
  return VIZ_BY_KEY[key]?.sim === true;
}

/**
 * As CORREÇÕES de daltonismo: daltonizam a tela para quem TEM a condição. Derivadas do catálogo, nunca
 * listadas à mão — são exatamente os filtros que não simulam.
 *
 * Existem como lista própria porque moram no menu de ACESSIBILIDADE VISUAL, e não no de empatia (decisão do
 * Dev, issue #60). Ficaram anos no menu errado por um motivo que este arquivo agora conserta: `kind` não
 * distinguia simular de corrigir, então o painel de empatia, que se recorta por `kind:'filter'`, arrastava as
 * três junto. Dois públicos opostos na mesma lista — quem quer sentir como é ser daltônico e quem é.
 */
export const VIZ_CORRECTIONS: readonly VizMode[] = VIZ_MODES.filter((m) => m.kind === 'filter' && !m.sim);

/* ===================== AS DUAS PILHAS COM UM NOME SÓ (achado 8, item 19) ===================== */
//
// O segundo consumidor mediu, e a medição é o motivo desta seção existir:
//
//     "O ALTO CONTRASTE NÃO VIAJA, e a razão é estrutural, não um defeito. Os modos `hcnew` REPINTAM
//      TEXTURAS de tile na PIXI; um quiz não tem tiles, e não há o que repintar. Ou seja: o que o menu chama
//      de 'acessibilidade visual' são DUAS pilhas com um nome só — uma de DOM/CSS (filtros de daltonismo,
//      tipografia, caixa alta) que serve a qualquer jogo; uma de CANVAS (renderização direta, contornos,
//      cores de papel) que só existe onde há mundo. O painel as apresenta numa lista única de 7 modos… A
//      divisão do passo 5 precisa cortar AQUI."
//
// Este é o corte, e ele é de DADO e não de arquivo — os arquivos já estavam separados (`render/cvd-matrices`
// é DOM puro; `render/high-contrast` importa `core/collision.tileAt`). O que faltava era a tabela DIZER a
// qual pilha cada modo pertence, para que ninguém mais reconstruísse a resposta de cabeça.
//
// E era reconstruída: o segundo consumidor escrevia
//     `VIZ_MODES.filter((m) => m.kind === 'normal' || (m.kind === 'filter' && !simulatesDisability(m.key)))`
// — uma expressão que mistura DUAS perguntas diferentes ("precisa de canvas?" e "isto simula deficiência?")
// e que todo consumidor futuro teria de reinventar, com a chance de acertar uma e errar a outra.

/** Este modo precisa de um CANVAS de mundo para existir? Só os `hcnew` precisam: eles repintam texturas. */
export function needsCanvas(key: string): boolean {
  return VIZ_BY_KEY[key]?.kind === 'hcnew';
}

/**
 * Os modos que funcionam em QUALQUER jogo — os que se aplicam como filtro de CSS sobre um elemento.
 *
 * Derivada, nunca listada à mão: um modo novo entra na pilha certa por causa do `kind` que ele declara, e não
 * porque alguém lembrou de acrescentá-lo aqui. É a mesma regra de `VIZ_CORRECTIONS`.
 */
export const VIZ_DOM_ONLY: readonly VizMode[] = VIZ_MODES.filter((m) => !needsCanvas(m.key));

/** Os modos que EXIGEM mundo. Complemento exato de `VIZ_DOM_ONLY` — juntos, os 16, sem sobra nem repetição. */
export const VIZ_CANVAS_ONLY: readonly VizMode[] = VIZ_MODES.filter((m) => needsCanvas(m.key));
