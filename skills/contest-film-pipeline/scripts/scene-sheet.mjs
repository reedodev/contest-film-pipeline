#!/usr/bin/env node
// Makes the "1-second scene sheet": one frame per second, tiled with timestamps,
// plus a review table (scenes.md) with one row per second to fill in by eye.
// Usage: node scene-sheet.mjs <video> --out <dir> [--cols 8] [--rows 2] [--width 360] [--font <ttf>] [--step 1]
// Exit 0 = sheets written, 2 = error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG, run, probe, parseArgs } from './lib.mjs';

export function sheetPlan(duration, { cols = 8, rows = 2, step = 1 } = {}) {
  const frames = Math.max(1, Math.ceil(duration / step));
  const per = cols * rows;
  const sheets = [];
  for (let i = 0; i < frames; i += per) {
    sheets.push({ index: sheets.length + 1, from: i * step, to: Math.min(frames - 1, i + per - 1) * step });
  }
  return { frames, per, sheets };
}

export function reviewTable(duration, step = 1) {
  const lines = ['| 초 | 보여야 할 것 (대본·콘티) | 실제로 보이는 것 | 이상한 점 (얼굴·옷·손·소품·빛·글자·자막) |', '|---|---|---|---|'];
  for (let t = 0; t < duration; t += step) lines.push(`| ${t.toFixed(step < 1 ? 1 : 0)} |  |  |  |`);
  return lines.join('\n') + '\n';
}

function escFont(p) { return p.replace(/\\/g, '/').replace(/:/g, '\\:'); }

function main() {
  const a = parseArgs(process.argv.slice(2));
  const file = a._[0];
  if (!file || !a.out) { console.error('usage: node scene-sheet.mjs <video> --out <dir> [--cols 8] [--rows 2] [--width 360] [--font file.ttf] [--step 1]'); process.exit(2); }
  const cols = +(a.cols || 8), rows = +(a.rows || 2), width = +(a.width || 360), step = +(a.step || 1);
  let duration;
  try { duration = +probe(file).format.duration; } catch (e) { console.error(e.message); process.exit(2); }
  fs.mkdirSync(a.out, { recursive: true });
  const fontPart = a.font ? `:fontfile='${escFont(a.font)}'` : '';
  const label = `drawtext=text='%{pts\\:hms}'${fontPart}:x=6:y=6:fontsize=${Math.round(width / 16)}:fontcolor=white:box=1:boxcolor=black@0.6`;
  const base = `fps=1/${step},scale=${width}:-2`;
  const tile = `tile=${cols}x${rows}:padding=4:color=gray`;
  const outPat = path.join(a.out, 'sheet_%02d.jpg');
  let r = run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `${base},${label},${tile}`, '-q:v', '3', outPat]);
  let labelled = true;
  if (r.status !== 0) {
    // drawtext needs a font; retry without labels and rely on scenes.md for times
    labelled = false;
    r = run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `${base},${tile}`, '-q:v', '3', outPat]);
    if (r.status !== 0) { console.error('ffmpeg failed:\n' + r.stderr.slice(-2000)); process.exit(2); }
  }
  const plan = sheetPlan(duration, { cols, rows, step });
  const index = plan.sheets.map((s) => `- sheet_${String(s.index).padStart(2, '0')}.jpg: ${s.from}~${s.to} s (left to right, top to bottom)`).join('\n');
  fs.writeFileSync(path.join(a.out, 'scenes.md'),
    `# 1초 장면표: ${path.basename(file)}\n\n길이 ${duration.toFixed(3)} s, ${step} s 간격 ${plan.frames}장, 한 장에 ${plan.per}칸${labelled ? '' : ' (시각 글자 없음: --font 로 글꼴 지정)'}\n\n${index}\n\n${reviewTable(duration, step)}`);
  const written = fs.readdirSync(a.out).filter((f) => /^sheet_\d+\.jpg$/.test(f)).length;
  console.log(`wrote ${written} sheet(s) + scenes.md to ${a.out}${labelled ? '' : ' (no time labels)'}`);
  console.log('Open EVERY sheet yourself, then fill scenes.md row by row. Check suspicious seconds at full size.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
