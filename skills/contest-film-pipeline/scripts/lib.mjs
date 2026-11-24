// Shared helpers: find ffmpeg/ffprobe and run them without a shell.
import { spawnSync } from 'node:child_process';

export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';

export function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) throw new Error(`${bin} could not start: ${r.error.message} (set FFMPEG / FFPROBE env vars)`);
  return r;
}

export function hasFfmpeg() {
  try {
    return run(FFMPEG, ['-version']).status === 0 && run(FFPROBE, ['-version']).status === 0;
  } catch {
    return false;
  }
}

export function probe(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_entries',
    'format=duration:stream=index,codec_type,duration,nb_frames,r_frame_rate,width,height',
    '-of', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout);
}

// Minimal argv parser: positional + --key value / --flag
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
