import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260523120500_security_rls_authenticated_only_alignment.sql",
);

describe("database security contract", () => {
  it("documents anon_id as deprecated and enforces authenticated ownership", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("COMMENT ON COLUMN public.auditions.anon_id");
    expect(sql).toContain("COMMENT ON COLUMN public.takes.anon_id");
    expect(sql).toContain("Anonymous submissions are no longer supported");
    expect(sql).toContain("IF NEW.user_id IS NULL THEN");
    expect(sql).toContain("IF NEW.anon_id IS NOT NULL THEN");
    expect(sql).toContain("Authenticated user_id is required");
    expect(sql).toContain("anon_id is deprecated");
    expect(sql).not.toMatch(/CREATE\s+POLICY[^;]+anon_id/is);
  });

  it("uses explicit deny-all policies for service-role-only tables", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const table of ["take_qa_traces", "app_config"]) {
      for (const operation of ["select", "insert", "update", "delete"]) {
        expect(sql).toContain(`"${table} deny all ${operation}"`);
      }
    }

    expect(sql).toContain("ON public.take_qa_traces FOR SELECT");
    expect(sql).toContain("ON public.app_config FOR SELECT");
    expect(sql).toMatch(/USING \(false\)/);
    expect(sql).toMatch(/WITH CHECK \(false\)/);
    expect(sql).toContain("Service-role only");
  });

  it("keeps qa-artifacts private and blocks direct client storage access", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("VALUES ('qa-artifacts', 'qa-artifacts', false)");
    expect(sql).toContain("SET public = false");

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`"qa_artifacts deny all ${operation}"`);
    }

    expect(sql).toContain("bucket_id = 'qa-artifacts' AND false");
    expect(sql).toContain("signed admin downloads only");
  });

  it("keeps README aligned with authenticated-only and internal QA access", async () => {
    const readme = await readFile(path.join(process.cwd(), "README.md"), "utf8");
    const qaDocs = await readFile(
      path.join(process.cwd(), "docs/tapecoach/v3/QA_ARTEFACT_EMITTERS.md"),
      "utf8",
    );

    expect(readme).toContain("TapeCoach is an authenticated-user application");
    expect(readme).toContain("anon_id");
    expect(readme).toContain("deprecated compatibility fields only");
    expect(readme).toContain("explicit deny-all policies");
    expect(qaDocs).toContain("internal-only");
    expect(qaDocs).toContain("Explicit deny-all policies are intentional");
  });
});
