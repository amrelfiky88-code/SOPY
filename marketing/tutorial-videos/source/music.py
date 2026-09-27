"""Original, royalty-free background bed synthesized from scratch (no samples):
soft pad chords + gentle plucked arpeggio + light kick/shaker, 92 BPM."""
import numpy as np, soundfile as sf, sys
SR = 48000
BPM = 92; beat = 60 / BPM
def midi(n): return 440 * 2 ** ((n - 69) / 12)
# Cmaj9 - Am7 - Fmaj7 - G6sus (warm, positive, unobtrusive)
CHORDS = [[48, 55, 59, 62, 64], [45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 59, 62]]
ARP = [[72, 67, 71, 74], [69, 64, 67, 72], [69, 65, 67, 72], [71, 67, 74, 69]]

def env(n, a, r):
    e = np.ones(n); ai = int(a * SR); ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e

def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR; s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(2 * np.pi * 2 * ff * t)
    return s / len(freqs) * env(len(t), 0.6, 0.8) * 0.16

def pluck(f, dur=0.9):
    t = np.arange(int(dur * SR)) / SR
    s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 3 * f * t))
    return s * np.exp(-t * 5.5) * env(len(t), 0.004, 0.05) * 0.11

def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 110 * np.exp(-t * 18) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.22

rng = np.random.default_rng(7)
def shaker():
    n = int(0.08 * SR); x = rng.standard_normal(n)
    x = np.diff(x, prepend=0)  # crude high-pass
    return x * np.exp(-np.arange(n) / SR * 60) * 0.018

def build(total):
    out = np.zeros(int((total + 2) * SR))
    bar = 4 * beat; t0 = 0.0; i = 0
    def add(sig, at):
        s = int(at * SR); e = min(len(out), s + len(sig))
        if e > s: out[s:e] += sig[:e - s]
    while t0 < total + 1:
        c = i % 4
        add(pad([midi(n) for n in CHORDS[c]], bar + 0.8), t0)
        add(0.5 * np.sin(2 * np.pi * midi(CHORDS[c][0] - 12) * np.arange(int(bar * SR)) / SR) * env(int(bar * SR), 0.05, 0.3) * 0.18, t0)
        for k in range(8):
            add(pluck(midi(ARP[c][k % 4])), t0 + k * beat / 2)
            add(shaker(), t0 + k * beat / 2 + beat / 4)
        if i >= 1:
            for k in (0, 2): add(kick(), t0 + k * beat)
        t0 += bar; i += 1
    # simple one-pole low-pass for warmth
    from scipy.signal import lfilter
    a = 0.35; y = lfilter([a], [1, -(1 - a)], out)
    y = y[:int(total * SR)]
    fade = env(len(y), 1.0, 2.0); y *= fade
    return (y / (np.abs(y).max() + 1e-9) * 0.6).astype(np.float32)

if __name__ == '__main__':
    total = float(sys.argv[1]); sf.write(sys.argv[2], build(total), SR)
