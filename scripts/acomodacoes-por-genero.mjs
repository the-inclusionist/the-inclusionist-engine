// SPDX-License-Identifier: AGPL-3.0-or-later
//
// O CRUZAMENTO do estudo de `docs/1-Discovery/estudo-acomodacoes-por-genero.md` (ADR-0145 §3).
//
// Lê o catálogo de gêneros, cruza-o com a classificação abaixo e imprime a tabela inteira. A CLASSIFICAÇÃO é
// juízo — cada linha de `EXTRA` é uma decisão sobre se a acomodação tem ASSUNTO naquele gênero — e o que este
// ficheiro faz é CONTAR. Discordar de uma célula é editar uma linha e voltar a correr.
//
// ⚠️ TRÊS GUARDAS, e nenhuma é zelo: sem elas uma célula esquecida aparece como «não se aplica» e ninguém dá
// por ela. Um gênero sem classificação, uma classificação sem gênero, e uma lista que repete um universal
// fazem este script sair com código não-zero.
//
//   node scripts/acomodacoes-por-genero.mjs [caminho-do-catalogo.html]
//
// 📌 O catálogo NÃO viaja neste repositório: ele é o `minigames-catalog-v2.html` do Dev, e o ADR-0058 é quem
// diz de quem ele é. O caminho entra como argumento, e a falta dele é um erro dito em vez de um zero calado.
import { readFileSync, existsSync } from 'node:fs';

const CATALOGO = process.argv[2] ?? 'C:/Users/candi/Claude/minigames-catalog-v2.html';
if (!existsSync(CATALOGO)) {
  console.error(`catálogo não encontrado: ${CATALOGO}\n`
    + 'passe o caminho: node scripts/acomodacoes-por-genero.mjs <minigames-catalog-v2.html>');
  process.exit(2);
}

/* ===================== AS ACOMODAÇÕES ===================== */
// `tem` = existe na engine hoje. O resto sai do estudo dos gêneros.
const ACOM = {
  tipografia: { tem: true, o: 'a fonte do jogo inteiro' },
  caixaDaLetra: { tem: true, o: 'maiúsculas vs maiúsculas+minúsculas' },
  narracao: { tem: true, o: 'TTS lê o que está escrito' },
  indiceFalado: { tem: true, o: '«3 de 7» ao andar num menu' },
  libras: { tem: true, o: 'janela de Libras' },
  velocidadeDoTexto: { tem: false, o: 'quão depressa o diálogo avança / auto-avançar' },
  dificuldadeLexical: { tem: false, o: 'tamanho e frequência das palavras' },
  som: { tem: true, o: 'mestre + volume por categoria' },
  navegacaoSonora: { tem: true, o: 'volume de bengala/sonar/guia' },
  modoCego: { tem: true, o: 'jogar sem ver, por pistas de áudio' },
  bengalaEspacamento: { tem: true, o: 'de quanto em quanto chão a bengala bate' },
  saidaDeAudio: { tem: true, o: 'saída de áudio própria por jogador' },
  simulacaoAuditiva: { tem: true, o: 'empatia: simular perda auditiva' },
  altoContraste: { tem: true, o: 'alto contraste' },
  correcaoDaltonismo: { tem: true, o: 'correção de daltonismo' },
  simulacaoVisual: { tem: true, o: 'empatia: simular cegueira / baixa visão / daltonismo' },
  naipesDistinguiveis: { tem: false, o: 'naipes distinguíveis sem depender de cor' },
  reducaoCena: { tem: true, o: 'parar parallax, decoração, itens, partículas' },
  reducaoPersonagem: { tem: true, o: 'parar andar/respirar/gracinhas do personagem' },
  balancoDaCamara: { tem: false, o: 'balanço/FOV da câmara — enjoo em 1ª pessoa' },
  intensidade: { tem: false, o: 'sustos, flashes, tensão' },
  remapearTeclas: { tem: true, o: 'remapear teclas' },
  controleVirtual: { tem: true, o: 'pad na tela (tamanho, geometria, slots)' },
  umBotaoSo: { tem: false, o: 'colapsar as acções numa só' },
  alternanciaDeMarcha: { tem: true, o: 'andar sem segurar a direcção' },
  alternanciaDoCorrer: { tem: true, o: 'correr sem segurar o botão' },
  tamanhoDoAlvo: { tem: false, o: 'alvos maiores para clicar/mirar' },
  assistenciaDeTraco: { tem: false, o: 'estabilizar o traço ao desenhar' },
  janelaDeAcerto: { tem: false, o: 'quanto tempo conta como «no tempo certo»' },
  semTempo: { tem: false, o: 'tirar ou esticar o cronómetro' },
  generosidadeDeteccao: { tem: false, o: 'quão depressa um guarda te vê' },
  dicaOuRealce: { tem: false, o: 'dica / realce do que procurar' },
  cadeiraDeRodas: { tem: true, o: 'sem pulo; rampas e elevadores' },
  modoFacil: { tem: true, o: 'gravidade menor, moedas no chão, sem perigos' },
  pecas: { tem: false, o: 'conjuntos de peças / baralhos alternativos' },
};

/* ===================== O QUE É UNIVERSAL =====================
 * Tem assunto nos 35, e o argumento é o mesmo: há TEXTO, há SOM, há TELA e há MENU em qualquer jogo.
 */
const UNIVERSAIS = [
  'tipografia', 'caixaDaLetra', 'narracao', 'indiceFalado', 'libras',
  'som', 'simulacaoAuditiva',
  'altoContraste', 'correcaoDaltonismo', 'simulacaoVisual',
  'reducaoCena',
];

/* ===================== POR GÊNERO — só o que ACRESCE aos universais ===================== */
const EXTRA = {
  'Arcade Clássico': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'alternanciaDeMarcha', 'reducaoPersonagem', 'modoCego', 'navegacaoSonora', 'semTempo', 'janelaDeAcerto', 'tamanhoDoAlvo'],
  'Shooters / Tiros': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'alternanciaDeMarcha', 'alternanciaDoCorrer', 'reducaoPersonagem', 'tamanhoDoAlvo', 'semTempo', 'modoFacil'],
  'Endless Runner': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'reducaoPersonagem', 'janelaDeAcerto', 'modoFacil', 'cadeiraDeRodas'],
  'Puzzle Lógico': ['remapearTeclas', 'controleVirtual', 'semTempo', 'dicaOuRealce', 'tamanhoDoAlvo'],
  'Puzzle de Palavras': ['remapearTeclas', 'semTempo', 'dicaOuRealce', 'dificuldadeLexical'],
  'Puzzle Físico': ['controleVirtual', 'semTempo', 'dicaOuRealce', 'tamanhoDoAlvo'],
  'Memória': ['controleVirtual', 'semTempo', 'dicaOuRealce', 'tamanhoDoAlvo'],
  'Platformer': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'alternanciaDeMarcha', 'alternanciaDoCorrer', 'reducaoPersonagem', 'modoCego', 'navegacaoSonora', 'bengalaEspacamento', 'modoFacil', 'cadeiraDeRodas', 'janelaDeAcerto'],
  'Corrida / Racing': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'alternanciaDoCorrer', 'reducaoPersonagem', 'balancoDaCamara', 'semTempo', 'modoFacil'],
  'Esportes': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'reducaoPersonagem', 'janelaDeAcerto', 'tamanhoDoAlvo', 'semTempo', 'saidaDeAudio'],
  'Cartas': ['controleVirtual', 'tamanhoDoAlvo', 'semTempo', 'naipesDistinguiveis', 'pecas', 'saidaDeAudio'],
  'Tabuleiro': ['controleVirtual', 'tamanhoDoAlvo', 'semTempo', 'pecas', 'saidaDeAudio', 'dicaOuRealce'],
  'Cassino / Sorte': ['controleVirtual', 'tamanhoDoAlvo', 'naipesDistinguiveis', 'pecas'],
  'Simulação / Idle': ['controleVirtual', 'tamanhoDoAlvo', 'semTempo', 'velocidadeDoTexto'],
  'RPG / Aventura': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'reducaoPersonagem', 'velocidadeDoTexto', 'semTempo', 'modoFacil', 'modoCego', 'navegacaoSonora'],
  'Estratégia': ['controleVirtual', 'tamanhoDoAlvo', 'semTempo', 'velocidadeDoTexto', 'modoFacil', 'dicaOuRealce'],
  'Ritmo / Música': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'janelaDeAcerto', 'semTempo', 'intensidade'],
  'Digitação': ['remapearTeclas', 'semTempo', 'janelaDeAcerto', 'dificuldadeLexical'],
  'Desenho / Criativo': ['controleVirtual', 'tamanhoDoAlvo', 'assistenciaDeTraco'],
  'Educativo / Quiz': ['remapearTeclas', 'controleVirtual', 'tamanhoDoAlvo', 'semTempo', 'velocidadeDoTexto', 'dificuldadeLexical', 'dicaOuRealce'],
  'Reação / Reflexo': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'janelaDeAcerto', 'semTempo', 'tamanhoDoAlvo'],
  'Party / Microgames': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'janelaDeAcerto', 'semTempo', 'saidaDeAudio', 'intensidade'],
  'Stealth / Furtivo': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'reducaoPersonagem', 'generosidadeDeteccao', 'semTempo', 'intensidade', 'modoCego', 'navegacaoSonora'],
  'Luta / Fighting': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'reducaoPersonagem', 'janelaDeAcerto', 'modoFacil', 'saidaDeAudio'],
  'Terror / Atmosfera': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'reducaoPersonagem', 'intensidade', 'modoCego', 'navegacaoSonora', 'semTempo'],
  'Sandbox / Sim Físico': ['controleVirtual', 'tamanhoDoAlvo', 'assistenciaDeTraco'],
  'Pseudo-3D / Raycasting': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'alternanciaDoCorrer', 'balancoDaCamara', 'intensidade', 'semTempo', 'modoFacil'],
  'Isométrico': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'reducaoPersonagem', 'balancoDaCamara', 'semTempo', 'modoFacil', 'cadeiraDeRodas'],
  'Multiplayer Local': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'alternanciaDeMarcha', 'reducaoPersonagem', 'saidaDeAudio', 'semTempo', 'janelaDeAcerto', 'modoFacil'],
  'Experimentais / Arte': ['controleVirtual', 'tamanhoDoAlvo', 'assistenciaDeTraco', 'umBotaoSo'],
  'Cozinha Produção': ['controleVirtual', 'tamanhoDoAlvo', 'janelaDeAcerto', 'semTempo', 'dicaOuRealce'],
  'Point-and-Click / Hidden': ['controleVirtual', 'tamanhoDoAlvo', 'dicaOuRealce', 'semTempo', 'velocidadeDoTexto'],
  'Narrativo Detetive': ['controleVirtual', 'tamanhoDoAlvo', 'velocidadeDoTexto', 'dificuldadeLexical', 'semTempo', 'dicaOuRealce'],
  'Labirinto Exploração': ['remapearTeclas', 'controleVirtual', 'alternanciaDeMarcha', 'reducaoPersonagem', 'modoCego', 'navegacaoSonora', 'bengalaEspacamento', 'semTempo', 'dicaOuRealce'],
  'Híbridos / Mashups': ['remapearTeclas', 'controleVirtual', 'umBotaoSo', 'alternanciaDeMarcha', 'reducaoPersonagem', 'semTempo', 'modoFacil', 'janelaDeAcerto'],
};

/* ===================== ler o catálogo ===================== */
const html = readFileSync(CATALOGO, 'utf8');
const limpo = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const generos = [...html.matchAll(/<article class="card[^"]*"[\s\S]*?<\/article>/g)].map((m) => ({
  nome: limpo((m[0].match(/<h3[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h3>/) ?? [, ''])[1]),
  jogos: [...m[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].length,
}));
if (!generos.length) { console.error('nenhum gênero lido — o markup do catálogo mudou?'); process.exit(2); }

/* ===================== as três guardas ===================== */
const nomes = generos.map((g) => g.nome);
const problemas = [];
for (const n of nomes) if (!(n in EXTRA)) problemas.push(`gênero SEM classificação: ${n}`);
for (const n of Object.keys(EXTRA)) if (!nomes.includes(n)) problemas.push(`classificação SEM gênero: ${n}`);
for (const [g, lista] of Object.entries(EXTRA)) {
  for (const a of lista) {
    if (!(a in ACOM)) problemas.push(`${g}: acomodação inexistente «${a}»`);
    if (UNIVERSAIS.includes(a)) problemas.push(`${g}: repete o universal «${a}»`);
  }
}
if (problemas.length) { for (const p of problemas) console.error('⚠️ ' + p); process.exit(1); }

/* ===================== contar ===================== */
const jogosDe = Object.fromEntries(generos.map((g) => [g.nome, g.jogos]));
const TOTAL = generos.reduce((a, g) => a + g.jogos, 0);
const linhas = Object.entries(ACOM).map(([k, meta]) => {
  const universal = UNIVERSAIS.includes(k);
  const gens = universal ? nomes : nomes.filter((n) => EXTRA[n].includes(k));
  return { k, ...meta, universal, nGen: gens.length, nJogos: gens.reduce((a, n) => a + jogosDe[n], 0), gens };
}).sort((a, b) => b.nGen - a.nGen || b.nJogos - a.nJogos);

console.log(`${generos.length} gêneros · ${TOTAL} jogos\n`);
console.log('acomodação                a engine tem?   gêneros   jogos    %');
console.log('─'.repeat(66));
for (const l of linhas) {
  console.log(`${l.k.padEnd(24)} ${l.tem ? '      sim' : '      NÃO'}       ${String(l.nGen).padStart(2)}/35    ${String(l.nJogos).padStart(3)}   ${String(Math.round((l.nJogos / TOTAL) * 100)).padStart(3)}%`);
}
console.log('\n=== as que a engine NÃO tem, por alcance ===');
for (const l of linhas.filter((x) => !x.tem)) {
  console.log(`\n  ${l.k} — ${l.o}`);
  console.log(`     ${l.nGen} gêneros · ${l.nJogos} jogos (${Math.round((l.nJogos / TOTAL) * 100)}%)`);
  console.log(`     ${l.gens.join(' · ')}`);
}
