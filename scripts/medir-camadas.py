# -*- coding: utf-8 -*-
"""Mede as QUATRO camadas legiveis propostas contra o conteudo legivel que existe.

O metodo e o do CONTROLE_ENGINE: nao desenhar o numero, MEDIR se ele fecha. Se
sobrar conteudo legivel fora das quatro, ou sao mais camadas, ou o que sobra nao
e legivel — e as duas conclusoes so aparecem contando.
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAIZ = "app/js"
SINK = re.compile(r"innerHTML\s*=|insertAdjacentHTML")
FALA = re.compile(r"\bsrSay\(|\bsrAlert\(|\.narrate\(|\banunciar\w*\(")

# As quatro camadas propostas pelo Dev, mapeadas a modulos.
CAMADAS = {
    "1 · ACAO (o mundo onde as coisas acontecem)": [
        "game/physics.ts", "game/session.ts", "game/recycling-scene.ts", "game/recycling.ts",
        "game/coins.ts", "game/powerups.ts", "game/carry.ts", "game/life.ts", "game/secret-areas.ts",
        "game/elevators.ts", "game/traffic.ts", "render/draw.ts", "platform/audio-sonar.ts",
        "platform/audio-nav.ts",
    ],
    "2 · ATIVIDADE ESCOLAR (o minigame por cima do jogo)": [
        "game/quiz.ts", "consumer-quiz/main-quiz.ts", "game/braille.ts", "game/fractions.ts",
        "game/literacy-distractors.ts", "game/activity-content.ts",
    ],
    "3 · HUD DO JOGO": ["ui/hud.ts"],
    "4 · HUD DO MINIGAME": [],  # hoje vive dentro de game/quiz.ts (winsDots)
}

PERTENCE = {}
for camada, mods in CAMADAS.items():
    for m in mods:
        PERTENCE[m] = camada


def varre():
    sinks, falas = {}, {}
    for base, _, fichs in os.walk(RAIZ):
        rel = os.path.relpath(base, RAIZ).replace("\\", "/")
        if rel.startswith("i18n"):
            continue
        for f in sorted(fichs):
            if not f.endswith(".ts") or f.endswith(".d.ts"):
                continue
            mod = (f if rel == "." else rel + "/" + f)
            txt = io.open(os.path.join(base, f), encoding="utf-8").read()
            linhas = [l.strip() for l in txt.split("\n")]
            codigo = [l for l in linhas if l and not l.startswith("//") and not l.startswith("*")]
            ns = sum(1 for l in codigo if SINK.search(l))
            nf = sum(len(FALA.findall(l)) for l in codigo)
            if ns:
                sinks[mod] = ns
            if nf:
                falas[mod] = nf
    return sinks, falas


if __name__ == "__main__":
    sinks, falas = varre()
    todos = sorted(set(sinks) | set(falas))

    print("=" * 78)
    print("O QUE CAI NAS QUATRO CAMADAS")
    print("=" * 78)
    for camada in CAMADAS:
        ms = [m for m in todos if PERTENCE.get(m) == camada]
        s = sum(sinks.get(m, 0) for m in ms)
        f = sum(falas.get(m, 0) for m in ms)
        print("\n%s\n   %d sinks de markup · %d anuncios" % (camada, s, f))
        for m in ms:
            print("     %-34s markup:%-3d fala:%d" % (m, sinks.get(m, 0), falas.get(m, 0)))

    print("\n" + "=" * 78)
    print("⚠️  O QUE SOBRA — conteudo legivel FORA das quatro")
    print("=" * 78)
    fora = [m for m in todos if m not in PERTENCE]
    ts = sum(sinks.get(m, 0) for m in fora)
    tf = sum(falas.get(m, 0) for m in fora)
    print("   %d sinks de markup · %d anuncios, em %d modulos\n" % (ts, tf, len(fora)))
    for m in sorted(fora, key=lambda x: -(sinks.get(x, 0) * 10 + falas.get(x, 0))):
        print("     %-34s markup:%-3d fala:%d" % (m, sinks.get(m, 0), falas.get(m, 0)))

    print("\n" + "=" * 78)
    dentroS = sum(sinks.get(m, 0) for m in todos if m in PERTENCE)
    dentroF = sum(falas.get(m, 0) for m in todos if m in PERTENCE)
    print("TOTAIS   dentro das quatro: %d markup / %d fala" % (dentroS, dentroF))
    print("         FORA das quatro:   %d markup / %d fala" % (ts, tf))
