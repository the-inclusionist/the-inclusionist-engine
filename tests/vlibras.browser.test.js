// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/vlibras — MODO PESSOA SURDA (project BROWSER: usa DOM e localStorage).
//
// ESTE ARQUIVO MUDOU DE CONTRATO, e o motivo é um defeito que ele estava FIXANDO em vez de pegar.
//
// A versão anterior aferia que "botão de acesso escondido ⇒ painel ABERTO": o estado do modo pessoa surda era
// deduzido da GEOMETRIA do widget do VLibras. Funcionava enquanto o widget renderizava dentro do nosso
// `<div vw>`. Ele parou de renderizar ali — passou a anexar `#vlibras-access-wrapper` no `<body>` — e o que
// restou no nosso markup é um div VAZIO de altura zero. Altura zero era a assinatura de "aberto", então o modo
// ficou permanentemente ligado: o layout reservava 380px para um intérprete inexistente (canvas medido em
// `left: -136`, fora da tela) e o botão não desligava, porque mandava um evento de fechar a quem não escutava.
//
// O teste passava o tempo todo. Ele afirmava a inferência, e a inferência é que estava errada — nenhum caso
// perguntava se o resultado fazia sentido para uma pessoa. É a diferença entre testar o que o código faz e
// testar o que a pessoa precisa que ele faça.
//
// O contrato agora: o estado é uma ESCOLHA DA PESSOA, persistida, e o widget é no máximo um tradutor que pode
// ou não estar presente. Um modo de acessibilidade cujo estado depende da geometria de uma biblioteca de
// terceiro é um modo que desliga sozinho quando a biblioteca muda de ideia.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as V from '../app/js/ui/vlibras.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

beforeEach(() => {
  document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
  localStorage.removeItem('incl_libras');
  V.setOnLibrasChange(() => {});
  if (V.librasOpen) V.toggleLibras(); // o estado é de MÓDULO: cada caso começa desligado
});
afterEach(() => {
  if (V.librasOpen) V.toggleLibras();
  localStorage.removeItem('incl_libras');
});

describe('ui/vlibras — o toggle é um toggle', () => {
  it('[Right] liga e desliga, e nada disso depende do widget existir', () => {
    // O caso que o defeito tornava impossível: sem o widget carregado, `toggleLibras` só conseguia avisar.
    // Quem precisa do modo não pode depender de uma biblioteca externa ter carregado para conseguir ligá-lo.
    expect(V.librasOpen).toBe(false);
    V.toggleLibras();
    expect(V.librasOpen).toBe(true);
    V.toggleLibras();
    expect(V.librasOpen).toBe(false);
  });

  it('[Right] `vlibrasOpen()` lê o NOSSO estado, não o retângulo do widget', () => {
    // A regressão que isto prende: um div de altura zero no markup legado costumava significar "ligado".
    document.body.innerHTML += '<div vw-access-button style="display:none"></div>';
    expect(V.vlibrasOpen()).toBe(false); // escondido, e mesmo assim DESLIGADO — porque ninguém ligou
    V.toggleLibras();
    expect(V.vlibrasOpen()).toBe(true);
  });

  it('[Right] persiste — quem liga o modo o reencontra ligado (ADR-0028)', () => {
    V.toggleLibras();
    expect(localStorage.getItem('incl_libras')).toBe('1');
    V.toggleLibras();
    expect(localStorage.getItem('incl_libras')).toBe('0');
  });

  it('[Interface] avisa o reflow do layout nas DUAS direções', () => {
    let n = 0;
    V.setOnLibrasChange(() => { n++; });
    V.toggleLibras();
    expect(n).toBe(1);
    V.toggleLibras();
    expect(n).toBe(2); // desligar também reflui: o layout não pode ficar com a forma do estado anterior
  });

  it('[Interface] a confirmação de ligar sai EM LIBRAS, não no leitor de tela', async () => {
    // Escrevi este caso esperando o texto em `#sr-status` e ele falhou — a expectativa é que estava errada, e
    // o desenho original é melhor que a minha suposição: `vlibrasSay` manda a confirmação ao INTÉRPRETE, ou
    // seja, ela sai na língua de que o modo trata. Quem anuncia ao leitor de tela é quem chama o toggle
    // (`ui/pause-icons`, com sr.icon.librasOn/Off), e é lá que esse caso mora.
    //
    // Sem o widget carregado nada disso é visível, e é justamente por isso que o toggle NÃO PODE depender
    // dele: o modo liga de qualquer forma, e o tradutor aparece se puder.
    expect(() => V.toggleLibras()).not.toThrow();
    await nextFrame();
    expect(V.librasOpen).toBe(true);
    expect(document.querySelector('#sr-status').textContent).toBe(''); // o módulo não fala aqui, por desenho
  });
});

describe('ui/vlibras — vlTick já não decide nada', () => {
  it('[Zero] chamar vlTick não muda o estado nem dispara reflow', () => {
    // Ele era o polling que lia a geometria a cada 250ms e virava a chave sozinho. Agora só espelha, e este
    // caso existe para que ninguém o transforme de volta num decisor sem notar.
    let n = 0; V.setOnLibrasChange(() => { n++; });
    V.vlTick(); V.vlTick(); V.vlTick();
    expect(n).toBe(0);
    expect(V.librasOpen).toBe(false);
    V.toggleLibras();
    const antes = V.librasOpen;
    V.vlTick();
    expect(V.librasOpen).toBe(antes);
  });
});
