import { describe, it, expect } from "vitest";
import {
  validateAnchor,
  validateClaim,
  validateComponent,
} from "@/server/dimensions/shared";
import { ACTING_KEYS } from "@/server/dimensions/acting";
import {
  buildDimensionsPromptFragment,
  validateFutureComponents,
} from "@/server/dimensions";

describe("dimensions/shared", () => {
  it("validateAnchor accepts a well-formed anchor", () => {
    const a = validateAnchor(
      {
        id: "a1",
        kind: "timestamp",
        timestamp: "00:12",
        note: "Strong opening eye-line.",
        supports: ["objective_action"],
      },
      ACTING_KEYS,
      120,
    );
    expect(a).not.toBeNull();
    expect(a!.id).toBe("a1");
  });

  it("validateAnchor rejects unknown kind / unsupported dimension key", () => {
    expect(
      validateAnchor(
        { id: "a1", kind: "vibes", note: "x", supports: ["objective_action"] },
        ACTING_KEYS,
      ),
    ).toBeNull();
    expect(
      validateAnchor(
        { id: "a1", kind: "timestamp", note: "x", supports: ["nope"] },
        ACTING_KEYS,
      ),
    ).toBeNull();
  });

  it("validateAnchor drops bad timestamp", () => {
    expect(
      validateAnchor(
        {
          id: "a1",
          kind: "timestamp",
          timestamp: "99:99",
          note: "x",
          supports: ["objective_action"],
        },
        ACTING_KEYS,
        60,
      ),
    ).toBeNull();
  });

  it("validateClaim requires anchor support for populated claims", () => {
    expect(
      validateClaim(
        { value: "clear", confidence: "medium", supports: [] },
        new Set(),
      ),
    ).toBeNull();
    expect(
      validateClaim(
        { value: "clear", confidence: "medium", supports: ["a1"] },
        new Set(["a1"]),
      ),
    ).not.toBeNull();
  });

  it("validateClaim allows null/unknown without anchors", () => {
    const c = validateClaim(
      { value: null, confidence: "low", supports: [] },
      new Set(),
    );
    expect(c).not.toBeNull();
    expect(c!.value).toBeNull();
  });
});

describe("dimensions/acting validateComponent", () => {
  const good = {
    type: "acting_scene",
    confidence: "medium",
    assessability: { component_assessable: true },
    evidence_anchors: [
      {
        id: "a1",
        kind: "timestamp",
        timestamp: "00:30",
        note: "Lands the question.",
        supports: ["objective_action"],
      },
    ],
    dimensions: {
      objective_action: { value: "wants reassurance", confidence: "medium", supports: ["a1"] },
      style_unknown_field_ignored: { value: "x", confidence: "low", supports: ["a1"] },
    },
  };

  it("accepts a valid acting component and ignores unknown dimension keys", () => {
    const c = validateComponent(good, ACTING_KEYS, 120);
    expect(c).not.toBeNull();
    expect(c!.dimensions.objective_action?.value).toBe("wants reassurance");
    expect(c!.dimensions.style_unknown_field_ignored).toBeUndefined();
  });

  it("drops a populated dimension whose anchors are missing", () => {
    const bad = {
      ...good,
      evidence_anchors: [],
      dimensions: {
        objective_action: { value: "x", confidence: "medium", supports: [] },
      },
    };
    const c = validateComponent(bad, ACTING_KEYS, 120);
    expect(c).not.toBeNull();
    expect(c!.dimensions.objective_action).toBeNull();
  });
});

describe("dimensions registry", () => {
  it("buildDimensionsPromptFragment lists every discipline", () => {
    const p = buildDimensionsPromptFragment();
    expect(p).toMatch(/acting_scene dimensions/);
    expect(p).toMatch(/monologue dimensions/);
    expect(p).toMatch(/song dimensions/);
    expect(p).toMatch(/voice dimensions/);
    expect(p).toMatch(/musical_theatre dimensions/);
    expect(p).toMatch(/dance dimensions/);
    expect(p).toMatch(/commercial dimensions/);
    expect(p).toMatch(/slate dimensions/);
    expect(p).toMatch(/FUTURE COMPONENT EVIDENCE/);
  });

  it("validateFutureComponents drops unknown component types", () => {
    const r = validateFutureComponents(
      [
        { type: "alien_form", dimensions: {}, evidence_anchors: [] },
        {
          type: "slate",
          confidence: "high",
          assessability: {},
          evidence_anchors: [
            {
              id: "s1",
              kind: "component_note",
              note: "Slate is clear and audible.",
              supports: ["slate_clarity"],
            },
          ],
          dimensions: {
            slate_clarity: { value: "clear", confidence: "high", supports: ["s1"] },
          },
        },
      ],
      120,
    );
    expect(r.dropped).toBe(1);
    expect(r.components).toHaveLength(1);
    expect(r.components[0].type).toBe("slate");
  });

  it("validateFutureComponents tolerates malformed top-level input", () => {
    expect(validateFutureComponents(null).components).toEqual([]);
    expect(validateFutureComponents("nope").malformed).toBe(true);
    expect(validateFutureComponents([]).components).toEqual([]);
  });
});

describe("MT acting_through_song capturable", () => {
  it("MT component can carry an acting_through_song claim with anchor", async () => {
    const { validateMtComponent } = await import("@/server/dimensions/mt");
    const c = validateMtComponent(
      {
        type: "musical_theatre",
        confidence: "medium",
        assessability: {},
        evidence_anchors: [
          {
            id: "m1",
            kind: "lyric_observation",
            timestamp: "01:42",
            note: "Lyric pivot lands a fresh thought.",
            supports: ["acting_through_song"],
          },
        ],
        dimensions: {
          acting_through_song: { value: "present", confidence: "medium", supports: ["m1"] },
        },
      },
      240,
    );
    expect(c).not.toBeNull();
    expect(c!.dimensions.acting_through_song?.value).toBe("present");
  });
});
