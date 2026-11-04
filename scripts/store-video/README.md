# Launch film

`film.html` is the Shorts Flow launch film: 57.5 s at 96 BPM (bar 2.5 s), in the Tideline brand, for the YouTube video linked from both store listings. It's a deterministic motion design driven by `render(t)`, built from the same captures of the real extension as the store art.

1. `bun run build:chrome`, then `bun run store-art` (or `--skip-capture` if `.store-art/raw/` is current) for the captures.
2. `bun scripts/store-video/render.mjs` renders 3840×2160 at 60 fps (1920×1080 CSS px at DPR 2) into `.store-art/film/picture.mov`, a 10-bit ProRes mezzanine. `--stills 1,7.5,12` renders review stills; `--fps 30 --scale 1` makes a quick draft; `--workers N` sets the number of parallel browsers.
3. The score, sound design, mix, loudness master and 4K HEVC delivery encode are done in the SouVi Engine project `shorts-flow` (its `BRIEF.md` holds the cue sheet the picture is timed to).

The scene table and cue times in `film.html` and the SouVi `BRIEF.md` must stay in step: every cut, Advance and reveal lands on a beat of the 96 BPM grid.
