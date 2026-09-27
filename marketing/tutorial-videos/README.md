# SOPY tutorial videos

Short social videos (9:16 and 4:5, all under 60 s) explaining SOPY to restaurant owners, one per app area. Content is taken from this repo: screens, form codes (KDR-001, BDR-001, QC-D-001), Green/Amber/Red scoring, camera-only evidence, pricing taper and the checklist library.

| # | Topic | Screens used |
| --- | --- | --- |
| 00 | SOPY overview (pinned post / ad) | dashboard, temp alert, critical fail, photo stamp, KPI |
| 01 | What is SOPY? | paper vs app, dashboard, compliance rings |
| 02 | Set up in minutes | stores, roles, invite link, pricing |
| 03 | Kitchen & bar daily reports | temperature log + alert, opening checklist, waste log, bar checks |
| 04 | QC visits & live scoring | QC sections, OK/Issue scoring, thresholds, critical fail |
| 05 | Photo evidence | live camera, time + GPS stamp, no gallery uploads |
| 06 | Manager's view | KPI by branch, checklist builder, critical filter, reports |

Each exists in three languages/voices: **EN** (English), **AR** (standard Arabic, local TTS) and **AR_EG** (Egyptian Arabic, ElevenLabs "Marcus" via Higgsfield, recommended for Egypt).

## What's in this folder

- `scripts/voiceover-scripts.md` — every scene's EN, AR and Egyptian AR voiceover line.
- `posting-kit.md` — posting schedule, captions (EN + Egyptian AR) and hashtags.
- `covers/` — thumbnail (first headline frame) for each EN/AR video.
- `source/` — the generator (see below).

The rendered MP4s are not committed (about 125 MB). Egyptian-Arabic masters are in the Higgsfield media library, project "SOPY Arabic voiceovers"; the EN and standard-AR files were delivered in the Claude session.

## How the generator works

1. `scripts.py` (EN + standard AR), `overview.py` (video 00) and `scripts_eg.py` (Egyptian AR lines) define each video as scenes: a template (`hook`, `binder`, `phone:<screen>`, `bullets`, `thresholds`, `cta`) plus the voiceover line.
2. `gen_audio.py` / `gen_audio_lib.py` make voiceover clips with sherpa-onnx (Kokoro EN `am_michael`, Piper `ar_JO-kareem`); `timing_*.json` holds clip lengths.
3. `build.py` turns each video into one HTML page (1080×1920) where all motion is CSS animation with absolute delays; `window.seek(t)` freezes any frame. Scene length = voice length + 0.35 s lead + 0.5 s gap (min 3 s). Colors/fonts match `web/src/styles/theme.css` (IBM Plex Sans / Plex Sans Arabic, Source Serif 4, IBM Plex Mono via @fontsource).
4. `render.py` steps through frames with Playwright and pipes JPEGs to ffmpeg (30 fps, H.264).
5. `mix.py` places the clips on a timeline and muxes; `remix.py` adds `music.py` (original synthesized bed, ducked under the voice with sidechaincompress, loudnorm −14 LUFS); 4:5 feed cuts are `crop=1080:1680:0:40,scale=868:1350,pad=1080:1350:106:0`.
6. `asr.py` transcribes outputs with Whisper-small to check pronunciation.

### Run it

```bash
pip install sherpa-onnx soundfile numpy scipy playwright
npm pack @fontsource/ibm-plex-sans @fontsource/ibm-plex-sans-arabic @fontsource/ibm-plex-mono @fontsource/source-serif-4
# unpack each .tgz into fonts/<package-name-version>/ (build.py expects e.g. fonts/fontsource-ibm-plex-sans-5.3.0/files/...)
# TTS models from github.com/k2-fsa/sherpa-onnx releases (tts-models): vits-piper-ar_JO-kareem-medium, kokoro-en-v0_19 -> tts/
export SOPY_FONTS=fonts SOPY_TTS=tts SOPY_OUT=output
python3 gen_audio.py en && python3 gen_audio.py ar
python3 build.py && python3 render.py video 01-what-is-sopy_en
python3 mix.py 01-what-is-sopy_en && python3 remix.py
```

For Egyptian AR, generate each line in `scripts_eg.py` with Higgsfield `text2speech_v2` (variant `elevenlabs`, voice id `6f98d3dd-324f-4845-8c28-c1d1647a06cd`), measure durations, and pass them to `build.build(video, 'ar', durations)` with the Egyptian line as the scene's Arabic text (the caption uses the same text; "سوبي" is shown as SOPY).

## Editing tips

- Change a line → regenerate its clip, rebuild, re-render that one video. Scenes stretch to fit the voice.
- New scene → add a template function in `build.py` (`scr_<name>` for a phone screen) and reference it as `phone:<name>`.
- Keep each video under 60 s; Arabic runs about 1.3–1.5× longer than English.
