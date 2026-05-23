import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const checkpointPath = path.join(process.cwd(), "docs/tapecoach/v3/r10/r10-7-canary-checkpoint.md");

const checkpoint = readFileSync(checkpointPath, "utf8");

describe("R10.7 canary checkpoint report", () => {
  it("records README control, branch, baseline and operator verification status", () => {
    expect(checkpoint).toContain("`README.md` remains");
    expect(checkpoint).toContain("must not override README");
    expect(checkpoint).toContain("codex/r10-readiness-first-report-shell");
    expect(checkpoint).toContain("0a04e1c Implement R10.6 usefulness review loop");
    expect(checkpoint).toContain("operator_verification_required");
  });

  it("truthfully records that live runtime, dev-server verification and canary were not run", () => {
    expect(checkpoint).toMatch(/\|\s*Live runtime run\s*\|\s*No\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Dev-server verification run\s*\|\s*No\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Canary run\s*\|\s*No\s*\|/);
    expect(checkpoint).toContain("Not run; no pass claimed");
    expect(checkpoint).toContain("It is not a canary pass");
  });

  it("documents why local runtime access was unavailable without exposing secrets", () => {
    expect(checkpoint).toContain("does not expose a canary command");
    expect(checkpoint).toContain("Secret values were not printed or copied");
    for (const key of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "MUX_TOKEN_ID",
      "MUX_TOKEN_SECRET",
      "QA_ARTIFACT_SINK",
      "V3_QA_ARTIFACTS_ENABLED",
      "INTERNAL_QA_EMIT",
    ]) {
      expect(checkpoint).toContain(key);
    }
    expect(checkpoint).not.toMatch(/https?:\/\/|signature=|x-amz-|secret-token/i);
  });

  it("includes operator steps, existing fixture IDs and expected artefact paths", () => {
    expect(checkpoint).toContain("git checkout codex/r10-readiness-first-report-shell");
    expect(checkpoint).toContain("git rev-parse HEAD");
    for (const fixtureId of [
      "GF-03",
      "GF-06",
      "GF-12",
      "GF-20",
      "GF-15",
      "GF-16",
      "GF-18",
      "GF-19",
      "GF-01",
      "RT-15",
    ]) {
      expect(checkpoint).toContain(fixtureId);
    }
    for (const artefactPath of [
      "manifest.json",
      "qa/acceptance_metrics.json",
      "reports/render_payload.json",
      "reports/public_report_payload.json",
      "parity/report_parity_result.json",
      "export_or_no_export/no_export_proof.json",
      "traces/ValidatorTrace.json",
      "traces/GateTrace.json",
      "reports/raw_report.json",
    ]) {
      expect(checkpoint).toContain(artefactPath);
    }
  });

  it("covers every required canary check area", () => {
    const areas = [
      "A. Public report rendering",
      "B. Professional decision-support model",
      "C. Fix hierarchy",
      "D. Brief-first value",
      "E. Public/private leakage",
      "F. Payload parity",
      "G. No-export proof",
      "H. QA spine and gates",
      "I. R10.6 review handoff",
    ];
    for (const area of areas) {
      expect(checkpoint).toContain(area);
    }
  });

  it("lists the public-safe R10 report fields to verify", () => {
    const fields = [
      "schema_version",
      "submission_verdict",
      "why_this_verdict",
      "fix_first",
      "priority_fixes",
      "must_fix_before_submitting",
      "should_improve_if_retaking",
      "optional_polish",
      "strengths",
      "preserve",
      "do_not_overfix",
      "next_take_plan",
      "feedback_reliability",
      "brief_requirements",
      "brief_achievement",
      "not_assessable",
    ];
    for (const field of fields) {
      expect(checkpoint).toContain(field);
    }
    expect(checkpoint).toContain("Unknown upstream fields must not pass through");
    expect(checkpoint).toContain(
      "Nested private keys inside allowed object fields must be stripped",
    );
  });

  it("preserves severity handling and blocked gate posture", () => {
    for (const severity of ["P0", "P1", "P2", "P3/design preference"]) {
      expect(checkpoint).toContain(severity);
    }
    expect(checkpoint).toContain("P0/P1 findings must be fixed immediately");
    expect(checkpoint).toMatch(/\|\s*Global Level 2\s*\|\s*`not_accepted`\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Production-safe status\s*\|\s*`blocked`\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Customer release\s*\|\s*`blocked`\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Public scoring\s*\|\s*`blocked`\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Public named technique authority\s*\|\s*`blocked`\s*\|/);
    expect(checkpoint).toMatch(/\|\s*Public comparison recommendation\s*\|\s*`blocked`\s*\|/);
    expect(checkpoint).toContain(
      "does not approve customer release, production-safe status, Level 2 acceptance, public scoring, public named technique authority or public comparison recommendation",
    );
  });

  it("keeps historical artefacts scoped and uses UK English", () => {
    expect(checkpoint).toContain("Historical S9 runtime JSONs used");
    expect(checkpoint).toContain(
      "historical S9 artefacts remain examples or regression evidence only",
    );
    expect(checkpoint).toContain("behaviour");
    expect(checkpoint).not.toMatch(/\bbehavior\b/i);
  });

  it("does not contain positive blocked public claims or public-gate approval language", () => {
    expect(checkpoint).not.toMatch(
      /\b(?:customer release|production-safe|level 2|public scoring|public named technique authority|public comparison)\s+(?:is\s+)?(?:approved|accepted|passed)\b/i,
    );
    expect(checkpoint).not.toMatch(
      /\b(?:highly castable for|bookable for the role|marketable performer with commercial look|role-fit approved|will get a recall|guaranteed job offer)\b/i,
    );
  });
});
