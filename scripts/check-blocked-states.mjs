import { readStaticExportedConstObject } from './read-static-ts-contract.mjs';

const contractPath = new URL('../src/server/v3/contracts/setup-task1-release-state-contract.ts', import.meta.url).pathname;

function fail(code, details) {
  console.error(JSON.stringify({ ok: false, code, runtimeValidated: false, ...details }, null, 2));
  process.exit(1);
}

let contract;
try {
  contract = readStaticExportedConstObject({ filePath: contractPath, exportName: 'setupTask1ReleaseStateContract' });
} catch (error) {
  fail('setup_task1_blocked_state_contract_parse_error', { message: String(error.message || error) });
}

const expected = {
  level2_status: 'not_accepted',
  production_safe_status: 'blocked',
  public_scoring_status: 'blocked',
  public_technique_authority_status: 'blocked',
  comparison_public_winner_status: 'blocked',
  customer_facing_release_status: 'blocked',
};

const mismatches = [];
for (const [key, value] of Object.entries(expected)) {
  if (!(key in contract)) mismatches.push({ key, issue: 'missing' });
  else if (contract[key] !== value) mismatches.push({ key, expected: value, actual: contract[key] });
}

if (mismatches.length) {
  fail('setup_task1_blocked_state_contract_mismatch', { mismatches });
}

console.log(JSON.stringify({ ok: true, code: 'setup_task1_blocked_state_contract_verified', runtimeValidated: false, contractPath }));
