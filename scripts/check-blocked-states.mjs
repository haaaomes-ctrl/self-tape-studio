import fs from 'node:fs';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const required = [
  'Level 2 remains `not_accepted`',
  'production-safe, public-scoring and public-technique-authority gates remain blocked',
  'Overall readiness score exposure remains blocked from public scoring output unless separately approved.'
];

const missing = required.filter((line) => !readme.includes(line));
if (missing.length) {
  console.error(JSON.stringify({ ok: false, code: 'blocked_states_missing', missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, code: 'blocked_states_verified' }));
