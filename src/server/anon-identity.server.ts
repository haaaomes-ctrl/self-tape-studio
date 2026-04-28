// SERVER-ONLY: anonymous identity via signed, HTTP-only cookie.
//
// Anonymous users get a stable, server-signed `anon_id` (UUID) so we can
// enforce a lifetime cap on free-trial analyses. The id lives in an
// encrypted session cookie — clients cannot tamper with it or guess
// another visitor's id.
import { useSession } from "@tanstack/react-start/server";

const COOKIE_NAME = "selftape_anon";
// 1 year — long enough for the lifetime cap to be meaningful but bounded.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface AnonSessionData {
  anonId?: string;
}

function sessionConfig() {
  const password = process.env.ANON_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "ANON_SESSION_SECRET is missing or too short (min 32 chars). Anonymous quota cannot be enforced safely.",
    );
  }
  return {
    password,
    name: COOKIE_NAME,
    maxAge: MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

/**
 * Read the current anon_id without creating one.
 * Returns null if the visitor has no anon cookie yet.
 */
export async function readAnonId(): Promise<string | null> {
  const session = await useSession<AnonSessionData>(sessionConfig());
  return session.data.anonId ?? null;
}

/**
 * Read or mint the anon_id. Always returns a UUID and persists it on the
 * response via a signed cookie.
 */
export async function ensureAnonId(): Promise<string> {
  const session = await useSession<AnonSessionData>(sessionConfig());
  if (session.data.anonId) return session.data.anonId;

  const anonId = crypto.randomUUID();
  await session.update({ anonId });
  return anonId;
}
