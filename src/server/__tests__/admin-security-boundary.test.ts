import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertAdminEmail } from "@/lib/admin-auth.server";

const sourcePath = (relativePath: string) => path.join(process.cwd(), relativePath);
const previousAdminEmail = () => ({
  tapecoach: process.env.TAPECOACH_ADMIN_EMAIL,
  legacy: process.env.ADMIN_EMAIL,
});
const restoreAdminEmail = (previous: {
  tapecoach: string | undefined;
  legacy: string | undefined;
}) => {
  if (previous.tapecoach === undefined) delete process.env.TAPECOACH_ADMIN_EMAIL;
  else process.env.TAPECOACH_ADMIN_EMAIL = previous.tapecoach;
  if (previous.legacy === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = previous.legacy;
};
const expectForbidden = (fn: () => void) => {
  try {
    fn();
    throw new Error("expected forbidden response");
  } catch (err) {
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
  }
};

describe("admin security boundary", () => {
  it("keeps admin allowlist addresses out of public admin UI and whoAmI response shape", async () => {
    const forbiddenEmail = "o" + ".halawi90" + "@gmail.com";
    const routeSource = await readFile(
      sourcePath("src/routes/admin/storage-downloads.tsx"),
      "utf8",
    );
    const serverFnSource = await readFile(sourcePath("src/lib/admin-storage.functions.ts"), "utf8");

    expect(routeSource).not.toContain(forbiddenEmail);
    expect(serverFnSource).not.toContain(forbiddenEmail);
    expect(routeSource).not.toContain("expectedEmail");
    expect(serverFnSource).not.toContain("expectedEmail");
    expect(routeSource).toContain("authorised administrator account");
    expect(serverFnSource).toContain("isAdmin: isAdminEmail(claims)");
  });

  it("resolves admin access from server environment and fails closed when unset", () => {
    const previous = previousAdminEmail();
    try {
      delete process.env.TAPECOACH_ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;
      expectForbidden(() => assertAdminEmail({ email: "admin@example.test" }));

      process.env.TAPECOACH_ADMIN_EMAIL = "admin@example.test";
      expect(() => assertAdminEmail({ email: "admin@example.test" })).not.toThrow();
      expectForbidden(() => assertAdminEmail({ email: "other@example.test" }));
    } finally {
      restoreAdminEmail(previous);
    }
  });

  it("gates the Mux diagnostic probe before reading or fetching caller-supplied URLs", async () => {
    const source = await readFile(sourcePath("src/routes/api/public/diag-mux-probe.ts"), "utf8");
    const authIndex = source.indexOf("const denied = authorise(request);");
    const targetIndex = source.indexOf('const target = u.searchParams.get("url");');
    const fetchIndex = source.indexOf("await fetch(target");

    expect(authIndex).toBeGreaterThan(0);
    expect(targetIndex).toBeGreaterThan(authIndex);
    expect(fetchIndex).toBeGreaterThan(targetIndex);
    expect(source).toContain("RECONCILER_SECRET");
    expect(source).toContain('new Response("unauthorized", { status: 401');
    expect(source).toContain('new Response("not configured", { status: 503');
  });
});
