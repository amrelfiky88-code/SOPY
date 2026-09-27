import sys, sherpa_onnx, soundfile as sf, numpy as np, glob
import os
d=os.environ.get('SOPY_TTS','tts')+'/sherpa-onnx-whisper-small/'
def rec(lang):
    return sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+'small-encoder.int8.onnx',decoder=d+'small-decoder.int8.onnx',tokens=d+'small-tokens.txt',language=lang,task='transcribe',num_threads=8)
R={'en':rec('en'),'ar':rec('ar')}
for f in sys.argv[1:]:
    lang='ar' if '_ar_' in f else 'en'
    a,sr=sf.read(f,dtype='float32')
    if sr!=16000:
        import scipy.signal as ss; a=ss.resample_poly(a,16000,sr).astype(np.float32)
    s=R[lang].create_stream(); s.accept_waveform(16000,a); R[lang].decode_stream(s)
    print(f.split('/')[-1], '|', s.result.text.strip())
