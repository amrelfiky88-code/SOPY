import numpy as np, soundfile as sf, sherpa_onnx
from scripts import vo_en
import os
T = os.environ.get('SOPY_TTS', 'tts') + '/'
_cache = {}
def tts(kind):
    if kind in _cache: return _cache[kind]
    if kind == 'ar':
        d = T + 'vits-piper-ar_JO-kareem-medium'
        m = sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{d}/ar_JO-kareem-medium.onnx', tokens=f'{d}/tokens.txt', data_dir=f'{d}/espeak-ng-data'), num_threads=2)
    else:
        d = T + 'kokoro-en-v0_19'
        m = sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f'{d}/model.onnx', voices=f'{d}/voices.bin', tokens=f'{d}/tokens.txt', data_dir=f'{d}/espeak-ng-data'), num_threads=2)
    _cache[kind] = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=m)); return _cache[kind]
def gen(v, lang):
    t = tts(lang); out = []
    for i, (tpl, p, en, ar) in enumerate(v['scenes']):
        a = t.generate(vo_en(en) if lang == 'en' else ar, sid=(6 if lang == 'en' else 0), speed=(1.0 if lang == 'en' else 0.9))
        s = np.array(a.samples, dtype=np.float32)
        sf.write(f"audio/{v['id']}_{lang}_{i}.wav", s, a.sample_rate); out.append(round(len(s) / a.sample_rate, 3))
    return out
