## Plan

The database-side secret is still missing:
- `vault.secrets` is empty
- the `reconcile-stale-takes` cron job is still returning `401` every minute
- the job reads `reconciler_secret` from the database vault, not from runtime secrets

## What I’ll do

1. Collect the secret again through Lovable’s secure secret form so it is never pasted in chat.
2. Insert that value into the database vault under the exact name `reconciler_secret`.
3. Re-run verification checks on the vault entry, cron responses, and latest request status.
4. Confirm that the next cron tick is returning `200` instead of `401`.

## Technical details

- I can see the secret names that exist, but I cannot read the current secret values back out.
- That means I cannot copy the existing runtime `RECONCILER_SECRET` into the database vault automatically unless you re-enter the value securely.
- Once you approve implementation, I’ll prompt for the secret in the secure form and then wire it into the database vault for the cron job.