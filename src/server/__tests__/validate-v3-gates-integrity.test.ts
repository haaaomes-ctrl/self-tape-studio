import { describe, expect, it } from 'vitest';
import { validateV3Gates } from '../../../scripts/validate-v3-gates.mjs';

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
