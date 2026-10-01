# Notes for Claude Code: marketing/tutorial-videos

- This folder is marketing material for the SOPY app, not app code. Don't import it from `server/` or `web/`.
- Video content must stay true to the app. If a screen, form code, threshold (≥95% Green, 85–94% Amber, below or any critical fail = Red), pricing rule ($10→$7 per branch at 10, $10→$5 per user at 20) or library count (517 checkpoints: 217 Internal QC + 166 SOP + 114 convenience store + 10 HACCP + 6 ISO 22000 + 4 local health code; count with `SELECT standard, count(*) FROM checklist_items WHERE tenant_id IS NULL GROUP BY 1` on a fresh database) changes in the app, update `source/build.py` screens and the scripts to match.
- Audience: restaurant and café owners in Egypt. Arabic social posts use Egyptian dialect (`source/scripts_eg.py`); English is for LinkedIn/Shorts.
- Every video stays under 60 seconds, vertical 1080×1920, with burned-in captions (most viewers watch muted).
- Don't commit rendered MP4s; they live in Higgsfield / the Claude session. Commit scripts, sources and covers only.
- See `README.md` for the pipeline and `posting-kit.md` for captions and schedule.
