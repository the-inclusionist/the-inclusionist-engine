// SPDX-License-Identifier: AGPL-3.0-or-later
// O PLANO DAS VOZES NEURAIS (ADR-0110), na metade pura — issue #91.
//
// ⚠️ O QUE ESTE FICHEIRO GUARDA É UMA FRASE DITA A UM ADULTO. O ADR-0110 deve um gate a dizer que «uma busca
// falhada é REPORTADA, não engolida — e a engine diz QUAL voz está de facto a usar, porque um recuo que se
// apresenta como a coisa real é a família do `reflectTTS`». `vozEmUso` é esse gate em forma de código.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  VOZES_NEURAIS, estadoDe, ordemDeBusca, vozEmUso,
  HOST_DOS_MODELOS, urlDoModelo, urlDaConfig,
} from '../app/js/platform/voice-plan.js';

const nomes = (vs) => vs.map((v) => v.voice);

describe('o catálogo das quatro (ADR-0110)', () => {
  it('[Interface] são QUATRO vozes para TRÊS idiomas, e o en-US tem duas', () => {
    expect(VOZES_NEURAIS).toHaveLength(4);
    expect(new Set(VOZES_NEURAIS.map((v) => v.locale))).toEqual(new Set(['pt-BR', 'en-US', 'es-MX']));
    expect(VOZES_NEURAIS.filter((v) => v.locale === 'en-US')).toHaveLength(2);
  });

  it('🎯 [Zero] NENHUMA é `ncnn` e NENHUMA é `int8` — as duas proibições do ADR-0065 §5', () => {
    // ⚠️ Não é zelo: `ncnn` é outro MOTOR DE INFERÊNCIA (`.param`/`.bin`, não `.onnx`) e este projeto corre
    // sherpa-onnx, logo esses ficheiros não carregam de todo. Dois dos links que chegaram em 2026-09-08
    // apontavam para os espelhos `ncnn` — o engano é real e já aconteceu uma vez.
    // ⚠️ E o `int8` tem razão MEDIDA: no WASM corre ~3× mais LENTO que o fp32 (RTF 5,6 contra 2,5), com saída
    // incorrecta ou muda. Quantizar não encurta a espera da criança; alonga-a.
    for (const v of VOZES_NEURAIS) {
      expect(v.voice, `${v.voice} é da variante ncnn`).not.toMatch(/ncnn/i);
      expect(v.voice, `${v.voice} é quantizada`).not.toMatch(/int8/i);
      expect(v.engine).toBe('piper');
    }
  });

  it('[Interface] o catálogo é congelado — um padrão partilhado que alguém muta deixa de existir para todos', () => {
    expect(Object.isFrozen(VOZES_NEURAIS)).toBe(true);
    expect(Object.isFrozen(VOZES_NEURAIS[0])).toBe(true);
  });
});

describe('de onde vêm os modelos (ADR-0114), num sítio só', () => {
  // 📏 OS QUATRO ENDEREÇOS SÃO LITERAIS MEDIDOS, e não a derivação chamada outra vez. Foram lidos em
  // 2026-09-08 do que o `piper.ttstool.com` busca, e cada um respondeu 200 com `Access-Control-Allow-Origin:
  // *`. Afirmá-los chamando `urlDoModelo` mediria a ida e a volta pela mesma função, e as duas metades
  // mover-se-iam juntas — a mesma nota que o `pause-icons` carrega sobre a codificação `1`/`0`.
  const MEDIDOS = {
    'pt_BR-faber-medium': 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx',
    'en_US-ryan-medium': 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx',
    'en_US-amy-medium': 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx',
    'es_MX-claude-high': 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx',
  };

  it('🎯 [Right] as quatro do catálogo derivam exactamente os endereços medidos', () => {
    for (const v of VOZES_NEURAIS) {
      expect(urlDoModelo(v), `${v.voice} deixou de derivar o endereço que respondeu 200`).toBe(MEDIDOS[v.voice]);
    }
  });

  // ⚠️ A CONFIGURAÇÃO VIAJA COM O MODELO, e é o mesmo caminho com outro sufixo — medido a responder 200 no
  // mesmo sítio. Um segundo caminho para ela seria a segunda tabela que a derivação existe para evitar.
  it('[Right] a config é o mesmo caminho com `.json`', () => {
    for (const v of VOZES_NEURAIS) {
      expect(urlDaConfig(v)).toBe(`${MEDIDOS[v.voice]}.json`);
    }
  });

  // 🎯 O CASO QUE IMPEDE A SEGUNDA TABELA: o endereço sai do IDENTIFICADOR, logo uma voz que ainda não está
  // no catálogo já tem endereço sem ninguém a acrescentar uma linha. Se algum dia houver uma tabela de
  // caminhos ao lado da de vozes, este caso é o que a apanha — ele usa uma voz que não está em lado nenhum.
  it('🎯 [Right] uma voz FORA do catálogo também deriva, porque a fonte é o identificador', () => {
    const inventada = { locale: 'fr-FR', engine: 'piper', voice: 'fr_FR-gilles-low' };
    expect(urlDoModelo(inventada))
      .toBe('https://huggingface.co/diffusionstudio/piper-voices/resolve/main/fr/fr_FR/gilles/low/fr_FR-gilles-low.onnx');
  });

  // ⚠️ UM IDENTIFICADOR QUE NÃO SE DEIXA LER DEVOLVE `null`, e não um caminho torto: uma URL inventada dá
  // 404 numa escola, e um `null` dá para reportar antes de sair de casa.
  it('⚠️ [Zero] identificador malformado devolve `null`, e não uma URL inventada', () => {
    for (const ruim of ['faber', 'pt_BR-faber', 'pt_BR-faber-medium-extra', 'pt-faber-medium']) {
      expect(urlDoModelo({ locale: 'pt-BR', engine: 'piper', voice: ruim }), ruim).toBe(null);
    }
  });

  // 📌 O HOST É UM SÓ, e afirmá-lo é o que o ADR-0114 pede. Um endereço repetido no ponto de uso é como o
  // CDN do WebGazer chegou ao `ui/webcam`: escrito à mão, sem política, e sem se poder mudar de uma vez.
  it('📌 [Interface] todo endereço começa pelo host declarado', () => {
    for (const v of VOZES_NEURAIS) expect(urlDoModelo(v).startsWith(HOST_DOS_MODELOS)).toBe(true);
  });
});

describe('a ordem por que se busca', () => {
  it('⚠️ [Right] o idioma da criança PRIMEIRO, e as outras a seguir', () => {
    // A regra inteira, e é sobre uma criança e não sobre eficiência: as outras vozes são «conforme interesse
    // do jogador», mas a dela é a que ela precisa AGORA. Em ordem de catálogo, uma criança brasileira
    // esperaria por duas vozes inglesas na rede de uma escola.
    expect(nomes(ordemDeBusca({}, 'pt-BR'))[0]).toBe('pt_BR-faber-medium');
    expect(nomes(ordemDeBusca({}, 'es-MX'))[0]).toBe('es_MX-claude-high');
    expect(nomes(ordemDeBusca({}, 'en-US')).slice(0, 2), 'Amy speaks first in English (ADR-0198 erratum)').toEqual(['en_US-amy-medium', 'en_US-ryan-medium']);
  });

  it('[Zero] quem está PRONTA ou EM CURSO não volta à fila', () => {
    const estados = { 'pt_BR-faber-medium': 'pronta', 'en_US-ryan-medium': 'a-buscar' };
    expect(nomes(ordemDeBusca(estados, 'pt-BR'))).toEqual(['en_US-amy-medium', 'es_MX-claude-high']);
  });

  it('⚠️ [Boundary] quem FALHOU volta à fila — uma escola perde a rede e recupera-a', () => {
    // Marcar uma voz como falhada para sempre seria deixar a criança sem ela até alguém recarregar a página.
    // Quem chama decide QUANDO tentar de novo; este módulo só diz que ainda há o que buscar.
    const estados = { 'pt_BR-faber-medium': 'falhou' };
    expect(nomes(ordemDeBusca(estados, 'pt-BR'))[0]).toBe('pt_BR-faber-medium');
  });

  it('[Zero] com tudo pronto não há nada a buscar', () => {
    const tudo = Object.fromEntries(VOZES_NEURAIS.map((v) => [v.voice, 'pronta']));
    expect(ordemDeBusca(tudo, 'pt-BR')).toEqual([]);
  });

  it('[Interface] `estadoDe` responde `ausente` a quem não está no mapa, e não `undefined`', () => {
    expect(estadoDe({}, VOZES_NEURAIS[0])).toBe('ausente');
  });
});

describe('🎯 quem está a falar, e por quê (o gate 3 do ADR-0110)', () => {
  it('[Right] com a voz do idioma pronta, é ela', () => {
    expect(vozEmUso({ 'pt_BR-faber-medium': 'pronta' }, 'pt-BR')).toEqual({ tipo: 'neural', voice: 'pt_BR-faber-medium' });
  });

  it('🎯 [Zero] enquanto o modelo desce, a resposta é RECUO e diz porquê', () => {
    // ⚠️ É o defeito que este ficheiro existe para impedir. Dizer «voz neural» enquanto o modelo ainda vem a
    // caminho faria um adulto concluir que a qualidade que ouve É a final — e desistir de esperar por uma
    // coisa que já vinha. `reflectTTS` é o nome que este repositório dá a essa família.
    expect(vozEmUso({ 'pt_BR-faber-medium': 'a-buscar' }, 'pt-BR')).toEqual({ tipo: 'recuo', porque: 'a-buscar' });
  });

  it('⚠️ [Boundary] «a buscar» ganha de «falhou» quando as duas coexistem', () => {
    // Enquanto alguma vem a caminho, anunciar «falhou» é declarar uma derrota que ainda não aconteceu — e um
    // adulto desligaria a espera cedo demais.
    const estados = { 'en_US-ryan-medium': 'falhou', 'en_US-amy-medium': 'a-buscar' };
    expect(vozEmUso(estados, 'en-US')).toEqual({ tipo: 'recuo', porque: 'a-buscar' });
  });

  it('⚠️ [Zero] AUSENTE não se disfarça de «a buscar» — nada começou é diferente de vem a caminho', () => {
    // ⚠️ Era assim que a função estava escrita à primeira, e estaria a esconder um buscador que nunca arrancou
    // atrás de uma frase tranquilizadora. É a forma de defeito que o `neuralDisponivel` já custou à #91.
    expect(vozEmUso({}, 'pt-BR')).toEqual({ tipo: 'recuo', porque: 'ausente' });
  });

  it('[Zero] com as duas do idioma falhadas, a resposta é `falhou`', () => {
    const estados = { 'en_US-ryan-medium': 'falhou', 'en_US-amy-medium': 'falhou' };
    expect(vozEmUso(estados, 'en-US')).toEqual({ tipo: 'recuo', porque: 'falhou' });
  });

  it('⚠️ [Boundary] um idioma FORA do catálogo diz isso, e não «falhou»', () => {
    // São coisas diferentes e um adulto age diferente sobre elas: «falhou» pede tentar outra vez, «não há voz
    // para este idioma» não. Colapsá-las mandaria alguém insistir contra uma parede.
    expect(vozEmUso({}, 'fr-FR')).toEqual({ tipo: 'recuo', porque: 'sem-voz-para-o-idioma' });
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Oito, por script e com contagem de ocorrencias, todas mortas.
//
//   1. 🎯 o recuo a apresentar-se como VOZ NEURAL -> reprovam QUATRO. E a mutacao que da sentido ao ficheiro:
//      ela nao quebra funcionalidade nenhuma — a crianca continua a ouvir exactamente o mesmo audio — e faz a
//      engine MENTIR sobre o que esta a usar. E a familia do `reflectTTS`, e nenhum teste de som a apanharia.
//   2. `ausente` a disfarcar-se de `a-buscar` -> reprova o caso dele. Nada comecou e diferente de vem a
//      caminho, e a frase tranquilizadora esconderia um buscador que nunca arrancou.
//   3. `falhou` a ganhar de `a-buscar` -> reprovam DOIS. Anunciar derrota enquanto algo vem a caminho faz um
//      adulto desligar a espera cedo demais.
//   4. idioma fora do catalogo a dizer `falhou` -> reprova o [Boundary]. Sao coisas diferentes e um adulto age
//      diferente: «falhou» pede tentar outra vez, «nao ha voz para este idioma» nao — colapsa-las manda
//      alguem insistir contra uma parede.
//   5. a fila a deixar de por o idioma da crianca primeiro -> reprovam DOIS. Uma crianca brasileira a esperar
//      por duas vozes inglesas na rede de uma escola.
//   6. quem FALHOU a nao voltar a fila -> reprova o [Boundary]. Uma escola perde a rede e recupera-a.
//   7. o catalogo sem congelar -> reprova o [Interface].
//   8. uma voz a virar a variante `ncnn` -> reprovam TRES. E o engano REAL de 2026-09-08, quando dois dos
//      links que chegaram apontavam para os espelhos ncnn — que sao de outro motor de inferencia e nao
//      carregam aqui de todo.
