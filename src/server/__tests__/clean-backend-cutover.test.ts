import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("clean backend cutover assumptions", () => {
  it("creates qa-artifacts bucket idempotently without touching audition-videos", async () => {
    const sql = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260602120000_qa_artifacts_storage_bucket_foundation.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("INSERT INTO storage.buckets (id, name, public)");
    expect(sql).toContain("VALUES ('qa-artifacts', 'qa-artifacts', false)");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).not.toContain("audition-videos");
    expect(sql).not.toMatch(/\bUPDATE\s+storage\.buckets\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+storage\.buckets\b/i);
  });

  it("keeps clean audition/take bootstrap independent of imported legacy rows", async () => {
    const appConfig = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260501122107_292572b7-233b-428f-b39f-871d19e52df7.sql",
      ),
      "utf8",
    );
    const muxFoundation = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260428163646_aa891729-b4fc-4751-aa17-3d6fb9171235.sql",
      ),
      "utf8",
    );
    const newRoute = await readFile(path.join(process.cwd(), "src/routes/new.tsx"), "utf8");

    expect(appConfig).toContain("ON CONFLICT (id) DO NOTHING");
    expect(muxFoundation).toContain("ALTER COLUMN video_path DROP NOT NULL");
    expect(newRoute).toContain("video_path: null");
    expect(newRoute).toContain('mux_status: "uploading"');
  });

  it("renders account compliance UI when the dashboard compliance row is missing", async () => {
    const dashboard = await readFile(path.join(process.cwd(), "src/routes/dashboard.tsx"), "utf8");

    expect(dashboard).toContain("useAccountCompliance");
    expect(dashboard).toContain("!compliance.complete");
    expect(dashboard).toContain("AccountCompliancePanel");
  });
});
