import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("timestamp density scaling", () => {
  const procSrc = read("src/server/process-take.server.ts");
  const polSrc = read("src/server/report-polish.server.ts");
  const evSrc = read("src/server/evidence-pass.server.ts");
  const s10PromptSrc = read("src/server/s10-report-prompt-map.server.ts");
  const promptSrc = `${procSrc}\n${polSrc}\n${evSrc}\n${s10PromptSrc}`;
  const viewSrc = read("src/components/report/V2ReportView.tsx");

  it("process prompt declares all five duration bands", () => {
    expect(promptSrc).toMatch(/under 60 seconds: 3.5/);
    expect(promptSrc).toMatch(/1.3 minutes: 6.10/);
    expect(promptSrc).toMatch(/3.5 minutes: 8.14/);
    expect(promptSrc).toMatch(/5.10 minutes: 12.24/);
    expect(promptSrc).toMatch(/10\+ minutes: 18.36/);
  });

  it("polish prompt declares duration bands and 36 max", () => {
    expect(polSrc).toMatch(/<60s 3.5/);
    expect(polSrc).toMatch(/10m\+ 18.36/);
  });

  it("evidence prompt requires Dance and MT coverage", () => {
    expect(evSrc).toMatch(/rhythm.timing/);
    expect(evSrc).toMatch(/acting-through-song/);
    expect(evSrc).toMatch(/3.5 min -> 8.14|3.5 minutes: 8.14/);
  });

  it("V2ReportView no longer slices timestamps to 8", () => {
    expect(viewSrc).not.toContain("tsNotes.slice(0, 8)");
    expect(viewSrc).toContain("tsNotes.slice(0, 36)");
  });
});

describe("Dance prompt depth", () => {
  const promptSrc = [
    read("src/server/process-take.server.ts"),
    read("src/server/report-polish.server.ts"),
    read("src/server/s10-report-prompt-map.server.ts"),
  ].join("\n");
  it("requires movement evidence vocabulary", () => {
    for (const tok of ["rhythm/timing", "control", "spatial", "dynamics", "performance"]) {
      expect(promptSrc).toContain(tok);
    }
  });
  it("forbids unanchored Dance phrases", () => {
    expect(promptSrc).toContain("high-energy movement");
    expect(promptSrc).toContain("clean lines");
    expect(promptSrc).toContain("rhythmic precision");
  });
});

describe("MT prompt depth", () => {
  const promptSrc = [
    read("src/server/process-take.server.ts"),
    read("src/server/report-polish.server.ts"),
    read("src/server/s10-report-prompt-map.server.ts"),
  ].join("\n");
  const polSrc = read("src/server/report-polish.server.ts");
  it("requires acting-through-song with lyric/phrase/beat/transition", () => {
    expect(promptSrc).toContain("acting-through-song");
    expect(promptSrc).toMatch(/lyric.phrase.beat.transition/);
    expect(polSrc).toContain("acting-through-song");
  });
  it("forbids castability/recall/workshop/live-room overclaim", () => {
    expect(promptSrc).toMatch(/castability\s*\/\s*recall\s*\/\s*workshop\s*\/\s*live-room/);
  });
});
