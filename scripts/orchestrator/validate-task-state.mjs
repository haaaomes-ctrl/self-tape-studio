#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const requiredTopLevelFields = [
  "task_id",
  "task_name",
  "branch",
  "source_hierarchy_checked",
  "chatgpt_prompt_issued_to_codex",
  "operator_manual_codex_run_required",
  "codex_task_status",
  "chatgpt_decision_after_summary",
  "pr_creation_status",
  "review_cycles",
  "github_checks_status",
  "deferred_items",
  "operator_verification_required_items",
  "merge_recommendation",
  "merge_status",
  "next_task_recommendation",
  "blocked_states"
];

const requiredBlockedStates = {
  level_2: "not_accepted",
  production_safe: "blocked",
  public_scoring: "blocked",
  public_technique_authority: "blocked",
  comparison_public_winner: "blocked",
  customer_facing_release: "blocked"
};

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function validateTaskState(state) {
  const errors = [];

  for (const field of requiredTopLevelFields) {
    if (!hasValue(state[field])) {
      errors.push(`missing required field: ${field}`);
    }
  }

  if (!Array.isArray(state.source_hierarchy_checked) || state.source_hierarchy_checked.length === 0) {
    errors.push("source_hierarchy_checked must record checked sources");
  }

  if (state.operator_manual_codex_run_required !== true) {
    errors.push("operator_manual_codex_run_required must be true");
  }

  if (!Array.isArray(state.review_cycles)) {
    errors.push("review_cycles must be an array");
  }

  const reviewHasBegun =
    state.pr_review_has_begun === true ||
    state.pr_creation_status === "created" ||
    (typeof state.pr_link === "string" && state.pr_link.length > 0);

  if (reviewHasBegun && Array.isArray(state.review_cycles) && state.review_cycles.length === 0) {
    errors.push("review_cycles must not be empty once PR review has begun");
  }

  if (state.merge_recommendation === true) {
    const cycles = Array.isArray(state.review_cycles) ? state.review_cycles : [];
    const openP0 = cycles.flatMap((cycle) => cycle.p0_findings ?? []);
    const openP1 = cycles.flatMap((cycle) => cycle.p1_findings ?? []);
    const latestCycle = cycles.at(-1);

    if (openP0.length > 0) {
      errors.push("merge_recommendation cannot be true while P0 findings remain");
    }

    if (openP1.length > 0) {
      errors.push("merge_recommendation cannot be true while P1 findings remain");
    }

    if (!latestCycle) {
      errors.push("merge_recommendation requires at least one review cycle");
    } else if (latestCycle.continue_review_required === true) {
      errors.push("merge_recommendation cannot be true while latest review requires another review");
    }

    if (state.github_checks_status !== "passed") {
      errors.push("merge_recommendation cannot be true unless GitHub checks are passed");
    }

    for (const [field, expected] of Object.entries(requiredBlockedStates)) {
      if (state.blocked_states?.[field] !== expected) {
        errors.push(`merge_recommendation requires blocked_states.${field} to be ${expected}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    const result = {
      ok: false,
      errors: ["usage: node scripts/orchestrator/validate-task-state.mjs <task-state.json>"]
    };
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const state = JSON.parse(readFileSync(filePath, "utf8"));
    const result = validateTaskState(state);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          errors: [`failed to read or parse task state: ${error.message}`]
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { validateTaskState };
