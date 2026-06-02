import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() =>
  vi.fn((url: string, key: string, options: unknown) => ({ url, key, options })),
);

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import {
  createSupabaseAdminClientForRuntimeEnv,
  resolveSupabaseAdminRuntimeConfig,
  setSupabaseAdminRuntimeEnvResolver,
  SupabaseAdminRuntimeConfigError,
} from "./client.server";
import {
  resolveSupabasePublicRuntimeConfig,
  setSupabasePublicRuntimeEnvResolver,
} from "./public-runtime";

describe("Supabase env boundaries", () => {
  afterEach(() => {
    createClientMock.mockClear();
    setSupabaseAdminRuntimeEnvResolver(null);
    setSupabasePublicRuntimeEnvResolver(null);
    vi.unstubAllEnvs();
  });

  it("prefers TAPECOACH_SUPABASE server env names for the admin client", () => {
    const env = {
      TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "owned-service-role",
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    };

    expect(resolveSupabaseAdminRuntimeConfig(env)).toMatchObject({
      supabaseUrl: "https://owned-project.supabase.co",
      serviceRoleKey: "owned-service-role",
      diagnostics: {
        supabase_url_configured: true,
        supabase_url_host: "owned-project.supabase.co",
        supabase_service_role_key_configured: true,
      },
    });

    expect(createSupabaseAdminClientForRuntimeEnv(env)).toMatchObject({
      url: "https://owned-project.supabase.co",
      key: "owned-service-role",
    });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://owned-project.supabase.co",
      "owned-service-role",
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      }),
    );
  });

  it("falls back to legacy SUPABASE server env names when TAPECOACH names are absent", () => {
    const env = {
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    };

    expect(resolveSupabaseAdminRuntimeConfig(env)).toMatchObject({
      supabaseUrl: "https://legacy-project.supabase.co",
      serviceRoleKey: "legacy-service-role",
      diagnostics: {
        supabase_url_configured: true,
        supabase_url_host: "legacy-project.supabase.co",
        supabase_service_role_key_configured: true,
      },
    });

    expect(createSupabaseAdminClientForRuntimeEnv(env)).toMatchObject({
      url: "https://legacy-project.supabase.co",
      key: "legacy-service-role",
    });
  });

  it("rejects mixed TapeCoach and legacy admin env pairs", () => {
    const env = {
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "owned-service-role",
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    };

    expect(resolveSupabaseAdminRuntimeConfig(env)).toMatchObject({
      supabaseUrl: null,
      serviceRoleKey: "owned-service-role",
      diagnostics: {
        supabase_url_configured: false,
        supabase_url_host: null,
        supabase_service_role_key_configured: true,
      },
    });

    expect(() => createSupabaseAdminClientForRuntimeEnv(env)).toThrow(
      SupabaseAdminRuntimeConfigError,
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("does not use public Vite URL as an admin fallback", () => {
    const env = {
      VITE_SUPABASE_URL: "https://public-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    };

    expect(resolveSupabaseAdminRuntimeConfig(env)).toMatchObject({
      supabaseUrl: null,
      serviceRoleKey: "legacy-service-role",
    });

    expect(() => createSupabaseAdminClientForRuntimeEnv(env)).toThrow(
      SupabaseAdminRuntimeConfigError,
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("uses TAPECOACH names from the request runtime env resolver", () => {
    setSupabaseAdminRuntimeEnvResolver(() => ({
      TAPECOACH_SUPABASE_URL: "https://runtime-owned.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "runtime-owned-service-role",
    }));

    expect(createSupabaseAdminClientForRuntimeEnv()).toMatchObject({
      url: "https://runtime-owned.supabase.co",
      key: "runtime-owned-service-role",
    });
  });

  it("keeps the browser client on public Vite env names only", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/integrations/supabase/client.ts"),
      "utf8",
    );

    expect(source).toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(source).toContain("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(source).not.toContain("SERVICE_ROLE");
    expect(source).not.toContain("TAPECOACH_SUPABASE");
    expect(source).not.toContain("process.env");
  });

  it("resolves server-side public Supabase auth config without service-role env", () => {
    const out = resolveSupabasePublicRuntimeConfig({
      VITE_SUPABASE_URL: "https://owned-public.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "owned-publishable",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used",
    } as Record<string, unknown>);

    expect(out).toMatchObject({
      supabaseUrl: "https://owned-public.supabase.co",
      publishableKey: "owned-publishable",
      diagnostics: {
        vite_supabase_url_configured: true,
        vite_supabase_url_host: "owned-public.supabase.co",
        vite_supabase_publishable_key_configured: true,
      },
    });
  });

  it("does not statically import the service-role admin client from client-imported modules", async () => {
    const clientImportedModules = [
      "src/lib/admin-storage.functions.ts",
      "src/server-fns/account-compliance.functions.ts",
      "src/server-fns/credit-balance.functions.ts",
      "src/server-fns/mux.functions.ts",
    ];

    for (const modulePath of clientImportedModules) {
      const source = await readFile(path.join(process.cwd(), modulePath), "utf8");

      expect(source).not.toMatch(
        /import\s+[^;]*from\s+["']@\/integrations\/supabase\/client\.server["']/,
      );
      expect(source).not.toContain("TAPECOACH_SUPABASE_SERVICE_ROLE_KEY");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
