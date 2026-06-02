import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseAdminRuntimeConfigError,
  type SupabaseAdminRuntimeDiagnostics,
} from "@/integrations/supabase/client.server";
import { describeUploadError } from "@/lib/upload-errors";
import {
  MuxRuntimeConfigError,
  resolveMuxRuntimeConfig,
  type MuxRuntimeDiagnostics,
} from "@/server/mux.server";
import { normaliseUploadError } from "@/server-fns/mux-upload.impl.server";

describe("Mux upload cutover safe errors", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects missing Mux env without exposing token values", () => {
    const out = resolveMuxRuntimeConfig({});
    expect(out).toMatchObject({
      tokenId: null,
      tokenSecret: null,
      diagnostics: {
        mux_token_id_present: false,
        mux_token_secret_present: false,
      },
    });

    const error = normaliseUploadError(
      new MuxRuntimeConfigError(out.diagnostics as MuxRuntimeDiagnostics),
      { takeId: "take-1", userId: "user-1" },
    );
    expect(error.message).toMatch(/^mux_config_missing:/);
    expect(describeUploadError(error)).toMatchObject({
      kind: "config",
      message: "Video service is not configured. Please contact support.",
    });
  });

  it("returns server_supabase_misconfigured when admin Supabase env is absent", () => {
    const diagnostics: SupabaseAdminRuntimeDiagnostics = {
      supabase_url_configured: false,
      supabase_url_host: null,
      supabase_service_role_key_configured: false,
    };
    const error = normaliseUploadError(new SupabaseAdminRuntimeConfigError(diagnostics), {
      takeId: "take-1",
      userId: "user-1",
    });

    expect(error.message).toMatch(/^server_supabase_misconfigured:/);
    expect(describeUploadError(error)).toMatchObject({
      kind: "server_config",
    });
  });

  it("maps Mux upload failures and prerequisite failures to safe non-generic messages", () => {
    expect(
      describeUploadError(new Error("mux_upload_failed: Mux rejected the upload request.")),
    ).toMatchObject({
      kind: "mux",
      message: "Mux rejected the upload request.",
    });
    expect(
      describeUploadError(
        new Error("upload_prerequisite_missing: We could not prepare this upload."),
      ),
    ).toMatchObject({
      kind: "prerequisite",
      message: "We could not prepare this upload.",
    });
  });
});
