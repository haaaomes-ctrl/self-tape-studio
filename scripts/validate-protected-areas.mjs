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
  return /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(baseName);
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

function isWebhookRuntimePath(filePath, options = {}) {
  const normalized = normalizePath(filePath);
  if (!isCodeFile(normalized)) return false;
  if (isTestOrFixturePath(normalized)) return false;
  if (normalized.includes('/contracts/')) return false;
  const webhookSensitiveTerms = [
    'webhook',
    'verifywebhook',
    'webhook signature',
    'signature header',
    'mux_webhook_secret',
    'stripe_webhook_secret',
    'x-signature',
    'x-mux-signature',
    'constructevent',
    'webhooksecret',
  ];
  const hasWebhookPath = /webhook/i.test(normalized);
  const hasSensitiveContent = containsWebhookSensitiveContent(normalized, options);
  if (!hasWebhookPath && !hasSensitiveContent) return false;

  return (
    normalized.startsWith('src/routes/') ||
    normalized.startsWith('src/server/') ||
    normalized.startsWith('src/server-fns/') ||
    normalized.startsWith('src/functions/') ||
    normalized.startsWith('api/') ||
    normalized.startsWith('app/')
  );
}

function containsWebhookSensitiveContent(filePath, options = {}) {
  const contentByPath = normalizeContentMap(options.contentByPath);
  if (contentByPath.has(filePath)) {
    const lowered = String(contentByPath.get(filePath)).toLowerCase();
    return ['webhook', 'verifywebhook', 'webhook signature', 'signature header', 'mux_webhook_secret', 'stripe_webhook_secret', 'x-signature', 'x-mux-signature', 'constructevent', 'webhooksecret']
      .some((term) => lowered.includes(term));
  }
  if (!existsSync(filePath)) return false;
  try {
    const lowered = readFileSync(filePath, 'utf8').toLowerCase();
    return ['webhook', 'verifywebhook', 'webhook signature', 'signature header', 'mux_webhook_secret', 'stripe_webhook_secret', 'x-signature', 'x-mux-signature', 'constructevent', 'webhooksecret']
      .some((term) => lowered.includes(term));
  } catch {
    return false;
  }
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
  'mux_asset_id',
  'mux_upload_id',
  'mux_playback_id',
  'mux_status',
  'mux_processing',
  'mux_metadata',
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
  if (!inReportArea || !isCodeFile(filePath)) return false;

  const baseName = getBaseName(filePath);
  if (reportFilenameHints.some((hint) => baseName.includes(hint))) return true;

  return containsReportSensitiveContent(filePath, options);
}

function isProtectedMuxPath(filePath, options = {}) {
  if (isTestOrFixturePath(filePath)) return false;
  if (filePath.startsWith('docs/')) return false;
  if (filePath.includes('/contracts/')) return false;

  if (explicitMuxProtectedFiles.has(filePath)) return true;
  if (!isCodeFile(filePath)) return false;

  const baseName = getBaseName(filePath);
  const hasMuxBaseName = baseName.includes('mux');

  const hasSensitiveContent = containsMuxSensitiveContent(filePath, options);

  const inMuxSensitiveArea = muxSensitiveAreaPrefixes.some((prefix) => filePath.startsWith(prefix));
  if (inMuxSensitiveArea && (hasMuxBaseName || hasSensitiveContent)) return true;

  return hasSensitiveContent && filePath.startsWith('src/components/');
}

function isProtectedWebhookPath(filePath, options = {}) {
  return isWebhookRuntimePath(filePath, options);
}


const explicitUploadProtectedFiles = new Set([
  'src/routes/new.tsx',
  'src/server/mux-upload.ts',
  'src/server/upload-errors.ts',
  'src/lib/upload-errors.ts',
  'src/lib/mux-upload.ts',
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
const ALLOWED_APPROVAL_SOURCES = new Set(['operator', 'github_environment', 'gate_approval_issue', 'manual_ci_input']);

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

function validateExceptionConfig(config, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const failures = [];
  const allowedCategories = new Set(['public output/report rendering', 'upload', 'Mux', 'webhook', '*']);
  if (!config || typeof config !== 'object') failures.push('missing protected-area exception config object');
  if (config?.schema_version !== EXCEPTIONS_SCHEMA_VERSION) failures.push(`unsupported schema_version: expected ${EXCEPTIONS_SCHEMA_VERSION}`);
  if (!config?.approval_source) failures.push('protected-area exception missing approval_source');
  if (config?.approval_source && !ALLOWED_APPROVAL_SOURCES.has(config.approval_source)) failures.push('protected-area exception approval_source is invalid');
  if (!config?.approved_by) failures.push('protected-area exception missing approved_by');
  if (!config?.approved_at) failures.push('protected-area exception missing approved_at');
  if (!config?.expires_at) failures.push('protected-area exception missing expires_at');
  if (!config?.reason) failures.push('protected-area exception missing reason');
  if (!Array.isArray(config?.exceptions)) failures.push('protected-area exception missing exceptions[]');
  if (Array.isArray(config?.exceptions)) {
    for (const ex of config.exceptions) {
      if (!ex?.file || typeof ex.file !== 'string' || !ex.file.trim()) failures.push('protected-area exception entry missing file');
      if (!Array.isArray(ex?.categories) || ex.categories.length === 0 || !ex.categories.every((c) => typeof c === 'string' && c.trim())) failures.push('protected-area exception entry missing categories');
      if (Array.isArray(ex?.categories) && !ex.categories.every((c) => allowedCategories.has(c))) failures.push('protected-area exception entry has invalid category');
      if (!ex?.reason || !String(ex.reason).trim()) failures.push('protected-area exception entry missing reason');
    }
  }
  if (config?.approved_at && Number.isNaN(Date.parse(config.approved_at))) failures.push('protected-area exception approved_at is invalid');
  if (config?.approved_at && !Number.isNaN(Date.parse(config.approved_at)) && Date.parse(config.approved_at) > nowMs) failures.push('protected-area exception approved_at must not be in the future');
  if (config?.expires_at) {
    const exp = Date.parse(config.expires_at);
    if (Number.isNaN(exp)) failures.push('protected-area exception expires_at is invalid');
    else if (exp <= nowMs) failures.push('protected-area exception is expired');
  }
  const prNumber = process.env.PR_NUMBER ?? process.env.GITHUB_PR_NUMBER;
  if (!config?.pr_number) failures.push('protected-area exception missing pr_number');
  if (prNumber) {
    if (String(config.pr_number) !== String(prNumber)) failures.push('protected-area exception pr_number does not match current PR');
  } else {
    failures.push('protected-area exception requires PR_NUMBER/GITHUB_PR_NUMBER operator-verification-required');
  }
  return failures;
}

export function evaluateProtectedAreaGate(files, exceptionConfig = null, options = {}) {
  const violations = findProtectedViolations(files, options);
  const configFailures = exceptionConfig ? validateExceptionConfig(exceptionConfig, options) : [];
  const { approved, unapproved } = exceptionConfig && !configFailures.length
    ? applyExceptions(violations, exceptionConfig)
    : { approved: [], unapproved: violations };
  return { violations, approved, unapproved, configFailures };
}

function applyExceptions(violations, config) {
  if (!config) return { approved: [], unapproved: violations };
  const exceptionMap = new Map();
  for (const ex of config.exceptions ?? []) {
    if (!ex?.file || !Array.isArray(ex?.categories)) continue;
    const key = normalizePath(ex.file);
    let categorySet = exceptionMap.get(key);
    if (!categorySet) {
      categorySet = new Set();
      exceptionMap.set(key, categorySet);
    }
    for (const category of ex.categories) categorySet.add(category);
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

function resolveMergeBaseRef() {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    try {
      return git(['merge-base', 'HEAD', `origin/${baseRef}`]);
    } catch {}
    try {
      return git(['merge-base', 'HEAD', baseRef]);
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
      return git(['merge-base', 'HEAD', ref]);
    } catch {}
  }
  throw new Error('protected-area gate cannot determine changed-file base; operator verification required');
}

function loadGitBlob(ref, filePath) {
  try {
    return git(['show', `${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

export function changedEntriesFromGit() {
  const mergeBase = resolveMergeBaseRef();
  const lines = git(['diff', '--name-status', '-M', '-C', `${mergeBase}...HEAD`]).split('\n').filter(Boolean);
  const entries = [];
  for (const line of lines) {
    const parts = line.split('\t');
    const statusRaw = parts[0] ?? '';
    const statusCode = statusRaw[0];
    if (statusCode === 'R' || statusCode === 'C') {
      const previousPath = normalizePath(parts[1] ?? '');
      const path = normalizePath(parts[2] ?? '');
      const oldContent = loadGitBlob(mergeBase, previousPath);
      const newContent = existsSync(path) ? readFileSync(path, 'utf8') : null;
      if ((oldContent === null || oldContent === undefined) && (newContent === null || newContent === undefined)) {
        throw new Error(`protected-area gate cannot load ${statusCode === 'C' ? 'copied' : 'renamed'} file content for ${previousPath} -> ${path}; operator verification required`);
      }
      entries.push({ status: statusCode === 'C' ? 'copied' : 'renamed', previousPath, path, oldContent, newContent });
    } else if (statusCode === 'D') {
      const path = normalizePath(parts[1] ?? '');
      const oldContent = loadGitBlob(mergeBase, path);
      if (oldContent === null || oldContent === undefined) throw new Error(`protected-area gate cannot load deleted file content for ${path}; operator verification required`);
      entries.push({ status: 'deleted', path, previousPath: path, oldContent, newContent: null });
    } else {
      const path = normalizePath(parts[1] ?? '');
      const oldContent = statusCode === 'M' ? loadGitBlob(mergeBase, path) : null;
      const newContent = existsSync(path) ? readFileSync(path, 'utf8') : null;
      entries.push({ status: statusCode === 'A' ? 'added' : 'modified', path, oldContent, newContent });
    }
  }
  return entries;
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

export function findProtectedViolationsFromEntries(entries) {
  const violationsByFile = new Map();
  const addMatch = (path, content) => {
    if (!path) return;
    const contentByPath = content == null ? {} : { [path]: content };
    for (const matcher of protectedMatchers) {
      if (matcher.matches(path, { contentByPath })) {
        if (!violationsByFile.has(path)) violationsByFile.set(path, new Set());
        violationsByFile.get(path).add(matcher.label);
      }
    }
  };
  for (const entry of entries) {
    const status = String(entry.status ?? '').toLowerCase();
    if (status === 'modified') {
      addMatch(entry.path, entry.newContent ?? null);
      if (entry.oldContent !== null && entry.oldContent !== undefined) addMatch(entry.path, entry.oldContent);
      continue;
    }
    if (status === 'deleted') {
      addMatch(entry.path, entry.oldContent ?? null);
      continue;
    }
    if (status === 'renamed') {
      addMatch(entry.path, entry.newContent ?? null);
      if (entry.previousPath && entry.previousPath !== entry.path) addMatch(entry.previousPath, entry.oldContent ?? null);
      continue;
    }
    if (status === 'copied') {
      if (entry.newContent !== null && entry.newContent !== undefined) addMatch(entry.path, entry.newContent);
      else addMatch(entry.path, entry.oldContent ?? null);
      continue;
    }
    addMatch(entry.path, entry.newContent ?? null);
    if (entry.oldContent !== null && entry.oldContent !== undefined) addMatch(entry.path, entry.oldContent);
  }
  return Array.from(violationsByFile.entries()).map(([file, labels]) => ({ file, categories: Array.from(labels), labels: Array.from(labels) }));
}

function run() {
  let changedEntries = [];
  try {
    changedEntries = changedEntriesFromGit();
  } catch (error) {
    console.error('Protected-area gate failed:');
    console.error(`- ${error.message}`);
    process.exit(1);
  }
  const violations = findProtectedViolationsFromEntries(changedEntries);
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
