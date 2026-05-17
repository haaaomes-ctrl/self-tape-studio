import { describe, expect, it } from 'vitest';
import { extractNpmRunTargets, validateV3Gates } from '../../../scripts/validate-v3-gates.mjs';

function runWithScripts(scripts: Record<string, string>) {
  const failures = validateV3Gates({ packageJsonOverride: { scripts } as any });
  return failures;
}

describe('validate-v3-gates script integrity', () => {
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
    expect(failures.join('\n')).toContain('gate:release missing v3 gate validation coverage');
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
    expect(failures.join('\n')).toContain('gate:release protected-area validator is present but failure is swallowed');
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

  it('does not infinite loop with recursive npm run references', () => {
    const failures = runWithScripts({
      'test:contracts': 'vitest run src/server/__tests__/v3-contracts.test.ts',
      'gate:release': 'npm run gate:a',
      'gate:a': 'npm run gate:b',
      'gate:b': 'npm run gate:a && node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs',
    });
    expect(failures).toEqual([]);
  });
});
