-- Template 3 report-view kill-switch (PR-2 of the report-surface rebuild).
--
-- Default TRUE: the Template 3 colour-coded view is the live report surface.
-- Setting this to FALSE flips authenticated report rendering back to the
-- legacy V2 view (V2ReportViewLegacy) — an emergency lever only, kept for
-- one release. Flip via the secret-gated /api/public/admin-config endpoint
-- or direct SQL; no deploy needed.
--
-- Deliberately read by a narrow, fail-open query
-- (src/server/report-view-config.server.ts), NOT by getResolvedConfig(),
-- so a deploy/migration ordering race cannot drop the quota config to
-- SAFE_DEFAULTS (which would re-enable the dormant daily cap).

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS tpl3_report_view_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.app_config.tpl3_report_view_enabled IS
  'Template 3 report view enabled (default true). FALSE = emergency fallback to the legacy V2 report view. Read by a narrow fail-open query, not getResolvedConfig().';
