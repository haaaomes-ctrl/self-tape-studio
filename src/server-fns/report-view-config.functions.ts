import { createServerFn } from "@tanstack/react-start";

/**
 * Non-sensitive view toggle for the report surface. No auth middleware on
 * purpose: the flag carries no user data and the kill-switch must work on
 * every surface that renders a report. Fails open to Template 3.
 */
export const getReportViewMode = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getTpl3ReportViewEnabled } = await import("@/server/report-view-config.server");
    return { tpl3Enabled: await getTpl3ReportViewEnabled() };
  } catch {
    return { tpl3Enabled: true };
  }
});
