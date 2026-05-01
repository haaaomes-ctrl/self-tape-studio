/**
 * TapeCoach — central brand configuration.
 *
 * Single source of truth for brand identity (name, tagline, copy, logo,
 * favicon, social links and SEO/OG metadata). Update values here when the
 * brand evolves; consumers across the app reference these tokens rather
 * than hardcoding strings.
 *
 * Guardrail: this file holds metadata and visual identifiers ONLY.
 * Do not put API URLs, data-pipeline configuration, or processing logic here.
 */

import logoUrl from "@/assets/tapecoach-logo.png";

export const brand = {
  /** Display name as shown in headers, footers, document titles. */
  name: "TapeCoach",
  /** Wordmark split — second segment renders in the primary brand colour. */
  wordmark: { lead: "Tape", accent: "Coach" } as const,
  /** Primary tagline. */
  tagline: "Review your tape before it reaches the room.",
  /** Alternate, shorter tagline for tight spaces and CTAs. */
  taglineShort: "Send your strongest take.",
  /** Footer mission statement. */
  mission: "Private self-tape feedback before you submit.",
  /** Short value proposition used across landing/marketing surfaces. */
  description:
    "Private self-tape review. Structured feedback on performance, voice, setup and brief fit — give yourself the best chance of sending a stronger take.",
  /** Compact OG/Twitter description. */
  shareDescription:
    "A private second look at your self-tape — structured feedback so you can submit with more confidence.",
  /** Twitter-card description (audience-focused). */
  twitterDescription:
    "Private self-tape review for performers, agents and teachers. Reduce avoidable mistakes before submission.",

  /** Logo + favicon assets. */
  assets: {
    logo: logoUrl,
    logoAlt: "TapeCoach logo",
    favicon: "/favicon.ico",
    ogImage:
      "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9798fe19-4dbb-45b5-9487-32c83e228598/id-preview-b7d444ff--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app-1777409239157.png",
  },

  /** Social handles — used by footer/share components. */
  socials: {
    instagram: "#",
    tiktok: "#",
    youtube: "#",
    linkedin: "#",
  },

  /** Legal/copyright. */
  legal: {
    copyright: (year: number = new Date().getFullYear()) =>
      `© ${year} TapeCoach. All rights reserved.`,
  },
} as const;

/**
 * Build a consistent document title: "<page> — TapeCoach"
 * (or just the brand + tagline when no page suffix is supplied).
 */
export function brandTitle(page?: string): string {
  if (!page) return `${brand.name} — ${brand.tagline}`;
  return `${page} — ${brand.name}`;
}

/** Default route head() metadata — spread into route head meta arrays. */
export const brandHeadDefaults = {
  title: brandTitle(),
  description: brand.description,
  ogTitle: brandTitle(),
  ogDescription: brand.shareDescription,
  twitterTitle: brandTitle(),
  twitterDescription: brand.twitterDescription,
  ogImage: brand.assets.ogImage,
} as const;

export type Brand = typeof brand;
