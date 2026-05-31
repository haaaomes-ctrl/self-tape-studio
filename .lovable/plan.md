## S10-04 sender config correction

Add two runtime secrets via the secure secret form, then re-verify effective sender config. No source edits, no dispatcher state changes, no sends.

### Step 1 — Add secrets (user enters values in secure form)

Call `secrets--add_secret` for:
- `TAPECOACH_EMAIL_FROM` → user pastes: `TapeCoach <noreply@tapecoach.co.uk>`
- `TAPECOACH_EMAIL_SENDER_DOMAIN` → user pastes: `tapecoach.co.uk`

`EMAIL_DISPATCHER_FORCE_DISABLED` is not added (must remain unset).

### Step 2 — Re-verify (read-only)

- `secrets--fetch_secrets` → confirm both names present, `EMAIL_DISPATCHER_FORCE_DISABLED` still absent.
- `supabase--read_query` → confirm `dispatcher_mode` still `disabled` in `email_send_state`.
- Re-read `brevo.server.ts` `buildBrevoEmailFromQueuePayload` to confirm `TAPECOACH_EMAIL_FROM` is the override path consumed at runtime, and that `replyTo` is still not mapped from payload.

### Step 3 — Sanitized report

Return the exact yes/no checklist from the user message. No secret values displayed. Stop.

### Notes
- Secret values are stored encrypted; the agent never sees or echoes them. Effective-value confirmation is inferred from "secret present" + static code path, not by printing the value.
- `replyTo` mapping and template-ID/inline-html wiring are static code facts already established in Step 2 of the prior gate — re-confirmed by re-read, not by edit.
