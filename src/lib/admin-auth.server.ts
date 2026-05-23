export function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function getConfiguredAdminEmail(): string | null {
  const value = process.env.TAPECOACH_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
  const normalized = normalizeEmail(value);
  return normalized || null;
}

export function isAdminEmail(claims: { email?: string | null } | null | undefined): boolean {
  const adminEmail = getConfiguredAdminEmail();
  return Boolean(adminEmail && normalizeEmail(claims?.email) === adminEmail);
}

export function assertAdminEmail(claims: { email?: string | null } | null | undefined) {
  if (!isAdminEmail(claims)) {
    throw new Response("Forbidden", { status: 403 });
  }
}
