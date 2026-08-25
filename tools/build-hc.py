#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Gera as silhuetas de ALTO CONTRASTE (_hc.png) a partir dos frames de cor.
# Fonte da verdade = assets/sprites/menino/<animacao>/<i>.png  (editados no Aseprite)
# Saida            = assets/sprites/menino/<animacao>/<i>_hc.png (silhueta amarela #ffe600)
# Uso: python tools/build-hc.py   (rode apos editar/exportar os frames de cor)
import glob, os, re
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'menino')
HC = (255, 230, 0, 255)
n = 0
for p in glob.glob(os.path.join(ROOT, '**', '*.png'), recursive=True):
    stem = os.path.splitext(os.path.basename(p))[0]
    if not re.fullmatch(r'\d+', stem):   # so frames numerados (0.png, 1.png...); ignora _hc e candidatos
        continue
    im = Image.open(p).convert('RGBA')
    px = im.load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] > 128:
                op[x, y] = HC
    out.save(os.path.join(os.path.dirname(p), stem + '_hc.png'))
    n += 1
print(f'{n} silhuetas _hc geradas em {os.path.relpath(ROOT)}')
