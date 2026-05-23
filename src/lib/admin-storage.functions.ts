import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildQAArtifactDownloadFilename, parseQAArtifactPath, stableCollisionSuffix } from "@/lib/admin-storage-utils";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { setResponseHeader } from "@tanstack/react-start/server";
import {
  assertAdminEmail,
  isAdminEmail,
  normalizeEmail,
} from "@/lib/admin-auth.server";

const BUCKET_NAME = "qa-artifacts";
const SIGNED_URL_TTL_SECONDS = 3600;
const ZIP_TMP_PREFIX = "admin-temp-zips";
const LEGACY_ZIP_TMP_PREFIX = "admin-zips";
const PAGE_SIZE = 1000;
const ZIP_TMP_TTL_MS = 2 * 60 * 60 * 1000;

export function isAdminZipTempPath(path: string): boolean {
  const normalized = path.replace(/^\/+/, '').replace(/^qa-artifacts\//, '');
  return normalized.startsWith(`${ZIP_TMP_PREFIX}/`) || normalized.startsWith(`${LEGACY_ZIP_TMP_PREFIX}/`);
}

export async function cleanupExpiredAdminZipsImpl(now = Date.now()) {
  const prefixes = [ZIP_TMP_PREFIX, LEGACY_ZIP_TMP_PREFIX];
  const failed: Array<{ path: string; error: string }> = [];
  const deleted: string[] = [];
  const candidates: string[] = [];
  for (const prefix of prefixes) {
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !data) {
        failed.push({ path: prefix, error: error?.message ?? "failed to list zip temp objects" });
        break;
      }
      const expired = data
        .filter((e) => e.id !== null)
        .map((e) => ({ name: e.name, updated_at: e.updated_at ?? null }))
        .filter((e) => {
          const t = e.updated_at ? Date.parse(e.updated_at) : NaN;
          return Number.isFinite(t) && now - t > ZIP_TMP_TTL_MS;
        })
        .map((e) => `${prefix}/${e.name}`);
      candidates.push(...expired);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  for (const path of candidates) {
    const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
    if (rmErr) failed.push({ path, error: rmErr.message });
    else deleted.push(path);
  }
  return { deleted, failed };
}


export type ArtifactEntry = {
  path: string;
  size: number;
  updated_at: string | null;
  lastModified: string | null;
  contentType: string | null;
  displayName: string;
  takeId: string | null;
  analysisRunId: string | null;
  comparisonRunId: string | null;
  artifactType: string;
};



export function assertAdminClaims(claims: { email?: string | null } | null | undefined) {
  assertAdminEmail(claims);
}

export async function listAllArtifactsImpl() {
  const results: ArtifactEntry[] = [];

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Response(`Failed to list bucket: ${error.message}`, { status: 500 });
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (isAdminZipTempPath(fullPath)) continue;
        if (entry.id === null) await walk(fullPath);
        else {
          const meta = (entry.metadata ?? {}) as { size?: number };
          const ids = parseQAArtifactPath(fullPath);
          results.push({
            path: fullPath, size: typeof meta.size === "number" ? meta.size : 0, updated_at: entry.updated_at ?? null,
            lastModified: entry.updated_at ?? null,
            contentType: typeof (entry.metadata as { mimetype?: unknown } | null)?.mimetype === "string" ? String((entry.metadata as { mimetype?: string }).mimetype) : null,
            displayName: buildQAArtifactDownloadFilename(fullPath),
            takeId: ids.takeId, analysisRunId: ids.analysisRunId, comparisonRunId: ids.comparisonRunId, artifactType: ids.artifactType,
          });
        }
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  await walk("");
  results.sort((a, b) => {
    const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
    const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
    if (tb !== ta) return tb - ta;
    return a.path.localeCompare(b.path);
  });
  return results;
}



export async function checkExactArtifactKeysImpl(paths: string[]) {
  const results: Array<{ path: string; exists: boolean; error: string | null }> = [];
  for (const objectPath of paths) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).createSignedUrl(objectPath, 60);
    if (error) {
      const msg = error.message ?? 'unknown';
      const notFound = /not\s*found|does not exist/i.test(msg);
      results.push({ path: objectPath, exists: false, error: notFound ? null : msg });
      continue;
    }
    results.push({ path: objectPath, exists: Boolean(data?.signedUrl), error: null });
  }
  return results;
}
export async function zipSelectedArtifactsImpl(paths: string[]) {
  await cleanupExpiredAdminZipsImpl();
  const { default: JSZip } = await import(/* @vite-ignore */ "jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const path of paths) {
    const { data: blob, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(path);
    if (error || !blob) throw new Response(`Failed to download for zip: ${error?.message ?? path}`, { status: 500 });
    let name = buildQAArtifactDownloadFilename(path);
    if (used.has(name)) {
      const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = ext ? name.slice(0, -ext.length) : name;
      name = `${base}__${stableCollisionSuffix(path)}${ext}`;
    }
    used.add(name);
    zip.file(name, await blob.arrayBuffer());
  }
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const zipArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const zipBlob = new Blob([zipArrayBuffer], { type: "application/zip" });
  const filename = `qa-artifacts-selected-${new Date().toISOString().replace(/[:.]/g, "")}.zip`;
  const expiresAt = new Date(Date.now() + ZIP_TMP_TTL_MS).toISOString();
  const objectPath = `${ZIP_TMP_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(objectPath, zipBlob, {
    contentType: "application/zip",
    upsert: false,
    metadata: { temp_zip: "true", expires_at: expiresAt },
  });
  if (uploadError) throw new Response(`Failed to stage zip: ${uploadError.message}`, { status: 500 });

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (signError || !signed?.signedUrl) throw new Response(`Failed to sign zip: ${signError?.message ?? "unknown"}`, { status: 500 });

  return {
    signedUrl: signed.signedUrl,
    filename,
    count: paths.length,
  };
}

export async function deleteSelectedArtifactsImpl(paths: string[]) {
  const results: Array<{ path: string; ok: boolean; error: string | null }> = [];
  for (const path of paths) {
    const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
    results.push({ path, ok: !error, error: error?.message ?? null });
  }
  return { results };
}
export const whoAmIAdmin = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {}
    const claims = (context as { claims?: { email?: string | null; sub?: string | null } }).claims;
    const claimsEmail = claims?.email ?? null;
    const normalized = normalizeEmail(claimsEmail);
    return {
      claimsEmail,
      normalizedEmail: normalized,
      isAdmin: isAdminEmail(claims),
      userId: claims?.sub ?? null,
    };
  });

export const listAllArtifacts = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {}

    await cleanupExpiredAdminZipsImpl();
    return listAllArtifactsImpl();
  });

const SignArtifactDownloadInput = z.object({
  path: z.string().min(1).max(1024),
});

export const signArtifactDownload = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => SignArtifactDownloadInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {}

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS, { download: buildQAArtifactDownloadFilename(data.path) });

    if (error || !signed?.signedUrl) {
      throw new Response(`Failed to sign URL: ${error?.message ?? "unknown error"}`, {
        status: 500,
      });
    }

    return { signedUrl: signed.signedUrl };
  });


const BulkPathsInput = z.object({
  paths: z.array(z.string().min(1).max(1024)).min(1).max(500),
});

export const zipSelectedArtifacts = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkPathsInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    return zipSelectedArtifactsImpl(data.paths);
  });

export const deleteSelectedArtifacts = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkPathsInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    return deleteSelectedArtifactsImpl(data.paths);
  });


const CheckExactArtifactKeysInput = z.object({
  paths: z.array(z.string().min(1).max(1024)).min(1).max(100),
});

export const checkExactArtifactKeys = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckExactArtifactKeysInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    try { setResponseHeader("Cache-Control", "no-store"); } catch {}
    return checkExactArtifactKeysImpl(data.paths);
  });
