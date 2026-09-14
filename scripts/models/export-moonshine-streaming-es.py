# SPDX-License-Identifier: AGPL-3.0-or-later
"""Rebuild moonshine-streaming-small-es-onnx from moonshine-ai/moonshine-streaming-small-es (MIT) — ADR-0201 erratum, ADR-0203.

What it writes into <out>/:
  onnx/encoder_model.onnx                     fp32 — the encoder, its all-ones attention mask built inside the graph
  onnx/decoder_model_quantized.onnx           q8   — first decoding step (no past), MatMul/Gather per-tensor
  onnx/decoder_with_past_model_quantized.onnx q8   — later steps (self-attention past in, cross-attention states passed through)
  the upstream tokenizer and configuration files, and SHA256SUMS

Usage (Python 3.12):
  uv venv --python 3.12 .venv
  uv pip install --python .venv --index-url https://download.pytorch.org/whl/cpu torch==2.14.0
  uv pip install --python .venv "transformers==5.17.0" onnx onnxscript onnxruntime av numpy jiwer
  .venv/Scripts/python scripts/models/export-moonshine-streaming-es.py <out> [--check audio.m4a]
"""
import os, sys, json, shutil, hashlib, pathlib, re, unicodedata
import numpy as np, torch
from torch.export import Dim
from transformers import MoonshineStreamingForConditionalGeneration
from transformers.cache_utils import DynamicCache, EncoderDecoderCache, DynamicLayer
from huggingface_hub import hf_hub_download

REPO, REVISION = "moonshine-ai/moonshine-streaming-small-es", "8cb0974f29ca24d6b645518c430efc8c57cd0073"  # the revision exported on 2026-09-14
OPSET = 18
out = pathlib.Path(sys.argv[1]); (out / "onnx").mkdir(parents=True, exist_ok=True)

# 1. A cache layer's first update keeps the states as they are. The library concatenates onto a rank-1 empty tensor, which the
#    exporter refuses («All tensors must have the same rank»). Export-time only; the model's numbers do not change.
_update = DynamicLayer.update
def _update_first(self, k, v, *a, **kw):
    if not self.is_initialized:
        self.dtype, self.device, self.is_initialized = k.dtype, k.device, True
        self.keys, self.values = k, v
        return k, v
    return _update(self, k, v, *a, **kw)
DynamicLayer.update = _update_first

m = MoonshineStreamingForConditionalGeneration.from_pretrained(REPO, revision=REVISION, attn_implementation="eager").eval()
cfg = m.config
L = cfg.num_hidden_layers

class Encoder(torch.nn.Module):
    # 2. The all-ones attention mask the processor passes. WITHOUT IT the encoder skips its sliding windows and the decoder loops.
    def __init__(s): super().__init__(); s.enc = m.model.encoder
    def forward(s, input_values):
        return s.enc(input_values, attention_mask=torch.ones_like(input_values, dtype=torch.long)).last_hidden_state

def presents(cache, i):
    sa, ca = cache.self_attention_cache.layers[i], cache.cross_attention_cache.layers[i]
    return [sa.keys, sa.values, ca.keys, ca.values]

class DecoderFirst(torch.nn.Module):
    def __init__(s): super().__init__(); s.m = m
    def forward(s, input_ids, encoder_hidden_states):
        cache = EncoderDecoderCache(DynamicCache(), DynamicCache())
        o = s.m.model.decoder(input_ids=input_ids, encoder_hidden_states=encoder_hidden_states, past_key_values=cache, use_cache=True)
        return (s.m.proj_out(o.last_hidden_state), *[t for i in range(L) for t in presents(o.past_key_values, i)])

class DecoderWithPast(torch.nn.Module):
    def __init__(s): super().__init__(); s.m = m
    def forward(s, input_ids, encoder_hidden_states, past):
        self_c, cross_c = DynamicCache(), DynamicCache()
        for i in range(L):
            self_c.update(past[4 * i], past[4 * i + 1], i)
            cross_c.update(past[4 * i + 2], past[4 * i + 3], i)
        cache = EncoderDecoderCache(self_c, cross_c)
        for i in range(L): cache.is_updated[i] = True
        o = s.m.model.decoder(input_ids=input_ids, encoder_hidden_states=encoder_hidden_states, past_key_values=cache, use_cache=True)
        outs = [s.m.proj_out(o.last_hidden_state)]
        for i in range(L):  # 3. cross-attention states pass through, so both decoders give the same outputs
            sa = o.past_key_values.self_attention_cache.layers[i]
            outs += [sa.keys, sa.values, past[4 * i + 2], past[4 * i + 3]]
        return tuple(outs)

names_past = [f"past_key_values.{i}.{p}.{kv}" for i in range(L) for p in ("decoder", "encoder") for kv in ("key", "value")]
names_present = [n.replace("past_key_values", "present") for n in names_past]
B, S, E, P = Dim("batch_size", max=64), Dim("decoder_sequence_length", max=4096), Dim("encoder_frames", max=8192), Dim("past_decoder_sequence_length", max=4096)

# 4. Examples of batch 2 and length 2+: torch.export specialises any dimension it sees as 1.
x = torch.randn(2, 16000 * 4) * 0.05
torch.onnx.export(Encoder(), (x,), str(out / "onnx/encoder_model.onnx"), dynamo=True, external_data=False, opset_version=OPSET,
                  input_names=["input_values"], output_names=["last_hidden_state"],
                  dynamic_shapes=({0: B, 1: 80 * Dim("frames", min=2, max=16000 * 60 // 80)},))
with torch.no_grad():
    h = Encoder()(x)
ids = torch.tensor([[cfg.decoder_start_token_id, 5, 7]] * 2)
torch.onnx.export(DecoderFirst(), (ids, h), str(out / "onnx/decoder_model.onnx"), dynamo=True, external_data=False, opset_version=OPSET,
                  input_names=["input_ids", "encoder_hidden_states"], output_names=["logits", *names_present],
                  dynamic_shapes=({0: B, 1: S}, {0: B, 1: E}))
with torch.no_grad():
    past = [t.clone() for t in DecoderFirst()(ids, h)[1:]]
torch.onnx.export(DecoderWithPast(), (torch.tensor([[9, 11]] * 2), h, past), str(out / "onnx/decoder_with_past_model.onnx"), dynamo=True,
                  external_data=False, opset_version=OPSET, input_names=["input_ids", "encoder_hidden_states", *names_past],
                  output_names=["logits", *names_present],
                  dynamic_shapes=({0: B, 1: S}, {0: B, 1: E}, [({0: B, 2: P} if ".decoder." in n else {0: B, 2: E}) for n in names_past]))

# 5. q8 on the decoders only: quantising the encoder (its audio frontend) cost 3.6 WER points on the Dev's reading; per-channel, 18.
from onnxruntime.quantization import quantize_dynamic, QuantType
for n in ("decoder_model", "decoder_with_past_model"):
    quantize_dynamic(str(out / f"onnx/{n}.onnx"), str(out / f"onnx/{n}_quantized.onnx"), op_types_to_quantize=["MatMul", "Gather"], weight_type=QuantType.QInt8)
    (out / f"onnx/{n}.onnx").unlink()

for f in ("config.json", "generation_config.json", "preprocessor_config.json", "processor_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"):
    shutil.copy(hf_hub_download(REPO, f, revision=REVISION), out / f)

# 6. Parity: greedy decoding with onnxruntime must give PyTorch's tokens (with the processor's attention mask).
if "--check" in sys.argv:
    import av, onnxruntime as ort
    audio = sys.argv[sys.argv.index("--check") + 1]
    c = av.open(audio); rs = av.AudioResampler(format="flt", layout="mono", rate=16000)
    pcm = np.concatenate([r.to_ndarray().reshape(-1) for q in c.decode(c.streams.audio[0]) for r in rs.resample(q)] + [r.to_ndarray().reshape(-1) for r in rs.resample(None)]).astype(np.float32)
    seg = pcm[:16000 * 20]; seg = np.pad(seg, (0, (-len(seg)) % 80))[None, :]
    DynamicLayer.update = _update
    with torch.no_grad():
        ref = m.generate(input_values=torch.from_numpy(seg.copy()), attention_mask=torch.ones(seg.shape, dtype=torch.long), max_new_tokens=170)[0].tolist()
    enc = ort.InferenceSession(str(out / "onnx/encoder_model.onnx"))
    d1 = ort.InferenceSession(str(out / "onnx/decoder_model_quantized.onnx"))
    d2 = ort.InferenceSession(str(out / "onnx/decoder_with_past_model_quantized.onnx"))
    hh = enc.run(None, {"input_values": seg})[0]
    toks = [cfg.decoder_start_token_id]
    r = d1.run(None, {"input_ids": np.array([toks], dtype=np.int64), "encoder_hidden_states": hh})
    for _ in range(170):
        nxt = int(r[0][0, -1].argmax()); toks.append(nxt)
        if nxt == cfg.eos_token_id: break
        feed = {"input_ids": np.array([[nxt]], dtype=np.int64), "encoder_hidden_states": hh}
        feed.update(dict(zip(names_past, r[1:])))
        r = d2.run(None, feed)
    print(json.dumps({"pytorch_tokens": len(ref), "onnx_tokens": len(toks), "identical": ref == toks}))

with open(out / "SHA256SUMS", "w", encoding="utf-8", newline="\n") as s:
    for p in sorted(q for q in out.rglob("*") if q.is_file() and q.name != "SHA256SUMS"):
        s.write(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(out).as_posix()}\n")
print("done", out)
