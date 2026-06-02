import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
const getBucketMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/worker-entry", () => ({
  getRequestEnv: () => null,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

function healthyClient() {
  return {
    from: fromMock,
    storage: {
      getBucket: getBucketMock,
    },
    auth: {
      admin: {
        listUsers: listUsersMock,
      },
    },
  };
}

function request(secret = "health-secret", body: unknown = {}) {
  return new Request("https://tapecoach.test/api/internal/cutover-health", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const healthyEnv = {
  CUTOVER_HEALTH_SECRET: "health-secret",
  TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
  TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "owned-service-role-secret",
  VITE_SUPABASE_URL: "https://owned-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "owned-publishable",
  QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
  QA_ARTIFACT_SINK: "storage",
  MUX_TOKEN_ID: "mux-token-id",
  MUX_TOKEN_SECRET: "mux-token-secret",
  MUX_WEBHOOK_SECRET: "mux-webhook-secret",
};

describe("cutover health route", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getBucketMock.mockReset();
    listUsersMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockReturnValue(healthyClient());
    fromMock.mockImplementation(() => ({
      select: vi.fn((_columns: string, options?: { head?: boolean }) => {
        if (options?.head) return Promise.resolve({ data: null, error: null });
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { user_id: "user-1" }, error: null })),
          })),
        };
      }),
    }));
    getBucketMock.mockImplementation((bucket: string) =>
      Promise.resolve({ data: { id: bucket, name: bucket, public: false }, error: null }),
    );
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "user-1", email: "o.halawi90@gmail.com" }] },
      error: null,
    });
  });

  it("returns 401 when the cutover health secret is missing or wrong", async () => {
    const { handleCutoverHealthRequest } = await import("@/server/cutover-health.server");

    await expect(handleCutoverHealthRequest(request("wrong"), healthyEnv)).resolves.toMatchObject({
      status: 401,
    });
    await expect(
      handleCutoverHealthRequest(request("health-secret"), {
        ...healthyEnv,
        CUTOVER_HEALTH_SECRET: "",
      }),
    ).resolves.toMatchObject({ status: 401 });
  });

  it("returns healthy safe diagnostics without secret values", async () => {
    const { handleCutoverHealthRequest } = await import("@/server/cutover-health.server");
    const response = await handleCutoverHealthRequest(
      request("health-secret", { admin_email: "o.halawi90@gmail.com" }),
      healthyEnv,
    );
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      owned_supabase: {
        admin_client: "ok",
        project_host: "owned-project.supabase.co",
        tables: {
          auditions: "ok",
          takes: "ok",
          account_compliance: "ok",
          partner_package_presets: "ok",
        },
        storage: {
          "audition-videos": "ok",
          "qa-artifacts": "ok",
        },
      },
      secrets_present: {
        TAPECOACH_SUPABASE_URL: true,
        TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: true,
        MUX_TOKEN_ID: true,
        MUX_TOKEN_SECRET: true,
        MUX_WEBHOOK_SECRET: true,
      },
    });
    expect(raw).not.toContain("owned-service-role-secret");
    expect(raw).not.toContain("mux-token-secret");
    expect(raw).not.toContain("mux-webhook-secret");
    expect(raw).not.toContain("health-secret");
  });

  it("reports missing qa-artifacts bucket safely", async () => {
    const { handleCutoverHealthRequest } = await import("@/server/cutover-health.server");
    getBucketMock.mockImplementation((bucket: string) =>
      bucket === "qa-artifacts"
        ? Promise.resolve({ data: null, error: { message: "not found" } })
        : Promise.resolve({ data: { id: bucket, name: bucket, public: false }, error: null }),
    );

    const response = await handleCutoverHealthRequest(request("health-secret"), healthyEnv);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.owned_supabase.storage["qa-artifacts"]).toBe("missing");
    expect(body.errors).toContainEqual(
      expect.objectContaining({ code: "storage_bucket_missing", target: "qa-artifacts" }),
    );
  });
});
