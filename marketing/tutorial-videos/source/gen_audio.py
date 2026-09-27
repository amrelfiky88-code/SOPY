import json, os, sys, sherpa_onnx, soundfile as sf, numpy as np
from scripts import VIDEOS, vo_en
T=os.environ.get('SOPY_TTS','tts')+'/'
def mk(kind):
    if kind=='ar':
        d=T+'vits-piper-ar_JO-kareem-medium'
        m=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{d}/ar_JO-kareem-medium.onnx',tokens=f'{d}/tokens.txt',data_dir=f'{d}/espeak-ng-data'),num_threads=8)
    else:
        d=T+'kokoro-en-v0_19'
        m=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f'{d}/model.onnx',voices=f'{d}/voices.bin',tokens=f'{d}/tokens.txt',data_dir=f'{d}/espeak-ng-data'),num_threads=8)
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=m))
lang=sys.argv[1]
tts=mk(lang)
os.makedirs('audio',exist_ok=True)
timing={}
for v in VIDEOS:
    segs=[]
    for i,(tpl,p,en,ar) in enumerate(v['scenes']):
        text = vo_en(en) if lang=='en' else ar
        a = tts.generate(text, sid=(6 if lang=='en' else 0), speed=(1.0 if lang=='en' else 0.9))
        s=np.array(a.samples,dtype=np.float32); sr=a.sample_rate
        fn=f"audio/{v['id']}_{lang}_{i}.wav"; sf.write(fn,s,sr)
        segs.append(round(len(s)/sr,3))
    timing[v['id']]=segs
    print(v['id'],lang,segs,sum(segs))
json.dump(timing,open(f'timing_{lang}.json','w'),indent=1)
