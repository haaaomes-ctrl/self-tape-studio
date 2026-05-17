#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const reportRoutePattern = /^src\/routes\/(index|about|dashboard|audition\.\$auditionId|new)\.tsx$/;
const explicitReportServerFiles = new Set([
  'src/server/v3/s5-public-report.ts',
  'src/server/v3/s5-internal-renderer.ts',
  'src/server/v3/report-v3-render.server.ts',
  'src/server/v2-report-builder.server.ts',
  'src/server/report-output-enforcement.server.ts',
]);

const reportFilenameHints = [
  'report-render',
  'report-builder',
  'report-output',
  'public-report',
  'internal-renderer',
  'render-payload',
];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getBaseName(filePath) {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1).toLowerCase() : normalized.toLowerCase();
}

function isTypeScriptPath(filePath) {
  return /\.(ts|tsx)$/i.test(filePath);
}

function isProtectedReportPath(filePath) {
  if (filePath.startsWith('src/components/report/')) return true;
  if (explicitReportServerFiles.has(filePath)) return true;
  if (reportRoutePattern.test(filePath)) return true;

  if (filePath.startsWith('src/server/') && isTypeScriptPath(filePath)) {
    const baseName = getBaseName(filePath);
    return reportFilenameHints.some((hint) => baseName.includes(hint));
  }

  return false;
}

function isProtectedMuxPath(filePath) {
  if (/^src\/routes\/api\/public\/(mux-webhook|diag-mux-probe)\.ts$/i.test(filePath)) return true;
  if (!isTypeScriptPath(filePath)) return false;

  if (filePath.startsWith('src/routes/') || filePath.startsWith('src/server/')) {
    return getBaseName(filePath).includes('mux');
  }

  return false;
}

const protectedMatchers = [
  { label: 'public output/report rendering', matches: isProtectedReportPath },
  { label: 'upload', matches: (filePath) => /(^|\/)(mux-upload|upload-errors)\.ts$/i.test(filePath) || filePath === 'src/routes/new.tsx' },
  { label: 'Mux', matches: isProtectedMuxPath },
  { label: 'webhook', matches: (filePath) => /webhook/i.test(filePath) },
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

export function findProtectedViolations(files) {
  const violations = [];

  for (const rawFile of files) {
    const file = normalizePath(rawFile);
    for (const protectedMatcher of protectedMatchers) {
      if (protectedMatcher.matches(file)) {
        violations.push(`${file} (${protectedMatcher.label})`);
      }
    }
  }

  return violations;
}

function run() {
  const changed = changedFiles();
  const violations = [];
  violations.push(...findProtectedViolations(changed));

  if (violations.length) {
    console.error('Protected-area gate failed. Operator approval is required for:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log('Protected-area gate passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
