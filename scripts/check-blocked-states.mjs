import fs from 'node:fs';

const contractPath = new URL('../src/server/v3/contracts/setup-task1-release-state-contract.ts', import.meta.url);
const source = fs.readFileSync(contractPath, 'utf8');

const expected = {
  level2_status: 'not_accepted',
  production_safe_status: 'blocked',
  public_scoring_status: 'blocked',
  public_technique_authority_status: 'blocked',
  comparison_public_winner_status: 'blocked',
  customer_facing_release_status: 'blocked',
};

function readValue(key) {
  const match = source.match(new RegExp(`${key}:\\s*'([^']+)'`));
  return match?.[1];
}

const mismatches = [];
for (const [key, value] of Object.entries(expected)) {
  const actual = readValue(key);
  if (!actual) mismatches.push({ key, issue: 'missing' });
  else if (actual !== value) mismatches.push({ key, expected: value, actual });
}

if (mismatches.length) {
  console.error(
    JSON.stringify({ ok: false, code: 'setup_task1_blocked_state_contract_mismatch', runtimeValidated: false, mismatches }, null, 2),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({ ok: true, code: 'setup_task1_blocked_state_contract_verified', runtimeValidated: false, contractPath: contractPath.pathname }),
);
