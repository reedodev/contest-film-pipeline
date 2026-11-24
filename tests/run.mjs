// Lints SKILL.md, checks links, scans for private data, then runs the skill's node:test suite.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = 'contest-film-pipeline';
const dir = path.join(root, 'skills', name);

const md = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
const get = (k) => ((fm && (fm[1].match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1]) || '').replace(/^"|"$/g, '');
const problems = [];
if (get('name') !== name) problems.push('front matter name must be ' + name);
const desc = get('description');
if (!desc || desc.length > 1024 || /<[a-z][^>]*>/i.test(desc)) problems.push('description missing, too long or has XML tags');
if (md.split('\n').length > 500) problems.push('SKILL.md longer than 500 lines');
for (const m of md.matchAll(/`((?:references|scripts)\/[^`\s]+)`/g)) {
  if (!fs.existsSync(path.join(dir, m[1]))) problems.push('broken path in SKILL.md: ' + m[1]);
}
for (const f of ['references/lessons.md', 'references/checklists.md', 'scripts/duration-check.mjs', 'scripts/short-cut-check.mjs', 'scripts/scene-sheet.mjs']) {
  if (!fs.existsSync(path.join(dir, f))) problems.push('missing ' + f);
}

// private-data scan over every text file in the repo
const banned = [/@gmail\.com/i, /[A-Z]:\\\\?Users/i, /\b[CDEF]:\\/, /ai-canvas\/[0-9a-f-]{8,}/i, /youtu\.be\/|youtube\.com\/(watch|shorts)/i,
  /\b01[016789]-?\d{3,4}-?\d{4}\b/, /local:start|local:end/, /sources\.local/, /profile\.json/, /user\d{6,}/];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(md|mjs|json|yml|txt)$/.test(e.name) && e.name !== 'run.mjs') {
      const t = fs.readFileSync(p, 'utf8');
      for (const re of banned) if (re.test(t)) problems.push(`private-data pattern ${re} in ${path.relative(root, p)}`);
    }
  }
}
walk(root);

if (problems.length) { console.log('LINT FAIL\n' + problems.join('\n')); process.exit(1); }
console.log('lint ok + private-data scan ok: ' + name);

const r = spawnSync(process.execPath, ['--test', path.join(dir, 'tests', 'test.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
