#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  'report-quality',
  'report-polish',
  'report-enforcement',
  'report-parity',
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

function isCodeFile(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function normalizeContentMap(contentByPath = {}) {
  const normalized = new Map();
  for (const [filePath, content] of Object.entries(contentByPath)) {
    normalized.set(normalizePath(filePath), content);
  }
  return normalized;
}

const explicitMuxProtectedFiles = new Set([
  'src/routes/api/public/mux-webhook.ts',
  'src/routes/api/public/diag-mux-probe.ts',
  'src/server/mux-upload.ts',
  'src/server/some-mux-helper.ts',
  'src/server-fns/mux.functions.ts',
]);

const muxSensitiveAreaPrefixes = [
  'src/routes/',
  'src/server/',
  'src/server-fns/',
  'src/functions/',
  'src/lib/',
  'src/utils/',
  'api/',
  'app/',
];

const muxSensitiveTerms = [
  'MUX_TOKEN',
  'MUX_WEBHOOK',
  'MUX_WEBHOOK_SECRET',
  'mux-webhook',
  'mux upload',
  'createupload',
  'direct upload',
  'playbackid',
  'assetid',
  '@mux/',
  'muxuploader',
  'getmux',
  'mux.video',
  'mux-player',
  'mux.com',
];

function containsMuxSensitiveContent(filePath, options = {}) {
  const contentByPath = normalizeContentMap(options.contentByPath);
  if (contentByPath.has(filePath)) {
    const content = String(contentByPath.get(filePath));
    const lowered = content.toLowerCase();
    return muxSensitiveTerms.some((term) => lowered.includes(term.toLowerCase()));
  }

  if (!existsSync(filePath)) return false;
  try {
    const content = readFileSync(filePath, 'utf8');
    const lowered = content.toLowerCase();
    return muxSensitiveTerms.some((term) => lowered.includes(term.toLowerCase()));
  } catch {
    return false;
  }
}

function isProtectedReportPath(filePath) {
  if (filePath.startsWith('src/components/report/')) return true;
  if (explicitReportServerFiles.has(filePath)) return true;
  if (reportRoutePattern.test(filePath)) return true;

  if (filePath.startsWith('src/server/') && isTypeScriptPath(filePath)) {
    if (filePath.includes('/__tests__/')) return false;
    if (filePath.includes('/contracts/')) return false;
    if (filePath.includes('/fixtures/')) return false;

    const baseName = getBaseName(filePath);
    if (/\.(test|spec)\.(ts|tsx)$/i.test(baseName)) return false;
    return reportFilenameHints.some((hint) => baseName.includes(hint));
  }

  return false;
}

function isProtectedMuxPath(filePath, options = {}) {
  if (filePath.includes('/__tests__/')) return false;
  if (filePath.includes('/fixtures/')) return false;

  if (explicitMuxProtectedFiles.has(filePath)) return true;
  if (!isCodeFile(filePath)) return false;

  const baseName = getBaseName(filePath);
  const hasMuxBaseName = baseName.includes('mux');

  const hasSensitiveContent = containsMuxSensitiveContent(filePath, options);

  const inMuxSensitiveArea = muxSensitiveAreaPrefixes.some((prefix) => filePath.startsWith(prefix));
  if (inMuxSensitiveArea && (hasMuxBaseName || hasSensitiveContent)) return true;

  return hasSensitiveContent && filePath.startsWith('src/components/');
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

export function findProtectedViolations(files, options = {}) {
  const violationsByFile = new Map();

  for (const rawFile of files) {
    const file = normalizePath(rawFile);
    for (const protectedMatcher of protectedMatchers) {
      if (protectedMatcher.matches(file, options)) {
        if (!violationsByFile.has(file)) {
          violationsByFile.set(file, new Set());
        }
        violationsByFile.get(file).add(protectedMatcher.label);
      }
    }
  }

  return Array.from(violationsByFile.entries()).map(([file, labels]) => ({
    file,
    categories: Array.from(labels),
    labels: Array.from(labels),
  }));
}

function run() {
  const changed = changedFiles();
  const violations = findProtectedViolations(changed);

  if (violations.length) {
    console.error('Protected-area gate failed. Operator approval is required for:');
    for (const violation of violations) {
      console.error(`- ${JSON.stringify(violation)}`);
    }
    process.exit(1);
  }

  console.log('Protected-area gate passed');
}

const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const moduleFilePath = fileURLToPath(import.meta.url);

if (executedFilePath && moduleFilePath === executedFilePath) {
  run();
}
