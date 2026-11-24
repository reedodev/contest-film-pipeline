# contest-film-pipeline

[![test](https://github.com/reedodev/contest-film-pipeline/actions/workflows/test.yml/badge.svg)](https://github.com/reedodev/contest-film-pipeline/actions/workflows/test.yml)
[한국어 README](README.ko.md)

An agent skill (Claude Code / Aside style `SKILL.md`) for entering **AI film and AI image contests** — from reading the rules to pressing submit — built from the mistakes of real entries.

In November 2026 I made 9 AI short films and 4 AI images for contests. Judges never saw most of the problems, because a person caught them first: a gray previz cube left in the final film, a pot floating in the air, a 30-second film shown as **0:31** on YouTube, a stray 0.3-second frame at an edit point, "I don't get what this video is about", "there should be more dialogue". Every one of those became a row in a lessons table and a box in a checklist, and three of them became scripts.

## What is inside

```
skills/contest-film-pipeline/
  SKILL.md                     11-step procedure (rules → script → sheets → previz → prompts →
                               generation → post → review → submit → publish → update lessons)
  references/lessons.md        72 lessons: symptom → cause (confirmed / unconfirmed) → fix → rule
  references/checklists.md     checklists for planning, before/after generation, before submit,
                               submission forms, publishing, and wrap-up
  scripts/duration-check.mjs   every stream (container, video, audio, last packet end) under the limit
  scripts/short-cut-check.mjs  finds shots shorter than 0.5 s (stray frames at edit points) with ffmpeg scdet
  scripts/scene-sheet.mjs      1-second scene sheet (time-stamped tiles) + a review table to fill in
```

The documents are written in Korean (the contests were Korean). The scripts and their output are in English.

## Quick start

Requirements: Node.js 18+, ffmpeg and ffprobe on PATH (or set `FFMPEG` / `FFPROBE`).

```bash
git clone https://github.com/reedodev/contest-film-pipeline
cd contest-film-pipeline/skills/contest-film-pipeline

node scripts/duration-check.mjs final.mp4 --max 30          # 30 s rule -> all streams <= 29.95 s
node scripts/short-cut-check.mjs final.mp4 --min 0.5       # stray shots shorter than 0.5 s
node scripts/scene-sheet.mjs final.mp4 --out qa/scenes      # sheet_01.jpg ... + scenes.md
```

Exit codes: `0` pass, `1` fail, `2` usage or ffmpeg error — easy to put in a pipeline.

To use it as a skill, copy `skills/contest-film-pipeline` into your agent's skills folder (for Claude Code: `~/.claude/skills/`), or add this repo as a plugin marketplace.

## The ideas that matter most

- **Dialogue first, explain the opening.** In the first 3–5 seconds the viewer must know who is looking for what, and why. Around 6–9 lines of dialogue per 30 seconds for dialogue-driven pieces. Every action needs a reason said out loud.
- **Never feed the previz video to the video model.** It copies the gray shapes. Write the camera numbers as text instead.
- **Reference images leak props.** A thermos on a location sheet appeared on every counter even with a "no box" prompt. Crop it out of the reference.
- **3-second prompt rows** (shot size, camera, lens, move, which hand holds what, light, dialogue, sound) plus a sentence linking each row to the next.
- **One unlimited-generation slot per account.** Overlapping jobs fail and invite paid usage. Keep a slot ledger.
- **First-time-viewer review.** Give a separate reviewer (a fresh AI session that never saw the script) only the 1-second scene sheet and ask what the film is about and everything that looks wrong. Pass only with zero must-fix items. Then a human says "submit".
- **Submission forms bite:** 100-character fields, leading zeros dropped from phone numbers, answers that cannot be edited, and contest rules that forbid public posting before results.

## Tests

```bash
node tests/run.mjs
```

Lints `SKILL.md`, checks links, scans every file for private data patterns, then runs unit tests and (when ffmpeg is present) video tests on generated clips. CI runs the same on GitHub Actions.

## Credits and inspiration

- All lessons come from my own contest work logs.
- Asset-row format and location-asset tips: a post on the arca.live AI realism board, "장소나 공간 에셋으로 연출하는 팁 — Seedance" (https://arca.live/b/aireal/189257143). Idea only, no text copied.
- Three-step character sheet (face lock → full body → sheet): @pounddz on X, "How to Make Better AI Ads Than 99% of People" (https://x.com/pounddz/status/2124609892572864858). Idea only.
- Shot detection uses ffmpeg's `scdet` filter (ffmpeg not bundled).

## License

MIT
