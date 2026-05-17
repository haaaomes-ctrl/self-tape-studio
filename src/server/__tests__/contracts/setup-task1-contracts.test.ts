import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('setup task 1 contract scaffolding', () => {
  it('preserves blocked states in README', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toContain('Level 2 remains `not_accepted`');
    expect(readme).toContain('production-safe, public-scoring and public-technique-authority gates remain blocked');
  });

  it('documents required S9 12-file storage bundle', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toContain('manifest.json');
    expect(readme).toContain('qa/acceptance_metrics.json');
  });

  it('templates do not claim release approval from checks/codex/lovable', () => {
    const prTemplate = fs.readFileSync('.github/pull_request_template.md', 'utf8');
    expect(prTemplate).toContain('GitHub checks alone do not approve release.');
    expect(prTemplate).toContain('Codex completion alone does not approve release.');
    expect(prTemplate).toContain('Lovable publish alone does not approve release.');
  });
});
