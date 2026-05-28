import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitB2BInterestLead } from "@/server/b2b-interest.server";

const AnalyticsAttributionSchema = z
  .object({
    schema_version: z.string().optional().nullable(),
    attribution_available: z.boolean().optional(),
    consent_state: z.string().optional().nullable(),
    attribution_key: z.string().optional().nullable(),
    utm_source: z.string().optional().nullable(),
    utm_medium: z.string().optional().nullable(),
    utm_campaign: z.string().optional().nullable(),
    utm_term: z.string().optional().nullable(),
    utm_content: z.string().optional().nullable(),
    creator_code: z.string().optional().nullable(),
    partner_code_hint: z.string().optional().nullable(),
    landing_path: z.string().optional().nullable(),
    referrer_host: z.string().optional().nullable(),
    first_seen_at: z.string().optional().nullable(),
    last_seen_at: z.string().optional().nullable(),
  })
  .partial()
  .nullable()
  .optional();

const B2BInterestSubmissionSchema = z.object({
  partnerType: z.string().optional(),
  organisation: z.string().optional(),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  email: z.string().optional(),
  cohortSize: z.string().optional(),
  message: z.string().optional(),
  contactConsent: z.boolean().optional(),
  website: z.string().optional(),
  sourcePath: z.string().optional(),
  analyticsConsentState: z.string().optional(),
  analyticsAttribution: AnalyticsAttributionSchema,
});

export const submitB2BInterest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => B2BInterestSubmissionSchema.parse(data))
  .handler(async ({ data }) => submitB2BInterestLead(data));
