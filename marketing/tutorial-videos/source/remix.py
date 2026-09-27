import json, subprocess, os, shutil
meta = json.load(open('meta.json'))
OUT = os.environ.get('SOPY_OUT', 'output')
os.makedirs(f'{OUT}/voice_only', exist_ok=True)
for key, m in meta.items():
    vid, lang = key.rsplit('_', 1)
    name = f'SOPY_{vid}_{lang.upper()}.mp4'
    vo = f'{OUT}/voice_only/{name}'
    if not os.path.exists(vo): shutil.copy(f'{OUT}/{name}', vo)
    subprocess.run(['python3', 'music.py', str(m['total']), f'audio/{key}_music.wav'], check=True)
    # voice + music, music ducked under the voice (sidechain), then loudness-normalized for social
    fc = ('[2:a]volume=0.22[mus];[1:a]asplit=2[v1][v2];'
          '[mus][v2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];'
          '[v1][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'silent/{key}.mp4', '-i', f'audio/{key}_mix.wav',
                    '-i', f'audio/{key}_music.wav', '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
                    f'{OUT}/{name}'], check=True)
    print('remixed', name)
