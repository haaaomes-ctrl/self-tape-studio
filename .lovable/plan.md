## What happened

Take `5e6bc13e-060c-4b86-8bcb-116aafc2d716` was created at **2026-05-06 11:18:47** with a Mux direct-upload URL. Its row hasn't been touched since `11:18:48` — `mux_status='uploading'`, `mux_asset_id=NULL`, `mux_playback_id=NULL`.

Mux's own event log shows the upload completed successfully ~an hour later (`video.upload.asset_created` 12:19:16, `video.asset.ready` 12:19:22, `video.asset.static_rendition.ready` 12:22:42) for playback id `YcDzNSgaLgKCaHWVzCqv2GAbAf02SYEFhWBydfWvFt01Y`.

The take row was never updated by any of those webhooks. Two failure modes are possible — both need checking:

1. **Mux webhook never delivered to us** (wrong URL configured in Mux, signature verification rejecting them, or Worker erroring before the handler logs). The MUX_WEBHOOK_SECRET / endpoint URL `https://tapecoach.co.uk/api/public/mux-webhook` (or the `.lovable.app` equivalent) needs verifying in the Mux dashboard's webhook settings.
2. **Reconciler isn't running.** `STALE_UPLOADING_MINUTES = 15` in `reconcile-stale-takes.ts` — this row should have been force-errored or recovered ~22 hours ago. Either pg_cron isn't calling the endpoint, or `RECONCILER_SECRET` is misconfigured. (The Lovable user can't query `cron.job` directly — needs a migration to inspect.)

## Plan

### Step 1 — Recover this take immediately

Since Mux still has the asset ready, the simplest fix is to backfill the take row using the known playback id, then schedule analysis. Two options:

- **A. SQL backfill** (no code, fastest): run a migration that updates the row with `mux_playback_id`, `mux_mp4_standard_url`, `mux_status='ready'`, `processing_phase='analysis_pending'`, then trigger `/api/public/reconcile-stale-takes` so it picks up the now-pending row and runs analysis. The duration must be fetched from Mux (a one-shot script via `mux.video.assets.retrieve(asset_id)`).
- **B. Curl the reconciler** with `STALE_UPLOADING_MINUTES` already long-since exceeded — `attemptTranscodingRecovery` will see `mux_upload_id` is present, fetch the upload → asset → playback id from Mux, backfill, and schedule. **No code change needed.** This is the cleaner option.

Recommended: **B**. We just need `RECONCILER_SECRET`'s value to call it.

### Step 2 — Find out why automatic recovery didn't happen

In parallel:

1. **Check Mux webhook delivery log** for this asset (in the Mux dashboard → Settings → Webhooks → recent deliveries). If they show 4xx/5xx responses to our endpoint, we have the smoking gun.
2. **Inspect pg_cron** via a one-off migration: `SELECT jobname, schedule, active, command FROM cron.job;` to confirm the reconciler is scheduled and points at the right URL.
3. Verify `MUX_WEBHOOK_SECRET` and `RECONCILER_SECRET` are both present (via secrets list) and the Mux webhook URL is `https://tapecoach.co.uk/api/public/mux-webhook` (or stable preview equivalent).

### Step 3 — Hardening (only if a defect is found)

No source-code change is proposed yet — the existing reconciler logic in `attemptTranscodingRecovery` already covers this exact case. Defects identified in Step 2 will determine the fix:

- Misconfigured webhook URL → update in Mux dashboard.
- Cron job missing/disabled → re-create via migration.
- Cron job calling wrong host (e.g. old preview URL that no longer routes) → migration to update the command.

## Questions before I proceed

1. Do you want me to **(B) curl the reconciler** to recover this take (requires `RECONCILER_SECRET` — I can read it via `secrets--fetch_secrets`), or would you prefer a **direct SQL backfill** so you can watch the recovery path explicitly?
2. Should I also create a one-shot migration to dump `cron.job` so we can confirm the reconciler is actually scheduled?
3. Can you check the Mux dashboard's **webhook delivery history** for asset `YcDzNSgaLgKCaHWVzCqv2GAbAf02SYEFhWBydfWvFt01Y` and tell me whether the deliveries show 200s, 4xx, 5xx, or no attempt at all? That single data point decides whether the bug is in Mux config or in our cron pipeline.
