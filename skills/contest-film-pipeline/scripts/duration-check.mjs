#!/usr/bin/env node
// Checks that EVERY stream (container, video, audio) stays under a contest length limit.
// Why: a 30.000 s video with a 30.04 s audio track was shown as 0:31 on YouTube.
// Observed: 30.000 s was shown as 0:31, 29.917 s as 0:30. Default margin 0.05 s.
// Usage: node duration-check.mjs <video> --max 30 [--margin 0.05] [--min 25] [--json]
// Exit 0 = pass, 1 = fail, 2 = usage / probe error.
import { probe, parseArgs, run, FFPROBE } from './lib.mjs';
import { fileURLToPath } from 'node:url';

// Last packet end (pts + duration) per stream; catches audio that runs past the stream header.
export function packetEnds(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_entries', 'packet=stream_index,pts_time,duration_time', '-of', 'csv=p=0', file]);
  const ends = {};
  if (r.status !== 0) return ends;
  for (const line of r.stdout.split(/\r?\n/)) {
    const [i, pts, dur] = line.split(',');
    if (pts === undefined || pts === 'N/A') continue;
    const e = +pts + (+dur || 0);
    if (!(i in ends) || e > ends[i]) ends[i] = e;
  }
  return ends;
}

export function judge(info, { max, margin = 0.05, min = null, ends = {} }) {
  const limit = +(max - margin).toFixed(3);
  const rows = [];
  const fmt = info.format && info.format.duration != null ? +info.format.duration : null;
  if (fmt != null) rows.push({ what: 'container', seconds: fmt });
  for (const s of info.streams || []) {
    if (s.codec_type !== 'video' && s.codec_type !== 'audio') continue;
    const d = s.duration != null ? +s.duration : fmt;
    rows.push({ what: `${s.codec_type}#${s.index}`, seconds: d });
    if (ends[s.index] != null) rows.push({ what: `${s.codec_type}#${s.index}-end`, seconds: +ends[s.index].toFixed(3) });
  }
  const problems = [];
  for (const r of rows) {
    if (r.seconds == null || Number.isNaN(r.seconds)) { problems.push(`${r.what}: no duration`); continue; }
    if (r.seconds > limit) problems.push(`${r.what}: ${r.seconds.toFixed(3)} s > ${limit} s (limit ${max} s minus ${margin} s margin)`);
    if (min != null && r.seconds < min) problems.push(`${r.what}: ${r.seconds.toFixed(3)} s < minimum ${min} s`);
  }
  const longest = Math.max(...rows.map((r) => r.seconds || 0));
  return { pass: problems.length === 0, limit, longest, rows, problems };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const file = a._[0];
  if (!file || !a.max) { console.error('usage: node duration-check.mjs <video> --max <seconds> [--margin 0.05] [--min s] [--json]'); process.exit(2); }
  let info;
  try { info = probe(file); } catch (e) { console.error(e.message); process.exit(2); }
  const res = judge(info, { max: +a.max, margin: a.margin != null ? +a.margin : 0.05, min: a.min != null ? +a.min : null, ends: packetEnds(file) });
  if (a.json) console.log(JSON.stringify(res, null, 2));
  else {
    for (const r of res.rows) console.log(`${r.what.padEnd(12)} ${r.seconds == null ? '?' : r.seconds.toFixed(3)} s`);
    console.log(`longest ${res.longest.toFixed(3)} s (observed once: a file of exactly 30.000 s was shown as 0:31 on YouTube, 29.917 s as 0:30)`);
    console.log(res.pass ? `PASS: all streams <= ${res.limit} s` : 'FAIL\n' + res.problems.join('\n'));
  }
  process.exit(res.pass ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
