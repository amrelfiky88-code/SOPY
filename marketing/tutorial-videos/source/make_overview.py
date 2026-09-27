import json, subprocess, sys
import numpy as np, soundfile as sf
import scripts
from overview import OVERVIEW
scripts.VIDEOS[:] = [OVERVIEW]
import gen_audio_lib as G
import build as B
meta = json.load(open('meta.json'))
for lang in ('en', 'ar'):
    durs = G.gen(OVERVIEW, lang)
    fn, total, starts = B.build(OVERVIEW, lang, durs)
    meta[f"{OVERVIEW['id']}_{lang}"] = {'html': fn, 'total': total, 'audio_starts': starts, 'n': len(OVERVIEW['scenes'])}
    print(lang, round(total, 2))
json.dump(meta, open('meta.json', 'w'), indent=1)
