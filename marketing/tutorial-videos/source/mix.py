import json, sys, subprocess, os
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
meta = json.load(open('meta.json'))
SR = 48000
os.makedirs(os.environ.get('SOPY_OUT', 'output'), exist_ok=True)
for key in (sys.argv[1:] or meta.keys()):
    m = meta[key]; vid, lang = key.rsplit('_', 1)
    track = np.zeros(int((m['total'] + 0.5) * SR), dtype=np.float32)
    for i, st in enumerate(m['audio_starts']):
        a, sr = sf.read(f'audio/{vid}_{lang}_{i}.wav', dtype='float32')
        if a.ndim > 1: a = a.mean(1)
        a = resample_poly(a, SR, sr).astype(np.float32)
        a = a / (np.abs(a).max() + 1e-6) * 0.89
        s = int(st * SR); track[s:s + len(a)] += a[:len(track) - s]
    sf.write(f'audio/{key}_mix.wav', track, SR)
    out = f'{os.environ.get("SOPY_OUT", "output")}/SOPY_{vid}_{lang.upper()}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'silent/{key}.mp4', '-i', f'audio/{key}_mix.wav',
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', out], check=True)
    print('muxed', out)
