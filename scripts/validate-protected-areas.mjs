#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const protectedPatterns = [
  { label: 'public output/report rendering', pattern: /^(src\/components\/report\/|src\/server\/v3\/s5-public-report\.ts|src\/server\/v3\/s5-internal-renderer\.ts|src\/routes\/(index|about|dashboard|audition\.\$auditionId|new)\.tsx)/ },
  { label: 'upload', pattern: /(^|\/)(mux-upload|upload-errors)\.ts$|^src\/routes\/new\.tsx$/ },
  { label: 'Mux', pattern: /(^|\/)mux(\.|-)|^src\/routes\/api\/public\/mux-webhook\.ts$/ },
  { label: 'webhook', pattern: /webhook/i },
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function changedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : '';
  if (baseRef) {
    try {
      const mergeBase = git(['merge-base', 'HEAD', baseRef]);
      return git(['diff', '--name-only', `${mergeBase}...HEAD`]).split('\n').filter(Boolean);
    } catch {}
  }

  const fallbackRefs = [];

  try {
    const originHeadTarget = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    if (originHeadTarget) fallbackRefs.push(originHeadTarget);
  } catch {}

  fallbackRefs.push('origin/main', 'origin/master', 'main', 'master');

  for (const ref of fallbackRefs) {
    try {
      const mergeBase = git(['merge-base', 'HEAD', ref]);
      return git(['diff', '--name-only', `${mergeBase}...HEAD`]).split('\n').filter(Boolean);
    } catch {}
  }

  try {
    return git(['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const changed = changedFiles();
const violations = [];

for (const file of changed) {
  for (const protectedPattern of protectedPatterns) {
    if (protectedPattern.pattern.test(file)) {
      violations.push(`${file} (${protectedPattern.label})`);
    }
  }
}

if (violations.length) {
  console.error('Protected-area gate failed. Operator approval is required for:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Protected-area gate passed');
