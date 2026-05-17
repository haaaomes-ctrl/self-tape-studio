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
  'report-schema',
  'report-renderer',
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

function isTestOrFixturePath(filePath) {
  if (filePath.includes('/__tests__/')) return true;
  if (filePath.includes('/fixtures/')) return true;

  const baseName = getBaseName(filePath);
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(baseName);
}

const reportSensitiveAreaPrefixes = [
  'src/server/',
  'src/lib/',
  'src/utils/',
  'src/routes/',
  'app/',
  'api/',
];

const reportSensitiveTerms = [
  'readreportschemaversion',
  'publicreportv3',
  'report renderer',
  'render payload',
  'rendered report',
  'report parity',
  'public report',
];

function containsReportSensitiveContent(filePath, options = {}) {
  const contentByPath = normalizeContentMap(options.contentByPath);
  if (contentByPath.has(filePath)) {
    const lowered = String(contentByPath.get(filePath)).toLowerCase();
    return reportSensitiveTerms.some((term) => lowered.includes(term));
  }
  if (!existsSync(filePath)) return false;
  try {
    const lowered = readFileSync(filePath, 'utf8').toLowerCase();
    return reportSensitiveTerms.some((term) => lowered.includes(term));
  } catch {
    return false;
  }
}

function isCodeFile(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function isWebhookRuntimePath(filePath) {
  const normalized = normalizePath(filePath);
  if (!isCodeFile(normalized)) return false;
  if (isTestOrFixturePath(normalized)) return false;
  if (normalized.includes('/contracts/')) return false;
  if (!/webhook/i.test(normalized)) return false;

  return (
    normalized.startsWith('src/routes/') ||
    normalized.startsWith('src/server/') ||
    normalized.startsWith('src/server-fns/') ||
    normalized.startsWith('src/functions/') ||
    normalized.startsWith('api/') ||
    normalized.startsWith('app/')
  );
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
  'mux_token_id',
  'mux_token_secret',
  'mux_webhook_secret',
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

function isProtectedReportPath(filePath, options = {}) {
  if (filePath.startsWith('src/components/report/')) return true;
  if (explicitReportServerFiles.has(filePath)) return true;
  if (reportRoutePattern.test(filePath)) return true;
  if (isTestOrFixturePath(filePath)) return false;
  if (filePath.includes('/contracts/')) return false;

  const inReportArea = reportSensitiveAreaPrefixes.some((prefix) => filePath.startsWith(prefix));
  if (!inReportArea || !isTypeScriptPath(filePath)) return false;

  const baseName = getBaseName(filePath);
  if (reportFilenameHints.some((hint) => baseName.includes(hint))) return true;

  return containsReportSensitiveContent(filePath, options);
}

function isProtectedMuxPath(filePath, options = {}) {
  if (isTestOrFixturePath(filePath)) return false;

  if (explicitMuxProtectedFiles.has(filePath)) return true;
  if (!isCodeFile(filePath)) return false;

  const baseName = getBaseName(filePath);
  const hasMuxBaseName = baseName.includes('mux');

  const hasSensitiveContent = containsMuxSensitiveContent(filePath, options);

  const inMuxSensitiveArea = muxSensitiveAreaPrefixes.some((prefix) => filePath.startsWith(prefix));
  if (inMuxSensitiveArea && (hasMuxBaseName || hasSensitiveContent)) return true;

  return hasSensitiveContent && filePath.startsWith('src/components/');
}

function isProtectedWebhookPath(filePath) {
  return isWebhookRuntimePath(filePath);
}


const explicitUploadProtectedFiles = new Set([
  'src/routes/new.tsx',
  'src/server/mux-upload.ts',
  'src/server/upload-errors.ts',
  'src/server-fns/process-take.functions.ts',
  'src/server-fns/upload.functions.ts',
  'src/server-fns/direct-upload.functions.ts',
  'src/server/upload-handler.ts',
  'src/routes/api/public/upload.ts',
  'api/upload.ts',
  'app/routes/upload.ts',
]);

const uploadRuntimePrefixes = [
  'src/server/',
  'src/server-fns/',
  'src/routes/',
  'api/',
  'app/',
];

const uploadSensitiveTerms = [
  'createupload',
  'direct upload',
  'upload url',
  'uploadurl',
  'upload_id',
  'uploadid',
  'signed upload',
  'multipart upload',
  'file upload',
  'submit take',
  'process take upload',
  'storage upload',
];

function containsUploadSensitiveContent(filePath, options = {}) {
  const contentByPath = normalizeContentMap(options.contentByPath);
  if (contentByPath.has(filePath)) {
    const lowered = String(contentByPath.get(filePath)).toLowerCase();
    return uploadSensitiveTerms.some((term) => lowered.includes(term));
  }
  if (!existsSync(filePath)) return false;
  try {
    const lowered = readFileSync(filePath, 'utf8').toLowerCase();
    return uploadSensitiveTerms.some((term) => lowered.includes(term));
  } catch {
    return false;
  }
}

function isProtectedUploadPath(filePath, options = {}) {
  const normalized = normalizePath(filePath);
  if (isTestOrFixturePath(normalized)) return false;
  if (normalized.includes('/contracts/')) return false;
  if (normalized.startsWith('docs/')) return false;

  if (explicitUploadProtectedFiles.has(normalized)) return true;
  if (!isCodeFile(normalized)) return false;

  const inRuntimePath = uploadRuntimePrefixes.some((prefix) => normalized.startsWith(prefix));
  if (!inRuntimePath) return false;

  const baseName = getBaseName(normalized);
  if (baseName.includes('upload')) return true;

  return containsUploadSensitiveContent(normalized, options);
}

const EXCEPTIONS_SCHEMA_VERSION = 'tapecoach_protected_area_exceptions_v1';

function parseProtectedAreaExceptions() {
  const rawJson = process.env.PROTECTED_AREA_EXCEPTIONS_JSON;
  const filePath = process.env.PROTECTED_AREA_EXCEPTIONS_FILE;
  if (!rawJson && !filePath) return { config: null, error: null };

  try {
    const source = rawJson ? rawJson : readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(source);
    return { config: parsed, error: null };
  } catch (error) {
    return { config: null, error: `invalid protected-area exception JSON: ${error.message}` };
  }
}

function validateExceptionConfig(config) {
  const failures = [];
  if (!config || typeof config !== 'object') failures.push('missing protected-area exception config object');
  if (config?.schema_version !== EXCEPTIONS_SCHEMA_VERSION) failures.push(`unsupported schema_version: expected ${EXCEPTIONS_SCHEMA_VERSION}`);
  if (!config?.approval_source) failures.push('protected-area exception missing approval_source');
  if (!config?.approved_by) failures.push('protected-area exception missing approved_by');
  if (!config?.reason) failures.push('protected-area exception missing reason');
  if (!Array.isArray(config?.exceptions)) failures.push('protected-area exception missing exceptions[]');
  if (config?.expires_at) {
    const exp = Date.parse(config.expires_at);
    if (Number.isNaN(exp) || exp <= Date.now()) failures.push('protected-area exception is expired');
  }
  return failures;
}

function applyExceptions(violations, config) {
  if (!config) return { approved: [], unapproved: violations };
  const exceptionMap = new Map();
  for (const ex of config.exceptions ?? []) {
    if (!ex?.file || !Array.isArray(ex?.categories)) continue;
    exceptionMap.set(normalizePath(ex.file), new Set(ex.categories));
  }

  const approved = [];
  const unapproved = [];
  for (const violation of violations) {
    const allowed = exceptionMap.get(violation.file);
    if (!allowed) {
      unapproved.push(violation);
      continue;
    }
    const allCategoriesAllowed = violation.categories.every((c) => allowed.has('*') || allowed.has(c));
    if (allCategoriesAllowed) approved.push(violation);
    else unapproved.push(violation);
  }
  return { approved, unapproved };
}

const protectedMatchers = [
  { label: 'public output/report rendering', matches: isProtectedReportPath },
  { label: 'upload', matches: isProtectedUploadPath },
  { label: 'Mux', matches: isProtectedMuxPath },
  { label: 'webhook', matches: isProtectedWebhookPath },
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
    const previousHead = git(['rev-parse', 'HEAD~1']);
    return git(['diff', '--name-only', `${previousHead}...HEAD`]).split('\n').filter(Boolean);
  } catch {}

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
  const parsed = parseProtectedAreaExceptions();

  if (parsed.error) {
    console.error('Protected-area gate failed:');
    console.error(`- ${parsed.error}`);
    process.exit(1);
  }

  let approved = [];
  let unapproved = violations;
  if (parsed.config) {
    const configFailures = validateExceptionConfig(parsed.config);
    if (configFailures.length) {
      console.error('Protected-area gate failed:');
      for (const failure of configFailures) console.error(`- ${failure}`);
      process.exit(1);
    }
    ({ approved, unapproved } = applyExceptions(violations, parsed.config));
  }

  if (unapproved.length) {
    console.error('Protected-area gate failed. Operator approval is required for:');
    for (const violation of unapproved) {
      console.error(`- ${JSON.stringify(violation)}`);
    }
    if (approved.length) {
      console.error('Approved protected-area exceptions:');
      for (const violation of approved) console.error(`- ${JSON.stringify(violation)}`);
    }
    process.exit(1);
  }

  if (approved.length) {
    console.log('Protected-area gate passed with approved exceptions.');
    console.log(JSON.stringify({ decision: 'passed', operator_required: false, approved_exceptions: approved, unapproved_violations: [] }));
    return;
  }

  console.log('Protected-area gate passed');
}

const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const moduleFilePath = fileURLToPath(import.meta.url);

if (executedFilePath && moduleFilePath === executedFilePath) {
  run();
}
