#!/usr/bin/env node
// Finds very short shots (default < 0.5 s) — usually a stray frame from the neighbouring
// clip that slipped in at an edit point. Uses ffmpeg's scdet scene-change filter.
// Usage: node short-cut-check.mjs <video> [--min 0.5] [--threshold 10] [--ignore-edges] [--json]
// Exit 0 = no short shot, 1 = short shot found, 2 = usage / ffmpeg error.
import { FFMPEG, run, probe, parseArgs } from './lib.mjs';
import { fileURLToPath } from 'node:url';

// Parse scdet log lines: "lavfi.scd.score: 37.512, lavfi.scd.time: 2.041667"
export function parseScdet(stderr) {
  const cuts = [];
  for (const m of stderr.matchAll(/lavfi\.scd\.score:\s*([\d.]+),\s*lavfi\.scd\.time:\s*([\d.]+)/g)) {
    cuts.push({ time: +m[2], score: +m[1] });
  }
  return cuts.sort((x, y) => x.time - y.time);
}

export function findShortShots(cuts, duration, { min = 0.5, ignoreEdges = false } = {}) {
  const marks = [0, ...cuts.map((c) => c.time).filter((t) => t > 0 && t < duration), duration];
  const shots = [];
  for (let i = 0; i < marks.length - 1; i++) {
    shots.push({ start: +marks[i].toFixed(3), end: +marks[i + 1].toFixed(3), length: +(marks[i + 1] - marks[i]).toFixed(3) });
  }
  const short = shots.filter((s, i) => s.length < min && !(ignoreEdges && (i === 0 || i === shots.length - 1)));
  return { shots, short };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const file = a._[0];
  if (!file) { console.error('usage: node short-cut-check.mjs <video> [--min 0.5] [--threshold 10] [--ignore-edges] [--json]'); process.exit(2); }
  const min = a.min != null ? +a.min : 0.5;
  const threshold = a.threshold != null ? +a.threshold : 10;
  let duration;
  try { duration = +probe(file).format.duration; } catch (e) { console.error(e.message); process.exit(2); }
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-an', '-vf', `scdet=threshold=${threshold}`, '-f', 'null', '-']);
  if (r.status !== 0) { console.error('ffmpeg failed:\n' + r.stderr.slice(-2000)); process.exit(2); }
  const cuts = parseScdet(r.stderr);
  const res = findShortShots(cuts, duration, { min, ignoreEdges: !!a['ignore-edges'] });
  if (a.json) console.log(JSON.stringify({ duration, threshold, min, cuts, ...res }, null, 2));
  else {
    console.log(`duration ${duration.toFixed(3)} s, cuts found ${cuts.length} (threshold ${threshold})`);
    for (const c of cuts) console.log(`  cut at ${c.time.toFixed(3)} s (score ${c.score.toFixed(1)})`);
    if (res.short.length) {
      console.log(`FAIL: ${res.short.length} shot(s) shorter than ${min} s — look at these frames:`);
      for (const s of res.short) console.log(`  ${s.start.toFixed(3)} ~ ${s.end.toFixed(3)} s (${s.length.toFixed(3)} s)`);
    } else console.log(`PASS: no shot shorter than ${min} s`);
    console.log('note: a detector can miss soft cuts or flag flashes; open the frames around every cut yourself.');
  }
  process.exit(res.short.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
