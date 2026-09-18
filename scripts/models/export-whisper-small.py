# SPDX-License-Identifier: AGPL-3.0-or-later
"""Rebuild whisper-small-onnx from openai/whisper-small (Apache-2.0) — ADR-0201 erratum, ADR-0203, issue #192.

WHY IT IS EXPORTED HERE. The ready-made export the lab measured, `onnx-community/whisper-small`, states no licence of its own
(read 2026-09-18: only `base_model: openai/whisper-small`), and ADR-0203's erratum allows a mirror only «se for legal». The
weights themselves are Apache-2.0, so the project exports them and the mirror carries a licence it can point at.

What it writes into <out>/:
  onnx/encoder_model_quantized.onnx           q8   — the 30 s log-mel encoder
  onnx/decoder_model_quantized.onnx           q8   — first decoding step (no past)
  onnx/decoder_with_past_model_quantized.onnx q8   — later steps (self-attention past in, cross-attention states passed through)
  the upstream tokenizer and configuration files, and SHA256SUMS

⚠️ BOTH HALVES ARE q8 HERE, unlike the Spanish Moonshine, where quantising the encoder cost 3.6 WER points. The 7.7 % WER the
Dev's Portuguese reading measured (2026-09-14, issue #185) was on a q8 encoder AND a q8 decoder, so this keeps the shape that
was measured. `--check` re-measures parity against PyTorch before anything is mirrored.

Usage (Python 3.12, the same venv as the Moonshine export):
  uv venv --python 3.12 .venv
  uv pip install --python .venv --index-url https://download.pytorch.org/whl/cpu torch==2.14.0
  uv pip install --python .venv "transformers==5.17.0" onnx onnxscript onnxruntime av numpy
  .venv/Scripts/python scripts/models/export-whisper-small.py <out> [--check audio.m4a]
"""
import sys, json, shutil, hashlib, pathlib
import numpy as np, torch
from torch.export import Dim
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from transformers.cache_utils import DynamicCache, EncoderDecoderCache
from huggingface_hub import hf_hub_download

REPO, REVISION = "openai/whisper-small", "main"
OPSET = 18
out = pathlib.Path(sys.argv[1]); (out / "onnx").mkdir(parents=True, exist_ok=True)

m = WhisperForConditionalGeneration.from_pretrained(REPO, revision=REVISION, attn_implementation="eager").eval()
cfg = m.config
L, MELS, FRAMES = cfg.decoder_layers, cfg.num_mel_bins, cfg.max_source_positions * 2  # 3000 frames = the fixed 30 s window

class Encoder(torch.nn.Module):
    def __init__(s): super().__init__(); s.enc = m.model.encoder
    def forward(s, input_features): return s.enc(input_features).last_hidden_state

def presents(cache, i):
    sa, ca = cache.self_attention_cache.layers[i], cache.cross_attention_cache.layers[i]
    return [sa.keys, sa.values, ca.keys, ca.values]

class DecoderFirst(torch.nn.Module):
    def __init__(s): super().__init__(); s.m = m
    def forward(s, input_ids, encoder_hidden_states):
        o = s.m.model.decoder(input_ids=input_ids, encoder_hidden_states=encoder_hidden_states,
                              past_key_values=EncoderDecoderCache(DynamicCache(), DynamicCache()), use_cache=True)
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
        for i in range(L):  # the cross-attention states pass through, so both decoders answer the same way
            sa = o.past_key_values.self_attention_cache.layers[i]
            outs += [sa.keys, sa.values, past[4 * i + 2], past[4 * i + 3]]
        return tuple(outs)

names_past = [f"past_key_values.{i}.{p}.{kv}" for i in range(L) for p in ("decoder", "encoder") for kv in ("key", "value")]
names_present = [n.replace("past_key_values", "present") for n in names_past]
# batch 2 and length 2+ in every example: torch.export specialises any dimension it sees as 1
B, S, P = Dim("batch_size", max=64), Dim("decoder_sequence_length", max=448), Dim("past_decoder_sequence_length", max=448)

x = torch.randn(2, MELS, FRAMES) * 0.1
torch.onnx.export(Encoder(), (x,), str(out / "onnx/encoder_model.onnx"), dynamo=True, external_data=False, opset_version=OPSET,
                  input_names=["input_features"], output_names=["last_hidden_state"], dynamic_shapes=({0: B},))
with torch.no_grad():
    h = Encoder()(x)
E = Dim("encoder_sequence_length", max=cfg.max_source_positions)
ids = torch.tensor([[cfg.decoder_start_token_id, 50285, 50360]] * 2)
torch.onnx.export(DecoderFirst(), (ids, h), str(out / "onnx/decoder_model.onnx"), dynamo=True, external_data=False, opset_version=OPSET,
                  input_names=["input_ids", "encoder_hidden_states"], output_names=["logits", *names_present],
                  dynamic_shapes=({0: B, 1: S}, {0: B, 1: E}))
with torch.no_grad():
    past = [t.clone() for t in DecoderFirst()(ids, h)[1:]]
torch.onnx.export(DecoderWithPast(), (torch.tensor([[50364, 1207]] * 2), h, past), str(out / "onnx/decoder_with_past_model.onnx"),
                  dynamo=True, external_data=False, opset_version=OPSET,
                  input_names=["input_ids", "encoder_hidden_states", *names_past], output_names=["logits", *names_present],
                  dynamic_shapes=({0: B, 1: S}, {0: B, 1: E}, [({0: B, 2: P} if ".decoder." in n else {0: B, 2: E}) for n in names_past]))

from onnxruntime.quantization import quantize_dynamic, QuantType
for n in ("encoder_model", "decoder_model", "decoder_with_past_model"):
    quantize_dynamic(str(out / f"onnx/{n}.onnx"), str(out / f"onnx/{n}_quantized.onnx"),
                     op_types_to_quantize=["MatMul", "Gather"], weight_type=QuantType.QInt8)
    (out / f"onnx/{n}.onnx").unlink()

for f in ("config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json",
          "special_tokens_map.json", "added_tokens.json", "merges.txt", "normalizer.json", "vocab.json"):
    shutil.copy(hf_hub_download(REPO, f, revision=REVISION), out / f)

# Parity: greedy decoding with onnxruntime against PyTorch's own greedy decoding, in Portuguese.
# ⚠️ THE TOKENS ARE NOT THE YARDSTICK, THE TEXT IS. Measured on the Dev's reading (2026-09-18): the fp32 export gives PyTorch's
# text exactly, while q8 parts from it by two words in fifty-two — so a token-by-token comparison of the quantized graphs
# reports a difference that is the quantization, not the export. `identical_text` is what must hold for fp32.
if "--check" in sys.argv:
    import av, onnxruntime as ort
    audio = sys.argv[sys.argv.index("--check") + 1]
    gen = json.load(open(out / "generation_config.json", encoding="utf-8"))
    proc = WhisperProcessor.from_pretrained(REPO, revision=REVISION)
    c = av.open(audio); rs = av.AudioResampler(format="flt", layout="mono", rate=16000)
    pcm = np.concatenate([r.to_ndarray().reshape(-1) for q in c.decode(c.streams.audio[0]) for r in rs.resample(q)]
                         + [r.to_ndarray().reshape(-1) for r in rs.resample(None)]).astype(np.float32)
    feats = proc(pcm[:16000 * 30], sampling_rate=16000, return_tensors="pt").input_features
    prompt = proc.get_decoder_prompt_ids(language="portuguese", task="transcribe")
    start = [cfg.decoder_start_token_id] + [t for _, t in prompt]
    with torch.no_grad():
        ref = m.generate(input_features=feats, do_sample=False, num_beams=1, language="portuguese", task="transcribe",
                         max_new_tokens=220)[0].tolist()
    enc = ort.InferenceSession(str(out / "onnx/encoder_model_quantized.onnx"))
    d1 = ort.InferenceSession(str(out / "onnx/decoder_model_quantized.onnx"))
    d2 = ort.InferenceSession(str(out / "onnx/decoder_with_past_model_quantized.onnx"))
    hh = enc.run(None, {"input_features": feats.numpy()})[0]
    toks = list(start)
    r = d1.run(None, {"input_ids": np.array([toks], dtype=np.int64), "encoder_hidden_states": hh})
    for passo in range(220):
        # the two suppression lists `generate` applies: 88 tokens always, and a space and the end mark on the first step
        logits = r[0][0, -1].astype(np.float64).copy()
        logits[gen["suppress_tokens"]] = -np.inf
        if passo == 0: logits[gen["begin_suppress_tokens"]] = -np.inf
        nxt = int(logits.argmax()); toks.append(nxt)
        if nxt == cfg.eos_token_id: break
        feed = {"input_ids": np.array([[nxt]], dtype=np.int64), "encoder_hidden_states": hh}
        feed.update(dict(zip(names_past, r[1:])))
        r = d2.run(None, feed)
    # the quantized graphs may part from PyTorch on a token; the text is what the child's reading is judged by
    a = proc.batch_decode([ref], skip_special_tokens=True)[0].strip()
    b = proc.batch_decode([toks], skip_special_tokens=True)[0].strip()
    print(json.dumps({"pytorch_tokens": len(ref), "onnx_tokens": len(toks), "identical_tokens": ref == toks,
                      "identical_text": a == b}, ensure_ascii=False))

with open(out / "SHA256SUMS", "w", encoding="utf-8", newline="\n") as s:
    for p in sorted(q for q in out.rglob("*") if q.is_file() and q.name != "SHA256SUMS"):
        s.write(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(out).as_posix()}\n")
print("done", out)
