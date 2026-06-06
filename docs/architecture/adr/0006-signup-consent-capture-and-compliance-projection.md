# ADR-0006: Signup Consent Capture and the Self-Healing Compliance Projection

## Status

Accepted (2026-06-05). Implemented across PRs #196 and #197. Complements
[ADR-0005](./0005-submission-quota-and-credit-model.md) (what governs usage);
this ADR records where consent lives and how the compliance gate reads it.

## Context

TapeCoach signups run with Supabase email confirmation enabled: `signUp`
returns a user but **no session** until the confirmation link is clicked.
Consent (account route, age-band declaration, policy acceptances, marketing
consent) is collected on the signup form — at a moment when no authenticated
server call is possible. The original flow tried an authenticated
`saveAccountCompliance` immediately after `signUp`; it always 401ed, the
`account_compliance` row was never created, and a freshly confirmed user was
re-shown the consent step despite having already consented (and worse, was
told nothing about the confirmation email at all).

For a product involving minors, the provenance of consent records is a
data-protection question, not a UX nicety. This ADR fixes the record of what
was decided.

## Decision

**1. `auth.users.raw_user_meta_data` is the durable signup-time consent
record.** The signup form's consent state is written at `signUp` via
`options.data` (`buildAccountComplianceAuthMetadata`, captured in
`src/routes/login.tsx`): `policy_versions` (terms/privacy/aiDisclaimer),
`age_band_declaration`, `account_route`, `parent_managed`,
`marketing_consent`. This write needs no session — Supabase Auth persists it
with the user record at creation. A failed post-signup table save is
therefore **not data loss**, and the signup toast says so honestly
("check your email"), instead of asking the user to redo the account route.

**2. The `account_compliance` table is a server-derived PROJECTION of that
record, not a second source of truth.** All writes go through the
service-role server layer (`upsertAccountComplianceForUser`, upsert ON
CONFLICT `user_id`). When the row is missing it is repaired **once** from the
caller's verified JWT claims (`repairMissingAccountComplianceFromClaims` →
`accountRouteFormStateFromAuthMetadata`,
`src/server/account-compliance.server.ts`) at exactly two points:

- the dashboard compliance read (`getCurrentUserAccountCompliance` server fn
  → `getAccountComplianceForUser`), so a confirmed user with recorded
  consent flows straight to the dashboard; and
- the upload-time gate (`assertAccountComplianceForReport`), retained as
  defence in depth.

**3. Invariants the repair must keep** (test-pinned in
`src/server/__tests__/account-compliance-self-heal.test.ts`):

- **Self-scoped**: the server fn takes no input; identity comes solely from
  the session middleware. It can never repair another user's row.
- **Idempotent / concurrent-safe**: the upsert conflicts on the `user_id`
  primary key; the dashboard read and upload gate may race freely.
- **Version bumps still re-prompt**: the repair runs only when NO row
  exists, and `accountRouteFormStateFromAuthMetadata` declines metadata
  whose policy versions are not current. A stale existing row is returned
  untouched — never rewritten to current versions. Re-acceptance of bumped
  policies always goes through the explicit consent UI.
- **Fail-soft reads**: a lookup error yields `null` → the guard re-prompts,
  which is the safe direction for a consent gate.

## Alternatives rejected

- **Client-side insert into `account_compliance`** (RLS owner-insert would
  technically allow it): moves a consent write to the client; the server
  repair path is version-checked and already existed.
- **`auth.users` trigger**: GoTrue inserts run as `supabase_auth_admin`,
  which requires SECURITY DEFINER/grant plumbing to touch app tables, fails
  silently when misconfigured, and adds nothing the lazy repair does not —
  the same reasoning that rejected a trigger for free-credit issuance
  (ADR-0005).

## Consequences

- The consent step appears exactly when it should: never for a confirmed
  user whose recorded consent matches current policy versions; always when
  consent is genuinely missing, incomplete, or stale.
- Anything consuming `account_compliance` (CRM contact sync, compliance
  gates) may rely on the row materialising at first authenticated read
  rather than at signup time.
- If signup metadata shape changes, `buildAccountComplianceAuthMetadata`
  (writer) and `accountRouteFormStateFromAuthMetadata` (reader) must move
  together — they are the two halves of the consent record contract.
