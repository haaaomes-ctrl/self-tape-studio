import { describe, it, expect } from "vitest";
import { enforcePublicReportOutputQuality } from "@/server/report-output-enforcement.server";

const fixed = { mode: "brief" as const, auditionType: "musical_theatre", framingFixed: true, materialPolicy: "fixed" as const };
const loose = { ...fixed, framingFixed: false };

describe("frame-break hardening", () => {
  const triggers = [
    "Practise the song while standing to sing.",
    "Try standing to sing the bridge.",
    "Record the song while standing.",
    "Hold an instrument for the verse.",
    "With an instrument in hand, attack the chorus.",
    "Add some stage business in the bridge.",
    "Try a physical task during the second verse.",
    "Use staging to lift the moment.",
    "Add blocking on the climax.",
  ];
  for (const t of triggers) {
    it(`rewrites when framingFixed=true: ${t}`, () => {
      const out = enforcePublicReportOutputQuality({ coaching_drills: [t] }, fixed);
      const step = (out.report.coaching_drills as string[])[0] ?? "";
      expect(step.toLowerCase()).toContain("rehearsal-only");
      expect(step).toMatch(/head-and-shoulders/);
    });
    it(`leaves alone when framingFixed=false: ${t}`, () => {
      const out = enforcePublicReportOutputQuality({ coaching_drills: [t] }, loose);
      expect(out.counters.framing_rehearsal_rewritten).toBe(0);
    });
  }
});
