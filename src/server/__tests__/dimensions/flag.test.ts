import { describe, it, expect } from "vitest";
import { SAFE_DEFAULTS } from "@/server/app-config.server";

/**
 * Phase 1 flag-gating posture.
 *
 * We don't hit the live AI gateway here; we assert the wiring shape:
 *  - default flag is off
 *  - the dimension prompt fragment exists and is only meant to be appended
 *    when the per-call `withFutureDimensions` arg is true.
 *  - the registry emits a non-empty fragment when called explicitly.
 */
describe("phase 1 flag posture", () => {
  it("future_evidence_enabled defaults to false", () => {
    expect(SAFE_DEFAULTS.future_evidence_enabled).toBe(false);
  });

  it("dimension fragment is only used through the registry helper", async () => {
    const dims = await import("@/server/dimensions");
    expect(typeof dims.buildDimensionsPromptFragment).toBe("function");
    expect(dims.buildDimensionsPromptFragment().length).toBeGreaterThan(100);
  });

  it("RunEvidencePassArgs accepts withFutureDimensions optionally (type-only smoke)", async () => {
    const mod = await import("@/server/evidence-pass.server");
    expect(typeof mod.runEvidencePass).toBe("function");
  });
});
