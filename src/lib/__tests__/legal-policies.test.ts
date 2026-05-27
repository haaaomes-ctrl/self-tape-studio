import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGAL_POLICIES,
  LEGAL_POLICY_LINKS,
  LEGAL_POLICY_SLUGS,
  legalPolicyText,
} from "@/lib/legal-policies";

function readSource(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("legal policy surfaces", () => {
  it("defines all DS-02 policy pages and link targets", () => {
    expect(LEGAL_POLICY_SLUGS).toEqual([
      "terms",
      "privacy",
      "cookies",
      "ai-report-disclaimer",
      "refund-credit-policy",
    ]);

    expect(LEGAL_POLICY_LINKS.map((link) => link.to)).toEqual([
      "/legal/terms",
      "/legal/privacy",
      "/legal/cookies",
      "/legal/ai-report-disclaimer",
      "/legal/refund-credit-policy",
    ]);
  });

  it("covers AI, upload, credit, partner, parent and no-outcome requirements", () => {
    const allPolicyText = Object.values(LEGAL_POLICIES).map(legalPolicyText).join("\n\n");

    for (const required of [
      /AI-led self-tape critique/i,
      /video\/audio/i,
      /supplied brief\/context/i,
      /deleted from active media storage after report completion/i,
      /One TapeCoach credit equals one self-tape report/i,
      /Failed reports/i,
      /partner-funded credits/i,
      /parent\/guardian/i,
      /Under-13 standalone use is blocked/i,
      /Sponsors receive aggregate data only/i,
      /Schools and coaches may see named progress data only after partner-code activation/i,
      /QA artefacts/i,
      /does not guarantee casting, callback, booking, job, employment/i,
    ]) {
      expect(allPolicyText).toMatch(required);
    }
  });

  it("links policies from signup, footer and upload surfaces", () => {
    expect(readSource("src/components/account-route-fields.tsx")).toMatch(/LegalPolicyLink/);
    expect(readSource("src/components/site-footer.tsx")).toMatch(/LEGAL_POLICY_LINKS/);
    expect(readSource("src/routes/new.tsx")).toMatch(/UploadPolicyNotice/);
    expect(readSource("src/routes/audition.$auditionId.tsx")).toMatch(/UploadPolicyNotice/);
  });
});
