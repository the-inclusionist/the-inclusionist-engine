# -*- coding: utf-8 -*-
"""Measures the FOUR proposed readable layers against the readable content that exists.

The method is CONTROLE_ENGINE's: do not design the number, MEASURE whether it closes. If
readable content is left outside the four, either there are more layers or what is left
is not readable — and both conclusions only show up by counting.

⚠️ The `game/` modules listed below left with the cartridge (issue #111); run today, the
layers that name them count nothing. The script is the record of how the layers were measured.
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAIZ = "app/js"
SINK = re.compile(r"innerHTML\s*=|insertAdjacentHTML")
FALA = re.compile(r"\bsrSay\(|\bsrAlert\(|\.narrate\(|\banunciar\w*\(")

# The four layers the Dev proposed, mapped to modules.
CAMADAS = {
    "1 · ACTION (the world where things happen)": [
        "game/physics.ts", "game/session.ts", "game/recycling-scene.ts", "game/recycling.ts",
        "game/coins.ts", "game/powerups.ts", "game/carry.ts", "game/life.ts", "game/secret-areas.ts",
        "game/elevators.ts", "game/traffic.ts", "render/draw.ts", "platform/audio-sonar.ts",
        "platform/audio-nav.ts",
    ],
    "2 · SCHOOL ACTIVITY (the minigame on top of the game)": [
        "game/quiz.ts", "consumer-quiz/main-quiz.ts", "game/braille.ts", "game/fractions.ts",
        "game/literacy-distractors.ts", "game/activity-content.ts",
    ],
    "3 · THE GAME'S HUD": ["ui/hud.ts"],
    "4 · THE MINIGAME'S HUD": [],  # it lived inside game/quiz.ts (winsDots) when this was measured
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
    print("WHAT FALLS INTO THE FOUR LAYERS")
    print("=" * 78)
    for camada in CAMADAS:
        ms = [m for m in todos if PERTENCE.get(m) == camada]
        s = sum(sinks.get(m, 0) for m in ms)
        f = sum(falas.get(m, 0) for m in ms)
        print("\n%s\n   %d markup sinks · %d announcements" % (camada, s, f))
        for m in ms:
            print("     %-34s markup:%-3d speech:%d" % (m, sinks.get(m, 0), falas.get(m, 0)))

    print("\n" + "=" * 78)
    print("⚠️  WHAT IS LEFT — readable content OUTSIDE the four")
    print("=" * 78)
    fora = [m for m in todos if m not in PERTENCE]
    ts = sum(sinks.get(m, 0) for m in fora)
    tf = sum(falas.get(m, 0) for m in fora)
    print("   %d markup sinks · %d announcements, in %d modules\n" % (ts, tf, len(fora)))
    for m in sorted(fora, key=lambda x: -(sinks.get(x, 0) * 10 + falas.get(x, 0))):
        print("     %-34s markup:%-3d speech:%d" % (m, sinks.get(m, 0), falas.get(m, 0)))

    print("\n" + "=" * 78)
    dentroS = sum(sinks.get(m, 0) for m in todos if m in PERTENCE)
    dentroF = sum(falas.get(m, 0) for m in todos if m in PERTENCE)
    print("TOTALS   inside the four:  %d markup / %d speech" % (dentroS, dentroF))
    print("         OUTSIDE the four: %d markup / %d speech" % (ts, tf))
