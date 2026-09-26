# Interface log

The two-way doors of the interface (ADR-0172): choices a commit can reverse — layout, order, wording, which items show,
spacing. One-way doors — the contract, the public surface, stored keys, packages, licences, privacy — are records in
`adr/`.

**Form of an entry.** A dated heading, the Dev's words quoted, what was decided in one or two sentences, and the commit or
issue. A changed decision gets a new entry below; the old one stays. Newest last.

<!-- entries start below -->

## 2026-09-13 · The quiz's options at 640×360: 4 px apart, 2 px above the footer

Asked whether the quiz may keep its options 4 px apart with 2 px to spare above the footer (the cost of reserving the
icon-name line under the quick bar, issue #160): «Ficou bom». The spacing of `engine:4f111ec` stays.

## 2026-09-13 · The HUD's look: dark chips, and the learning bar's cues besides colour

⚠️ Chosen while building issue #162 and NOT YET SEEN by the Dev — no Dev words to quote. Identity and round numbers are
text on the same dark chip as the icon's name; the learning bar's segments are Okabe-Ito (blue #0072B2, green #009E73,
red #D55E00; a purple #CC79A7 or orange #E69F00 bar covers them), with a second cue each so no state is told by colour
alone (WCAG 1.4.1): green a dot, red stripes, an empty slot only its outline, a purple bar ▲ and an orange one ▼.
`engine:2e83917`, `engine:a998e33`.

## 2026-09-13 · The learning bars: position and size approved

Shown the demo page of the HUD (three ten-segment bars centred in the footer, Okabe-Ito with a cue besides colour): «As barras
de ganho na parte de baixo estão bem posicionadas e num tamanho bom, aprovo.» The bars of `engine:a998e33` stay. The rest of
that demo's layout changed by a record (ADR-0175).

## 2026-09-13 · A face with a 20 px floor enlarges its own text, not the whole document

Shown that at 640×360 the quiz's last option drops into the footer when a face with a 20 px floor (text 25% larger) is
chosen, with three things that could yield — the gap between options, the footer band while no explanation shows, or the
face enlarging only its own text: «Apertando ctrl + - até o zoom chegar a 25% a fonte não diminuiu de tamanho mais uma série
de espaços sim, mantendo o design muito bom. Quais espaços diminuiram? Seja quais forem, estes é que devem ser atacados. Por
isso minha intuição diz que a face de piso 20 deve aumentar só o próprio texto, sem aumentar o documento inteiro.» The floor
scale applies to text, not to spacing; and the spaces that shrink under browser zoom-out while text holds its floor are
measured and named, since those are the ones to reduce. Issue #172.

## 2026-09-13 · A sound caption stays for its words

⚠️ Chosen while building plan phase 5c and NOT YET SEEN by the Dev — no Dev words to quote. The sound caption left after a
fixed 2600 ms; it now stays 500 ms a word (120 words a minute, the low end of the BBC subtitle guidelines' rate for children's
programmes), never under 2600 ms. `engine:2bd2826`. A reading-pace preference for early readers would be a stored setting,
and is a question, not this entry.

## 2026-09-13 · The quick bar sits on the screen's top edge; speed and toggle keys are two buttons

Asked where the game speed goes: «No painel de acessibilidade rápida (ícone de dedo, já existe no Platformer inclusive). Importante: eleve este painel para que compartilhe a borda com a tela e ceda mais pixels para o restante do jogo.» And, on reading that the finger icon's panel would hold the speed: «De forma alguma. Um botão para alternância e outro para velocidade.» The quick bar loses its 10 px from the top and sits on the edge, giving that room to the game; the game speed is its own ⏳ button (ADR-0180), beside ☝️ toggle keys. Issue #176.

## 2026-09-13 · «Voz» sits after the narration volume

⚠️ The row is the Dev's (ADR-0185); its PLACE was chosen while building and NOT YET SEEN by the Dev. «Voz» follows «Volume da narração» and precedes «Índice falado dos menus», so the voice block reads switch, volume, voice. Names shown are the middle of the provider's id («Faber», «Ryan», «Amy», «Claude»). `engine:9d0f5e5`, issue #180.

## 2026-09-13 · Rates read «125 PPM», and a menu is not a manual

«Em acessibilidade visual, o ritmo das legendas está com a explicação no lugar errado. E você deve abreviar palavras por minuto para PPM. Menu não é manual de instruções.» A rate's value is «125 PPM» (WPM in English), and a row's explanation is one short sentence, in the footer. `engine:` the commit after `e61d571`, issue #179.

## 2026-09-13 · A settings panel wears the pause card, and every menu card has one height

«Ao clicar em configurações de inclusão, o menu mantem a mesma altura e identidade visual. Para além disso, todos os submenus
estão com outra identidade visual, com alturas menores, título maior e cores diferentes. Corrija.» A panel takes the pause card as
it is — the whole height, the dark card with the gold border, the gold title at the text size, rows in the pause items' fill,
border and radius with 2 px gaps — and is at least the pause card's width, wider only when a steps row needs it (the visual
panel, 602 px at 640×360, because of the BDA spacing). The root card, whose six items had shrunk it 46 px, holds the whole height
too. The panel runs under the explanation band, and its last row scrolls above it. `engine:d5b4c10`, `engine:36ca8d6`.

## 2026-09-13 · The help is a slide show

«Ao clicar em ajuda a tela se assemelha a um menu e inclusive tem um botão "restaurar padrões deste menu" quando na verdade deveria
conter uma "apresentação de slides" (textos, figuras e no máximo animações).» One slide per position the game names: the child's
key drawn as a key cap that presses itself now and then (off under reduced motion), the game's word and its sentence, dots for
the place; left and right turn the page, the ends are walls. No reset, no footer band. ⚠️ The slide's LAYOUT was chosen while
building and is NOT YET SEEN by the Dev; it shows what the engine knows (key, word, sentence) — a game's own «how to play» slides
would be a contract field, not drawn here. `engine:e9a24d1`.

## 2026-09-14 · A game's «how to play» slide: figure above, text below

⚠️ The slide's LAYOUT was chosen while building ADR-0195 and is NOT YET SEEN by the Dev. A cartridge's slide shows its figure on
top (up to 16 em wide, 7 em tall) and its text under it, with the same arrows and dots as the button slides; the game's slides
come first. The house quiz tells how to play in two slides, the second animating the marked option down. `engine:a85bfee`.

## 2026-09-14 · «Ritmo da fala» sits after the narration volume, and starts at 150 PPM

⚠️ The rate is the Dev's (ADR-0183 §1); its PLACE and its DEFAULT were chosen while building and are NOT YET SEEN by the Dev. The
row is a list («150 PPM» … «500 PPM», eleven steps) after «Volume da narração», before «Voz». It starts at 150, the slowest step,
as the caption rate starts at its slowest; at 150 the Faber voice (255 PPM of speech, measured) plays at about 0.59×.
`engine:c3a0097`, issue #179.

## 2026-09-14 · The speech rate starts at the voice's normal speed

The entry above chose 150 PPM as the default. The Dev: «Nada disso, velocidade normal é a mínima (254?, e deve poder aumentar de 50
em 50 até ~500ppm, isto é, 504ppm)». The steps become 254–504 by 50, starting at 254, and no voice plays under 1× — a record
(ADR-0196), since it changes ADR-0183's steps. The row keeps its place after the narration volume.
## 2026-09-16 · The eye control's regions: where they sit, their size, and the colours of a look

⚠️ Chosen in the lab while building the Dev's presentation (ADR-0213 §6) and seen by the Dev only through the lab, not in the engine. The
four regions sit at the edges of the game region and the middle at its centre, as fractions of it: north and south 26% × 18% at 10% from
the top and bottom edge, east and west 24% × 24% at 13% from the side edge, the middle 24% × 26%. A region nobody looks at is outlined and
hatched faintly; a look that prepares draws it amber (#ffd23f), an armed look green (#3ddc84), with a 3 px outline. The face button's two
circles sit side by side. Lab `apresentacao.js`; engine issue #194.

## 2026-09-16 · The eye control in the engine: the eye lines and no dark wash

⚠️ Chosen while porting the lab to `engine:ui/gaze-overlay` and not yet seen by the Dev in the engine. The eyes, irises and brows are drawn
as white lines 2 px wide (growing with the text) with a soft black shadow, both eyes the same colour — the lab drew the left eye green and
the right one red, which reads as a state colour beside the amber and green of a look. The lab's dark wash under each region (35% navy) is
left out: over a game it would darken the game itself at every level; the outline, and at the hatched level the hatching, mark the
regions instead. Engine issue #194.

## 2026-09-16 · The quick bar's hand icons: 🤟 is gestures, 🦻 is the deaf person

The Dev: «O ícone para jogar por gestos é 🤟, a partir de agora o ícone da pessoa surda deve ser 🦻». The Libras / deaf-mode icon changed
its glyph from 🤟 to 🦻 (`engine:ui/pause-icons`); its key, name and behaviour did not. 🤟 is kept for the hand-gestures toggle, which the
bar does not have yet (issue #191). Seen by the Dev only as this decision, not yet in the engine.

## 2026-09-16 · Menu is the quick bar's first icon, and the icons touch

The Dev: «Menu deve ser o primeiro ícone. A distância entre os ícones deve ser zero.» The bar opens with a Menu icon (☰) that opens
the menus of its seat, the same door as SELECT; the quiz's own Menu button, top left, leaves. The gap between the bar's icons is zero.
The camera icons became one in the same message (ADR-0215). Issue #199.

## 2026-09-16 · The language button: three drawn flags, last on the bar

The Dev: «Adicione um último botão à barra de acessibilidade rápida e coloque três bandeiras que se intercalam cada vez que o botão é
apertado: Brasil, Estados Unidos e México.» The button is the bar's last and cycles pt → en → es. The flags are drawn as SVG, since
flag emoji render as the letters BR, US, MX on Windows (measured: zero coloured pixels). Each language is named in itself with its
place — «Português (Brasil)», «English (United States)», «Español (México)» — and the tag given to speech and recognition carries that
region: pt-BR, en-US, es-MX (English and Spanish went without a region before). Seen by the Dev only as this decision.

## 2026-09-21 · Sticky keys are called «Não precisa segurar», and the motor panel offers them

The Dev: «a aderência existe (ADR-0211, padrão em câmera e fala) e falta oferecê-la como opção para teclado e toque, com nome que a
criança entenda». ⚠️ The WORDS were chosen while building and are NOT YET SEEN by the Dev. The setting had two names, both the
mechanism's and neither the child's — the quick bar said «Teclas de alternância» and the panel «Movimento por alternância», for one
stored value. Both become **«Não precisa segurar»** / «No holding needed» / «No hace falta mantener», with one sentence under it: «Um
toque liga e outro desliga, em vez de manter o botão pressionado.» The motor panel gains the row (`#opt-sticky`, after «Mapear
toque»): hidden where the game holds no key at all, locked with its reason where the device sends one command at a time (the eyes,
the face, gestures, speech), and writing the same value the ☝️ writes. The platformer's sentences left the engine's words with it —
«toque a direção para andar», «o pulo não interrompe a caminhada» described a game the engine does not have.


## 2026-09-21 · ☝️ is called «Jeito de apertar», and its three positions are named

The Dev: «vamos ciclar entre controle padrão > teclas de aderência > jogar com um botão só, ícone de acessibilidade: ☝️» (ADR-0218).
⚠️ The WORDS were chosen while building and are NOT YET SEEN by the Dev. A cycle cannot be named after one of its positions, so the
icon and the panel row stop being called «Não precisa segurar» — the entry above, from earlier the same day — and become **«Jeito de
apertar»** / «How you press» / «Cómo pulsar», the subject; the three positions are what the child reads beside it: **«padrão»**,
**«não precisa segurar»**, **«um botão só»** (standard · no holding needed · one button only). The one sentence under it names the
three in the order they come. The panel row changes shape with them, from a switch to «◀ Jeito de apertar: padrão ▶», because a
switch cannot hold three positions and two surfaces of one setting must say the same thing. `engine:0cae5c0`.

## 2026-09-22 · The remapping row shows the KEY on the button, and an arrow key shows its arrow

Two changes to the same screen, both the Dev's, both seen by them.

**The key moved onto the button.** Asked whether the word «Alterar» was worth keeping on screen, they answered «Não vale, vamos de B».
The row was «Esquerda: A [Alterar]» and is now «Esquerda [A]» — the current key IS the button's face, and «Alterar» survives only
where a position has no key bound, which is where the word still means something. 🔴 The reason was measured, not preferred: with the
keys inside the label's `<span>`, `fillExplain` does `span.innerHTML = strong.outerHTML` and **zero of the two `<kbd>` survive** — the
panel would stop showing what is mapped. 📌 And the house had answered this once already: `mountSteps` puts the value inside the
control for exactly this reason. `engine:964daa3d`.

**Each arrow shows its own arrow.** The Dev, seeing a screenshot: «Por que está escrevendo "↔Up", "↔Down" etc ao invés de simplesmente
"↑", "↓", "←" e "→"? Não escolha poluir a UI, por favor.» They are now **↑ ↓ ← →**, one glyph each and all four distinct. 📏 The same
defect reached further than the arrows — `Digit1` read «Digit1» and `Numpad5` read «Numpad5» — because the function was a chain of
`replace` over the physical code, which is a hidden table that writes what nobody chose. They are now «1» and «Num 5»; the numpad keeps
its word because it is a different physical key and two identical labels in one list send the child to the wrong one. What is not
recognised still passes untouched: «Comma» is ugly and honest, and guessing a name on the remapping screen is worse.
`engine:4d03a321`.

## 2026-09-23 · The sign-language interpreter says hello instead of an identifier

⚠️ **My words, and the Dev has not seen them.** When the deaf mode turns on, the engine hands the VLibras widget a sentence to be
SIGNED — and it had been handing it the key `sr.libras.on`, which no dictionary ever declared. 📏 The call arrived with the code in
`engine:b0239e91` and has been broken since, so the first thing the interpreter signed to a child who had just called it was an
identifier. It now signs **«Olá! O intérprete de Libras está ligado.»** (en «Hello! The sign-language interpreter is on.», es «¡Hola!
El intérprete de lengua de señas está activado.»).

📌 Three choices inside that sentence, and each could be undone by one commit, which is why they are here and not in a record. It is a
**greeting** and not a system state, because the thing that says it is a person on screen and «interpreter enabled» is what a settings
row would say, not what someone who has just appeared would say. It is **short**, because it is signed and a signed sentence costs
seconds the child is waiting through. And it **names itself**, because the widget may take a moment to appear and the child needs to
know that the figure that arrived is the one they asked for. `engine:f2c544a2`.


## 2026-09-25 · The opening menus take their widest item's width, and the ronde's label names Cookie

⚠️ **Choices made while building, and the Dev has not seen them in a game.** The six opening menus (`#tm-main`, `#tm-alf`,
`#tm-mat`, `#tm-tab`, `#tm-fr`, `#tm-cen`) went from a fixed `26em` to `fit-content` with no minimum width (issue #134 rule 6):
📏 at 640×360 a short menu measured 118 px and one with a long Spanish label 493 px, one line each, inside the screen. The pause
list (`.pause-menu`) and the settings-panel floor (`.ctrl-list`) are outside the six the issue names and keep `26em`.
The ronde's row in the typography panel now names all four faces of its stack, Cookie last, and its notice says that without the
three school faces the game shows Cookie, which is not the ronde taught at school (issue #150, ADR-0154). `engine:3875ce45`,
`engine:5ba43b71`.


## 2026-09-25 · Menus scroll inside their card, and the cursor stays in view

⚠️ **Choices made while building, and the Dev sees them in the running demo.** Asked by the Dev («os menus não rolam quando
têm mais de 6 ítens»): a list longer than its card scrolls INSIDE the card and the page never scrolls; the item under the
cursor is kept in view by one function (`ui/menu-items.keepInView`) whatever moved it — keyboard, pad, touch, gaze, voice or
scan. The pause card reserves the HUD row and the footer band at its end (`--rodape-h + --footer-band-h`) so its last item
rests above them; the scrollbar keeps the browser's own look. The opening menus scroll at `max-height:72%` of the stage. With
the other rules of issue #134 (ADR-0130): back from a card's list lands on the item that opened it, and a pointer press moves
the cursor too; back to an opening menu focuses its opener; every layer under the front card is `inert`; an exclusive choice
of five or fewer positions cycles in its row and a longer one is a dropdown (the cane row became «uma por bloco» / «a cada
meio bloco»; an audio-output row cycles over the shared output and up to four devices). `engine:91da1bc8`…`engine:0fbac5ca`.


## 2026-09-25 · The Libras interpreter: bottom right, and only while it signs

The Dev placed the VLibras avatar at the **bottom right** of the screen, where it already was (25vw × 50vh, over part of the
quiz's last answers; the Dev saw it there and kept it). It appears when the sonar calls it with deaf mode on and **leaves the
screen when it finishes signing** — the Dev: «ele só deve aparecer quando for "invocado" via sonar e desaparecer quando não
estiver em uso». The player stays loaded behind, so a second call shows it at once instead of after the ~4 s of its first load.


## 2026-09-25 · The interpreter leaves 5 s after the player itself says it stopped

Replaces the 1 s after the gloss counter of the previous entry. The Dev: «Ao invés de estipular o tempo, não tem mesmo como
fazer ele sair da tela 5 segundos após entrar em pose de espera?», then «Sim.» The Unity player reports its own state
(`onPlayingStateChange`, whose first flag is «playing»); the avatar leaves the screen 5 s after that flag turns false — the
player's word that it is back at rest, not a time the engine guesses. A new sonar press within those 5 s cancels the leaving.
To be confirmed against the player's canvas frames that the report coincides with the rest pose.


## 2026-09-25 · «Ligado» is said by the control that started, not by the press

⚠️ **A choice made while fixing a defect, and the Dev has not heard it.** Pressing the 👄 or the 📷 (or the motor panel's
microphone and camera rows) announced «ligado» at the press, while the control starts later and may fail — the child heard
«Comando de voz: ligado» for a control that stayed off. Now the press says nothing while the control starts (the button's
pressed state still changes); the control itself then says «Pronto: …» (or, for face and eyes, its «Olhe para o meio…» first),
or the reason it could not start. Turning OFF still says «… desligado» at the press, which is true when it is written. A
«ligando…» line was not added: on a failure it would leave the spoken state disagreeing with the button again.
`engine:cb0274dc`.


## 2026-09-26 · The free Libras player spells a word with the hand held up between letters

The Dev: «Sim» — asked whether the letters of one spelled word chain, the hand staying in the signing space and coming down
only at the word's end, instead of every letter's clip rising from rest and falling back to it. Measured on the exported
alphabet: a letter takes 1.2–1.97 s (median 1.63 s), of which the hand rises for ~0.48 s and falls for ~0.52 s; chained,
«ENTROU» goes from ~8.3 s to ~3.9 s and «PÕE» from ~4.3 s to ~2.8 s. Fingerspelling in Libras is done with the hand still in
the signing space; the rise and fall between letters was an artefact of each letter being an isolated clip. A sign that is
not a letter or digit keeps its whole clip. Engine: route B's sequencer (`ui/libras-avatar-*`), to be built.

## 2026-09-26 · The quiz's welcome names the child's own keys for choosing and answering

⚠️ Chosen while fixing a false welcome and NOT YET SEEN by the Dev — no Dev words to quote. The demo quiz said «Use as setas
para escolher e Enter para responder», and Enter is `start` (it opened the pause, measured on the served `dist`). The line is
now built from the child's scheme: one key per position, an arrow or Space named first when bound — «Quiz. Use ↑ e ↓ para
escolher e Espaço para responder.» in the default scheme, her own keys after a remap, and a position with no key is not
named (with no key at all: «Quiz. Toque numa resposta para responder.»). `engine:77868fdc`; the double answer one Space used
to give, which this line would have sent children into, `engine:aeea9423`.

## 2026-09-26 · One-button scanning inside a menu, and the engine's two doors in play

⚠️ Chosen while building ADR-0218 §3 and NOT YET SEEN by the Dev — no Dev words to quote. Inside the quick pause, the card or
a panel, the scan offers that menu's own steps after «cancelar»: «próximo · confirmar · voltar · anterior» (English «next ·
confirm · back · previous», Spanish «siguiente · confirmar · volver · anterior»). The order is how often a child needs each:
every menu here is a ring, so «próximo» alone reaches every item; «confirmar» ends every choice; «voltar» leaves — the quick
pause, a sub-list, a panel, the card —; «anterior» is a shortcut the ring already covers, so it waits last. There is no
sideways step, so a slider or a ⯇ ⯈ control in a panel cannot be adjusted by scanning yet. In play, after the game's named
positions, the scan offers the engine's doors in the order ADR-0218 §3 names them: «menu» (SELECT, the card), then «pausar»
(START, the quick pause; English «menu», «pause», Spanish «menú», «pausar»), each only where it has something behind it.
The chip's words for both lists are lower case, like «cancelar», so they read as the engine's and not as a game's own words.
Engine `5aff5bf8` (the menus), `2e9c76a1` (the doors).
