# SPDX-License-Identifier: AGPL-3.0-or-later
"""Rebuild the Vosk models as the gzipped tar archives vosk-browser loads (ADR-0193, ADR-0203).

alphacephei publishes each model as a .zip; the browser build reads a .tar.gz of the model folder. This repacks without changing a
byte of any model file, deterministically (sorted entries, mtime 0, gzip header mtime 0), so the same zip always gives the same sha256.

Usage: python scripts/models/repack-vosk-models.py <out>   (downloads the three zips from alphacephei.com into <out>/zips)
"""
import gzip, hashlib, io, pathlib, sys, tarfile, urllib.request, zipfile

MODELS = {
    "vosk-model-small-pt-0.3": "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip",
    "vosk-model-small-es-0.42": "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip",
    "vosk-model-small-en-us-0.15": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
}
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
zips = out / "zips"; zips.mkdir(exist_ok=True)

for name, url in MODELS.items():
    z = zips / f"{name}.zip"
    if not z.exists():
        urllib.request.urlretrieve(url, z)
    with zipfile.ZipFile(z) as zf:
        infos = sorted((i for i in zf.infolist() if not i.is_dir()), key=lambda i: i.filename)
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w", format=tarfile.PAX_FORMAT) as t:
            for i in infos:
                data = zf.read(i)
                ti = tarfile.TarInfo(i.filename); ti.size = len(data); ti.mtime = 0; ti.mode = 0o644; ti.uname = ti.gname = ""
                t.addfile(ti, io.BytesIO(data))
    destino = out / f"{name}.tar.gz"
    with open(destino, "wb") as f, gzip.GzipFile(filename="", mode="wb", fileobj=f, mtime=0, compresslevel=9) as g:
        g.write(buf.getvalue())
    print(name, destino.stat().st_size, hashlib.sha256(destino.read_bytes()).hexdigest(), "zip sha256", hashlib.sha256(z.read_bytes()).hexdigest())
