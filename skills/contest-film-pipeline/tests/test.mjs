// node --test tests/test.mjs  — unit tests always run; video tests run when ffmpeg is on PATH.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseScdet, findShortShots } from '../scripts/short-cut-check.mjs';
import { judge } from '../scripts/duration-check.mjs';
import { sheetPlan, reviewTable } from '../scripts/scene-sheet.mjs';
import { hasFfmpeg, FFMPEG } from '../scripts/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(here, '..', 'scripts');
const node = (script, args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8' });

test('parseScdet reads ffmpeg scdet log lines', () => {
  const log = '[scdet @ 0x1] lavfi.scd.score: 37.512, lavfi.scd.time: 2.041667\n[scdet @ 0x1] lavfi.scd.score: 20.0, lavfi.scd.time: 1.5\n';
  assert.deepEqual(parseScdet(log).map((c) => c.time), [1.5, 2.041667]);
});

test('findShortShots flags a 0.3 s stray shot and can ignore edges', () => {
  const cuts = [{ time: 4.625 }, { time: 4.917 }, { time: 9.8 }];
  const r = findShortShots(cuts, 10, { min: 0.5 });
  assert.equal(r.short.length, 2); // 4.625-4.917 and the 0.2 s tail
  const r2 = findShortShots(cuts, 10, { min: 0.5, ignoreEdges: true });
  assert.deepEqual(r2.short.map((s) => s.start), [4.625]);
});

test('judge fails exactly-at-limit files and passes 29.917 s', () => {
  const mk = (v, a) => ({ format: { duration: String(Math.max(v, a)) }, streams: [
    { index: 0, codec_type: 'video', duration: String(v) }, { index: 1, codec_type: 'audio', duration: String(a) }] });
  assert.equal(judge(mk(30, 30), { max: 30 }).pass, false);
  assert.equal(judge(mk(30, 30.04), { max: 30 }).pass, false);
  assert.equal(judge(mk(29.917, 29.88), { max: 30 }).pass, true);
  assert.equal(judge(mk(29.917, 29.88), { max: 30, ends: { 1: 30.02 } }).pass, false, 'audio packet end counts');
  assert.equal(judge(mk(50, 50), { max: 90, min: 60 }).pass, false, 'minimum length');
});

test('sheetPlan and reviewTable size', () => {
  const p = sheetPlan(30, { cols: 8, rows: 2 });
  assert.equal(p.frames, 30);
  assert.equal(p.sheets.length, 2);
  assert.equal(reviewTable(3).trim().split('\n').length, 5);
});

const ff = hasFfmpeg();
test('video: short shot, duration and sheet on generated clips', { skip: !ff && 'ffmpeg not found' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfp-'));
  const cut = path.join(dir, 'cut.mp4');
  // 2 s red, 0.3 s white (stray frame), 2 s blue
  let r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=320x240:r=24:d=2',
    '-f', 'lavfi', '-i', 'color=c=white:s=320x240:r=24:d=0.3',
    '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=24:d=2',
    '-filter_complex', '[0][1][2]concat=n=3:v=1:a=0', '-pix_fmt', 'yuv420p', cut], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = node('short-cut-check.mjs', [cut, '--min', '0.5', '--json']);
  assert.equal(s.status, 1, s.stdout + s.stderr);
  const js = JSON.parse(s.stdout);
  assert.equal(js.short.length, 1);
  assert.ok(Math.abs(js.short[0].start - 2) < 0.1 && js.short[0].length < 0.5);

  const mk = (name, d) => {
    const f = path.join(dir, name);
    const rr = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `color=c=gray:s=320x240:r=24:d=${d}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${d}`,
      '-shortest', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f], { encoding: 'utf8' });
    assert.equal(rr.status, 0, rr.stderr);
    return f;
  };
  assert.equal(node('duration-check.mjs', [mk('five.mp4', 5), '--max', '5']).status, 1);
  assert.equal(node('duration-check.mjs', [mk('short.mp4', 4.8), '--max', '5']).status, 0);

  const out = path.join(dir, 'sheets');
  const sh = node('scene-sheet.mjs', [cut, '--out', out, '--cols', '4', '--rows', '1']);
  assert.equal(sh.status, 0, sh.stdout + sh.stderr);
  assert.ok(fs.existsSync(path.join(out, 'sheet_01.jpg')));
  assert.match(fs.readFileSync(path.join(out, 'scenes.md'), 'utf8'), /\| 4 \|/);
  fs.rmSync(dir, { recursive: true, force: true });
});
