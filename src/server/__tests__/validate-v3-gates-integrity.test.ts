import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { extractNpmRunTargets, validateV3Gates } from '../../../scripts/validate-v3-gates.mjs';

function runWithScripts(scripts: Record<string, string>) {
  const failures = validateV3Gates({ packageJsonOverride: { scripts } as any });
  return failures;
}

describe('validate-v3-gates script integrity', () => {
  it('importing module does not execute CLI path', () => {
    const code = `import('./scripts/validate-v3-gates.mjs').then(() => process.exit(0)).catch(() => process.exit(2));`;
    const result = spawnSync('node', ['-e', code], { cwd: process.cwd(), encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('direct CLI invocation exits 0 when validation passes', () => {
    const result = spawnSync('node', ['scripts/validate-v3-gates.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('v3 gate validation passed');
  });

  it('direct CLI invocation exits 1 when validation fails', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'v3-gates-cli-fail-'));
    writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ name: 'tmp', scripts: {} }, null, 2));
    writeFileSync(path.join(temp, 'README.md'), 'stub');
    const result = spawnSync('node', [path.join(process.cwd(), 'scripts/validate-v3-gates.mjs')], {
      cwd: temp,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('v3 gate validation failed');
    expect(result.stderr).toContain('missing required file: AGENTS.md');
    rmSync(temp, { recursive: true, force: true });
  });

  it('reports missing release-gates contract file without throwing', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'v3-gates-missing-release-'));
    mkdirSync(path.join(temp, 'src/server/v3/contracts'), { recursive: true });
    mkdirSync(path.join(temp, 'src/server/__tests__'), { recursive: true });
    mkdirSync(path.join(temp, '.github/ISSUE_TEMPLATE'), { recursive: true });
    mkdirSync(path.join(temp, '.github/workflows'), { recursive: true });
    writeFileSync(path.join(temp, 'AGENTS.md'), 'x');
    writeFileSync(path.join(temp, 'env-vars.md'), 'x');
    writeFileSync(path.join(temp, '.github/ISSUE_TEMPLATE/release-slice.yml'), 'x');
    writeFileSync(path.join(temp, '.github/ISSUE_TEMPLATE/protected-area-exception.yml'), 'x');
    writeFileSync(path.join(temp, '.github/pull_request_template.md'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/contracts.yml'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/build.yml'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/gatekeeper.yml'), 'x');
    writeFileSync(path.join(temp, 'src/server/v3/contracts/storage-bundle.ts'), "export const x='manifest.json';export const y='qa/acceptance_metrics.json';export const z='expected_file_count_when_technique_and_score_sources_exist: 12';");
    writeFileSync(path.join(temp, 'src/server/__tests__/v3-contracts.test.ts'), 'x');
    writeFileSync(path.join(temp, 'README.md'), 'Level 2 remains `not_accepted`\nproduction-safe, public-scoring and public-technique-authority gates remain blocked');
    const failures = validateV3Gates({ cwd: temp, packageJsonOverride: { scripts: { 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' } } as any });
    expect(failures.some((f) => f.includes('missing required file: src/server/v3/contracts/release-gates.ts'))).toBe(true);
    rmSync(temp, { recursive: true, force: true });
  });

  it('reports missing storage-bundle contract file without throwing', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'v3-gates-missing-storage-'));
    mkdirSync(path.join(temp, 'src/server/v3/contracts'), { recursive: true });
    mkdirSync(path.join(temp, 'src/server/__tests__'), { recursive: true });
    mkdirSync(path.join(temp, '.github/ISSUE_TEMPLATE'), { recursive: true });
    mkdirSync(path.join(temp, '.github/workflows'), { recursive: true });
    writeFileSync(path.join(temp, 'AGENTS.md'), 'x');
    writeFileSync(path.join(temp, 'env-vars.md'), 'x');
    writeFileSync(path.join(temp, '.github/ISSUE_TEMPLATE/release-slice.yml'), 'x');
    writeFileSync(path.join(temp, '.github/ISSUE_TEMPLATE/protected-area-exception.yml'), 'x');
    writeFileSync(path.join(temp, '.github/pull_request_template.md'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/contracts.yml'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/build.yml'), 'x');
    writeFileSync(path.join(temp, '.github/workflows/gatekeeper.yml'), 'x');
    writeFileSync(path.join(temp, 'src/server/v3/contracts/release-gates.ts'), "level2_status: 'not_accepted' production_safe_status: 'blocked' public_scoring_status: 'blocked' public_technique_authority_status: 'blocked' public_output_unchanged_required: true upload_changes_allowed: false mux_changes_allowed: false webhook_changes_allowed: false");
    writeFileSync(path.join(temp, 'src/server/__tests__/v3-contracts.test.ts'), 'x');
    writeFileSync(path.join(temp, 'README.md'), 'Level 2 remains `not_accepted`\nproduction-safe, public-scoring and public-technique-authority gates remain blocked');
    const failures = validateV3Gates({ cwd: temp, packageJsonOverride: { scripts: { 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' } } as any });
    expect(failures.some((f) => f.includes('missing required file: src/server/v3/contracts/storage-bundle.ts'))).toBe(true);
    rmSync(temp, { recursive: true, force: true });
  });
  it('fails when test:contracts is missing', () => {
    const failures = runWithScripts({ 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' });
    expect(failures.join('\n')).toContain('package.json missing test:contracts script');
  });

  it('fails when gate:release is missing', () => {
    const failures = runWithScripts({ 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts' });
    expect(failures.join('\n')).toContain('package.json missing gate:release script');
  });

  it('fails when test:contracts is a no-op', () => {
    const failures = runWithScripts({ 'test:contracts': 'echo ok', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' });
    expect(failures.join('\n')).toContain('test:contracts appears to be a no-op');
  });

  it('fails when gate:release is a no-op', () => {
    const failures = runWithScripts({ 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'true' });
    expect(failures.join('\n')).toContain('gate:release appears to be a no-op');
  });

  it('fails when gate:release is missing protected-area validation', () => {
    const failures = runWithScripts({ 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs' });
    expect(failures.join('\n')).toContain('gate:release missing protected-area validation coverage');
  });

  it('fails when gate:release is missing storage validation', () => {
    const failures = runWithScripts({ 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-protected-areas.mjs' });
    expect(failures.join('\n')).toContain('gate:release missing Storage bundle validation coverage');
  });

  it('fails when gate:release is missing v3 gate validation', () => {
    const failures = runWithScripts({ 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' });
    expect(failures.join('\n')).toContain('gate:release missing v3 gate validation coverage');
  });

  it('fails when gate:release references missing npm run targets', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run --if-present gate:protected && npm run --if-present gate:storage && npm run --if-present gate:v3',
    });
    const output = failures.join('\n');
    expect(output).toContain('gate:release references missing npm script: gate:protected');
    expect(output).toContain('gate:release references missing npm script: gate:storage');
    expect(output).toContain('gate:release references missing npm script: gate:v3');
  });

  it('passes when gate:release uses --if-present and referenced scripts exist', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run --if-present gate:protected && npm run --if-present gate:storage && npm run --if-present gate:v3',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
    });
    expect(failures).toEqual([]);
  });

  it('passes when gate:release expands through npm run references', () => {
    const failures = runWithScripts({
      'test:contracts': 'npm run contracts:core',
      'contracts:core': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:full',
      'gate:full': 'npm run gate:v3 && npm run gate:storage && npm run gate:protected',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
    });
    expect(failures).toEqual([]);
  });

  it('extracts npm run target when --if-present appears before script name', () => {
    expect(extractNpmRunTargets('npm run --if-present gate:v3')).toEqual(['gate:v3']);
  });

  it('extracts npm run-script target when --if-present appears before script name', () => {
    expect(extractNpmRunTargets('npm run-script --if-present gate:v3')).toEqual(['gate:v3']);
  });

  it('extracts npm run target with --silent and -s flags', () => {
    expect(extractNpmRunTargets('npm run --silent gate:v3')).toEqual(['gate:v3']);
    expect(extractNpmRunTargets('npm run -s gate:v3')).toEqual(['gate:v3']);
  });

  it('extracts npm run target with workspace flags and skips workspace value', () => {
    expect(extractNpmRunTargets('npm run --workspace app gate:v3')).toEqual(['gate:v3']);
    expect(extractNpmRunTargets('npm run -w app gate:v3')).toEqual(['gate:v3']);
  });

  it('extracts npm run target with post-script args', () => {
    expect(extractNpmRunTargets('npm run gate:v3 -- --strict')).toEqual(['gate:v3']);
  });

  it('extracts multiple npm run targets in one command', () => {
    expect(extractNpmRunTargets('npm run --if-present gate:protected && npm run --if-present gate:storage && npm run --if-present gate:v3'))
      .toEqual(['gate:protected', 'gate:storage', 'gate:v3']);
  });

  it('passes validation for gate:release using npm run --if-present', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run --if-present gate:v3',
      'gate:v3': 'node scripts/validate-v3-gates.mjs && node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs',
    });
    expect(failures).toEqual([]);
  });

  it('passes validation for gate:release using npm run-script --if-present', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run-script --if-present gate:v3',
      'gate:v3': 'node scripts/validate-v3-gates.mjs && node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs',
    });
    expect(failures).toEqual([]);
  });

  it('fails when expanded flagged npm run target is a no-op', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run --if-present gate:v3',
      'gate:v3': 'echo ok',
    });
    expect(failures.join('\n')).toContain('gate:release missing protected-area validation coverage');
    expect(failures.join('\n')).toContain('gate:release missing Storage bundle validation coverage');
  });

  it('fails when test:contracts is echo with vitest-looking text', () => {
    const failures = runWithScripts({
      'test:contracts': 'echo "vitest run src/server/__tests__/v3-contracts.test.ts"',
      'gate:release': 'node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('test:contracts appears to be a no-op');
  });

  it('fails when gate:release uses echo wrappers for validator-looking text', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'echo "node scripts/validate-protected-areas.mjs" && echo "node scripts/validate-storage-bundle.mjs" && echo "node scripts/validate-v3-gates.mjs"',
    });
    expect(failures.join('\n')).toContain('gate:release appears to be a no-op');
  });

  it('fails when newline-separated direct validators are used', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs\nnode scripts/validate-storage-bundle.mjs\nnode scripts/validate-v3-gates.mjs',
    });
    const output = failures.join('\n');
    expect(output).toContain('newline chaining');
  });

  it('fails when newline-separated npm-run validators are used', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:protected\nnpm run gate:storage\nnpm run gate:v3',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
    });
    const output = failures.join('\n');
    expect(output).toContain('newline chaining');
  });

  it('reports structured failure when README.md is missing', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'v3-gates-missing-readme-'));
    writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ scripts: {} }));
    const failures = validateV3Gates({ cwd: temp });
    expect(failures.join('\n')).toContain('missing required file: README.md');
    rmSync(temp, { recursive: true, force: true });
  });

  it('reports structured failure when package.json is missing', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'v3-gates-missing-pkg-'));
    writeFileSync(path.join(temp, 'README.md'), 'stub');
    const failures = validateV3Gates({ cwd: temp });
    expect(failures.join('\n')).toContain('missing required file: package.json');
    rmSync(temp, { recursive: true, force: true });
  });

  it('fails when protected-area validator failure is swallowed with || true', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs || true && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
  });

  it('fails when npm run gate:protected is swallowed with || true', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:protected || true && npm run gate:storage && npm run gate:v3',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
    });
    const output = failures.join('\n');
    expect(output).toContain('gate:release protected-area validator is present but failure is swallowed');
  });

  it('fails when storage validator is swallowed by || echo ok', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs || echo ok && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release Storage bundle validator is present but failure is swallowed');
  });

  it('fails when v3 validator is swallowed by || exit 0', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs || exit 0',
    });
    expect(failures.join('\n')).toContain('gate:release v3 gate validator is present but failure is swallowed');
  });

  it('fails when semicolon can swallow validator failure', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs ; echo ok',
    });
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
  });

  it('fails when validator is piped and exit can be masked', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs | cat && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
  });

  it('fails when expanded flagged npm run target misses storage coverage', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run --if-present gate:v3',
      'gate:v3': 'node scripts/validate-v3-gates.mjs && node scripts/validate-protected-areas.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release missing Storage bundle validation coverage');
  });



  it('fails when semicolon-separated direct validators are used', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs ; node scripts/validate-storage-bundle.mjs ; node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
    expect(failures.join('\n')).toContain('gate:release Storage bundle validator is present but failure is swallowed');
    expect(failures.join('\n')).toContain('gate:release v3 gate validator is present but failure is swallowed');
  });

  it('fails when semicolon-separated npm run validators are used', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:protected ; npm run gate:storage ; npm run gate:v3',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
  });

  it('does not infinite loop with recursive npm run references', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:a',
      'gate:a': 'npm run gate:b',
      'gate:b': 'npm run gate:a && node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs',
    });
    expect(failures).toEqual([]);
  });

  it('fails when direct validator is shell-negated', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': '! node scripts/validate-protected-areas.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('failure is swallowed');
  });

  it('fails when npm validator is shell-negated', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': '! npm run gate:protected && npm run gate:storage && npm run gate:v3',
      'gate:protected': 'node scripts/validate-protected-areas.mjs',
      'gate:storage': 'node scripts/validate-storage-bundle.mjs',
      'gate:v3': 'node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('failure is swallowed');
  });

  it('fails when validators are guarded with non-trivial || chains', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'node scripts/validate-protected-areas.mjs || npm run gate:storage && node scripts/validate-storage-bundle.mjs || node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('failure is swallowed');
  });

  it('fails when one validator is echoed but others are real', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'echo "node scripts/validate-protected-areas.mjs" && node scripts/validate-storage-bundle.mjs && node scripts/validate-v3-gates.mjs',
    });
    expect(failures.join('\n')).toContain('missing protected-area validation coverage');
  });

  it('fails when gatekeeper workflow is missing gate:release command', () => {
    const failures = validateV3Gates({
      cwd: process.cwd(),
      packageJsonOverride: { scripts: { 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' } } as any,
      workflowOverride: { gatekeeper: 'jobs:\n  gatekeeper:\n    steps:\n      - run: npm ci', contracts: '- run: npm run test:contracts', build: '- run: npm run build' },
    });
    expect(failures.join('\n')).toContain('gatekeeper workflow missing npm run gate:release');
  });

  it('fails when gatekeeper run swallows failures', () => {
    const failures = validateV3Gates({
      cwd: process.cwd(),
      packageJsonOverride: { scripts: { 'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts', 'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs' } } as any,
      workflowOverride: { gatekeeper: 'jobs:\n  gatekeeper:\n    steps:\n      - run: npm run gate:release || true\n        env:\n          GITHUB_PR_NUMBER: 49', contracts: '- run: npm run test:contracts', build: '- run: npm run build' },
    });
    expect(failures.join('\n')).toContain('failure-swallowing');
  });

  it('passes repeated sibling script references', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:a && npm run gate:b',
      'gate:a': 'npm run gate:core',
      'gate:b': 'npm run gate:core',
      'gate:core': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs',
    });
    expect(failures).toEqual([]);
  });

});
