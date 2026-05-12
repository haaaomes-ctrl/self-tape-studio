import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { setResponseHeader } from "@tanstack/react-start/server";

const ADMIN_EMAIL = "o.halawi90@gmail.com";
const BUCKET_NAME = "qa-artifacts";
const SIGNED_URL_TTL_SECONDS = 3600;
const PAGE_SIZE = 1000;

function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

function assertAdminEmail(claims: { email?: string | null } | null | undefined) {
  if (normalizeEmail(claims?.email) !== ADMIN_EMAIL) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export type ArtifactEntry = {
  path: string;
  size: number;
  updated_at: string | null;
};

export const listAllArtifacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {}

    const results: ArtifactEntry[] = [];

    async function walk(prefix: string): Promise<void> {
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .list(prefix, {
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
        if (error) {
          throw new Response(`Failed to list bucket: ${error.message}`, { status: 500 });
        }
        if (!data || data.length === 0) break;

        for (const entry of data) {
          const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          // Folders have id === null in supabase-js storage list
          if (entry.id === null) {
            await walk(fullPath);
          } else {
            const meta = (entry.metadata ?? {}) as { size?: number };
            results.push({
              path: fullPath,
              size: typeof meta.size === "number" ? meta.size : 0,
              updated_at: entry.updated_at ?? null,
            });
          }
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    await walk("");
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  });

const SignArtifactDownloadInput = z.object({
  path: z.string().min(1).max(1024),
});

export const signArtifactDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SignArtifactDownloadInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch {}

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS, { download: true });

    if (error || !signed?.signedUrl) {
      throw new Response(`Failed to sign URL: ${error?.message ?? "unknown error"}`, {
        status: 500,
      });
    }

    return { signedUrl: signed.signedUrl };
  });
