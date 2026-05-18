import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateTaskState } from "../../scripts/orchestrator/validate-task-state.mjs";

const validState = {
  task_id: "TASK-1",
  task_name: "Linear task",
  branch: "xops/task-1",
  pr_link: "https://github.com/example/repo/pull/1",
  source_hierarchy_checked: ["README.md", "AGENTS.md", "docs/tapecoach/v3/orchestrator/linear/**"],
  chatgpt_prompt_issued_to_codex: "Prompt text",
  operator_manual_codex_run_required: true,
  codex_task_status: "complete",
  codex_summary: "Summary text",
  chatgpt_decision_after_summary: "create_pr",
  pr_creation_status: "created",
  pr_review_has_begun: true,
  review_cycles: [
    {
      round_number: 1,
      review_requested_at: "2026-05-18T00:00:00Z",
      reviewer_source: "Codex PR review",
      review_result: "no_findings",
      bugs_found: [],
      p0_findings: [],
      p1_findings: [],
      p2_findings: [],
      chatgpt_triage_decision: "merge_candidate",
      codex_fix_prompt: "",
      codex_fix_summary: "",
      github_checks_after_fix: "passed",
      continue_review_required: false
    }
  ],
  github_checks_status: "passed",
  deferred_items: [],
  operator_verification_required_items: [],
  merge_recommendation: true,
  merge_status: "operator_required",
  next_task_recommendation: "Pull latest main and start next task.",
  blocked_states: {
    level_2: "not_accepted",
    production_safe: "blocked",
    public_scoring: "blocked",
    public_technique_authority: "blocked",
    comparison_public_winner: "blocked",
    customer_facing_release: "blocked"
  }
};

function cloneWith(patch) {
  return {
    ...structuredClone(validState),
    ...patch
  };
}

describe("validateTaskState", () => {
  it("passes valid task state", () => {
    expect(validateTaskState(validState)).toEqual({ ok: true, errors: [] });
  });

  it("fails when task ID is missing", () => {
    const result = validateTaskState(cloneWith({ task_id: "" }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing required field: task_id");
  });

  it("fails when source hierarchy is missing", () => {
    const result = validateTaskState(cloneWith({ source_hierarchy_checked: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("source_hierarchy_checked must record checked sources");
  });

  it("fails when review cycle is missing once PR review has begun", () => {
    const result = validateTaskState(cloneWith({ pr_review_has_begun: true, review_cycles: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("review_cycles must not be empty once PR review has begun");
  });

  it("fails merge recommendation when P0 is present", () => {
    const state = cloneWith({
      review_cycles: [{ ...validState.review_cycles[0], p0_findings: ["P0 bug"] }]
    });
    const result = validateTaskState(state);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("merge_recommendation cannot be true while P0 findings remain");
  });

  it("fails merge recommendation when P1 is present", () => {
    const state = cloneWith({
      review_cycles: [{ ...validState.review_cycles[0], p1_findings: ["P1 bug"] }]
    });
    const result = validateTaskState(state);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("merge_recommendation cannot be true while P1 findings remain");
  });

  it("fails merge recommendation when latest review requires another review", () => {
    const state = cloneWith({
      review_cycles: [{ ...validState.review_cycles[0], continue_review_required: true }]
    });
    const result = validateTaskState(state);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "merge_recommendation cannot be true while latest review requires another review"
    );
  });

  it("fails merge recommendation when GitHub checks are not passed", () => {
    const result = validateTaskState(cloneWith({ github_checks_status: "failed" }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("merge_recommendation cannot be true unless GitHub checks are passed");
  });

  it("fails merge recommendation when blocked states are missing", () => {
    const result = validateTaskState(cloneWith({ blocked_states: {} }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("merge_recommendation requires blocked_states.level_2 to be not_accepted");
  });

  it("allows P2-only findings to be deferred", () => {
    const state = cloneWith({
      review_cycles: [
        {
          ...validState.review_cycles[0],
          p2_findings: ["P2 follow-up"],
          chatgpt_triage_decision: "defer"
        }
      ],
      deferred_items: ["P2 follow-up"]
    });
    expect(validateTaskState(state)).toEqual({ ok: true, errors: [] });
  });

  it("does not expose an automatic merge action", () => {
    const script = readFileSync("scripts/orchestrator/validate-task-state.mjs", "utf8");
    expect(script).not.toMatch(/mergePullRequest|merge_pull_request|git merge|auto.?merge/i);
  });

  it("does not attempt external API calls", () => {
    const script = readFileSync("scripts/orchestrator/validate-task-state.mjs", "utf8");
    expect(script).not.toMatch(/fetch\(|https?:|@octokit|openai|lovable|supabase/i);
  });

  it("returns structured JSON output from the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "tapecoach-task-state-"));
    const file = join(dir, "state.json");
    writeFileSync(file, JSON.stringify(validState), "utf8");

    const result = spawnSync(process.execPath, ["scripts/orchestrator/validate-task-state.mjs", file], {
      encoding: "utf8"
    });

    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, errors: [] });
  });
});
