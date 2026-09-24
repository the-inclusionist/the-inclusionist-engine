# Field test — Multilaser M7 3G Plus + one child

> 📌 **Two languages, on purpose.** This is an operational script read **in the field**, in Brazil. The parts used
> with the child and the carer — consent (PART 0), the session (PART 3) and the notes taken right after it
> (PART 4) — **stay in pt-BR**: the sentences said to the child are content, not an artifact (`CLAUDE.md`, the pt-BR
> exception). The engineering parts — the device measurement, putting the game on the tablet and where the notes
> go — are in English, like the rest of the test paperwork (`Test-Plan.md`). Menu paths on the device are quoted
> as the pt-BR Android UI shows them.

**Device:** Multilaser M7 3G Plus, bought by the **Prefeitura de Monte Aprazível in 2019**.
⚠️ **This is not a device similar to the target — it is the target.** Pillar 1 says «hardware de escola pública BR», and
until now that was a hypothesis. It becomes a device with an asset number.

**Covers:** issue #8 (validation on target hardware) and the half of #7 that needs a child. And, for **#112**, it
collects the child's own words: the screen that warns before the game starts **exists now** (`app/js/ui/reach-notice.ts`),
but its sentences were written without a child reading them; this session checks whether a child understands them.

---

## PARTE 0 · Antes de ligar o aparelho (5 min)

*(Kept in pt-BR: said and noted in the field, with the child's carer.)*

- [ ] **Autorização de quem cuida da criança**, dita em voz alta e anotada aqui: quem autorizou, quando.
      ⚠️ **Nada de foto, vídeo ou gravação de voz.** As notas descrevem o que a criança FEZ, e não quem ela é.
      Sem nome no ficheiro — use «a criança», e a idade em anos.
- [ ] **Idade:** ______  **Já usou tablet antes?** ( ) nunca ( ) às vezes ( ) todos os dias
- [ ] **Alguma necessidade específica conhecida?** (o senhor decide se registra; se não registrar, escreva
      «não registrado» em vez de deixar em branco — em branco lê-se como «não tem»)

---

## PART 1 · The device, without the child (15 min)

This is measurement, and it is what makes the session with the child interpretable afterwards. **Write down the values, not "ok".**

| what | where | note down |
|---|---|---|
| Android version | Config → Sobre o tablet | ______ |
| **Chrome** version | Chrome → ⋮ → Configurações → Sobre o Chrome | ______ |
| Screen resolution | Config → Sobre / or `chrome://gpu` | ______ |
| RAM | Sobre o tablet | ______ |

### ⚠️ The measurement that decides one of the engine's promises

**ADR-0065** assumes the system voice may not exist in Portuguese on a school device. **This is the
device to find out.** In the tablet's Chrome, open `chrome://version` and then test the voice:

- [ ] Config → Acessibilidade → **is there TalkBack?** ( ) yes ( ) no
- [ ] Config → Idiomas → **Saída de texto para voz** → is there a **Portuguese voice**? ( ) yes ( ) no
      **Which engine?** ______________ (Google TTS? Multilaser? none?)
- [ ] If there is one, tap «Ouvir um exemplo» and note: **is it understandable?** ( ) yes ( ) more or less ( ) no

📌 **If there is NO pt-BR voice on this device, that alone justifies the ~244 MB of the four neural voices** —
which is ADR-0110's decision, today supported by an assumption.

---

## PART 2 · Putting the game on the tablet

⚠️ **There is no deploy connected** (no Cloudflare Pages project is attached to any repository). The way is to serve
from your PC to the local network. From the root of the engine repository:

```bash
npm run build
```

```bash
npm run preview -- --host
```

`--host` makes the server accept the local network. It prints an address `http://192.168.x.x:PORT` — **open
that address in the tablet's Chrome**, with both on the same Wi-Fi. ⚠️ The built app has no `index.html` (it left
with the cartridge, #111): open **`/quiz.html`** at that address.

- [ ] **Did it open?** ( ) yes ( ) no → if not, note the exact error: ______________
- [ ] **How long until something appears on the screen?** ______ seconds (count under your breath, no
      stopwatch needed)

### The first-day test, if it can be done

📌 The Dev's decision, now pillar 8: **«PWA no primeiro dia ONLINE, depois OFFLINE-FIRST»**. The M7 has 3G, so
it can be proved:

- [ ] With Wi-Fi, open the game and let it load until it is playable.
- [ ] **Turn off Wi-Fi AND mobile data.** Close Chrome. Open the same address again.
- [ ] **Did it work without a network?** ( ) yes ( ) no ( ) partly: ______________

⚠️ If it does not work, **it is not the child's fault nor the device's** — it is the precache, which is exactly
what the precache gate (`npm run check:precache`) exists to watch. Note it and move on.

---

## PARTE 3 · A sessão com a criança (20–30 min)

*(Kept in pt-BR: the sentences in bold quotes are said to the child, and the answers are written in the child's words.)*

### As três regras, e a terceira é a difícil

1. **Não ensine.** Entregue o tablet e diga só: **«Dá uma olhada e vê o que dá pra fazer.»**
2. **Não corrija.** Se ela fizer «errado», isso É o resultado.
3. ⚠️ **Não pergunte se ela gostou.** Pergunte o que ela FEZ. *(É o Mom Test: «gostei» não é dado; «tentei
   apertar aqui três vezes» é.)*

### O que observar, sem interromper

Anote **o que aconteceu**, com o minuto aproximado:

| minuto | o que a criança fez | o que o jogo respondeu |
|---|---|---|
| | | |
| | | |
| | | |

### As cinco perguntas que este teste existe para responder

**1 · A barra de acessibilidade foi encontrada?**
- [ ] Ela tocou nos ícones do topo **sem ninguém apontar**? ( ) sim ( ) não
- [ ] Se tocou, **em qual primeiro**? ______________
- [ ] Se não tocou em nenhum em 10 minutos, anote isso — **é o resultado mais importante da sessão.**

**2 · O texto dá para ler nesse tamanho?**
- [ ] Ela aproximou o tablet do rosto? ( ) sim ( ) não
- [ ] Ela apertou os olhos? ( ) sim ( ) não
- [ ] Pergunte no fim, apontando para uma palavra: **«O que tá escrito aqui?»** — e anote se ela leu, hesitou
      ou não conseguiu: ______________

📌 *(Engineering note.)* This measures the `minPx` of #87 item 2 against a real screen, not against a number in a table.

**3 · O toque responde?**
- [ ] Algum toque dela **não fez nada**? ( ) sim ( ) não → o quê: ______________
- [ ] Ela conseguiu usar **dois dedos ao mesmo tempo**? ( ) sim ( ) não ( ) não tentou
      *(Engineering note: ADR-0104 §B set the floor at TWO touch points; this device is where that is confirmed.)*

**4 · A voz falou, e ela entendeu?**
- [ ] Ligue o leitor de tela pelo ícone da barra e observe: ela **parou para ouvir**? ( ) sim ( ) não
- [ ] Depois pergunte: **«O que a voz falou?»** — e anote a resposta dela **com as palavras dela**:
      ______________
      ⚠️ Se ela repetir errado, **a frase é que está errada**, não ela.

**5 · A frase da #112**
Esta é a colheita, não a verificação. Em algum momento, pergunte:

> **«Se um jogo precisasse de mais botões do que esse tablet tem, como é que ele devia te avisar?»**

Anote a resposta **em português dela, sem corrigir**: ______________

📌 *(Engineering note.)* The #112 screen (`ui/reach-notice`) and its sentences exist, written by adults; the child's
answer is what they are checked against, and rewritten from if they do not match.

---

## PARTE 4 · Depois (5 min, antes de esquecer)

*(Kept in pt-BR: the field operator's own notes, written right after the session.)*

- [ ] **A coisa que mais me surpreendeu:** ______________
- [ ] **O momento em que ela travou:** ______________
- [ ] **Uma coisa que eu ia jurar que funcionava e não funcionou:** ______________
- [ ] **Duração real da sessão:** ______ min · **ela quis continuar?** ( ) sim ( ) não

⚠️ **Se a sessão acabar em 5 minutos porque ela perdeu o interesse, isso é um resultado completo.** Anote e
não repita no mesmo dia.

---

## What to do with these notes

Paste the filled-in sheet as comments on the issues, split like this:

| part | issue |
|---|---|
| PART 1 (device, system voice) | [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) |
| PART 2 (first day / offline) | [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) |
| PARTE 3 questions 1–4 | [#7](https://github.com/the-inclusionist/the-inclusionist-engine/issues/7) |
| PARTE 3 question 5 (the sentence) | [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112) |

📌 **No need to organise or summarise.** Paste it raw, with the "don't know"s and the empty fields — an empty field
says it could not be measured, and that is information. The AI reads it and turns it into work.
