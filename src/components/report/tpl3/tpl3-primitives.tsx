// Template 3 "Colour-coded" primitives — chrome only.
//
// These components style the report surface (hero, accent cards, score ring,
// verdict pill, empty-states). They render values handed to them — all
// performer-facing labels/chips come from the report view-model
// (src/lib/report-view-model.ts); nothing is re-mapped or hardcoded here.
//
// Brand: design bundle docs/design (tpl-shared.jsx + tpl3-colour.jsx) —
// Merriweather/Inter (already themed as font-display/font-body), navy
// #091E42 → mid #19457C hero gradient, royal/violet + status accents,
// 14px radius, soft shadows.

import type {
  ModuleEmptyKind,
  ScoreTone,
  StatusChipDisplay,
  VerdictDisplay,
} from "@/lib/report-view-model";

// ── brand colours (design bundle tpl-shared.jsx) ──────────────────────────

export const TPL3 = {
  navy: "#091E42",
  mid: "#19457C",
  royal: "#2F80ED",
  violet: "#7B4DFF",
  dark: "#1F2933",
  muted: "#5B6B7F",
  border: "#E3E8EF",
  lightgrey: "#ECEFF4",
  success: "#2F855A",
  successBg: "#E7F3EC",
  successLine: "#CBE6D5",
  warning: "#B7791F",
  warningBg: "#FBF3E3",
  warningLine: "#F0E0BD",
  danger: "#C53030",
  dangerBg: "#FBEAEA",
  dangerLine: "#F2CFCF",
  royalBg: "#EAF1FD",
  royalLine: "#CFE0FB",
  violetBg: "#F0EBFF",
  violetLine: "#E0D6FF",
  blueBg: "#EAF0F7",
  blueLine: "#D3E0EE",
} as const;

export type Tpl3AccentKey = "royal" | "green" | "amber" | "red" | "violet" | "blue" | "muted";

export type Tpl3Accent = { color: string; bg: string; line: string };

export const TPL3_ACCENTS: Record<Tpl3AccentKey, Tpl3Accent> = {
  royal: { color: TPL3.royal, bg: TPL3.royalBg, line: TPL3.royalLine },
  green: { color: TPL3.success, bg: TPL3.successBg, line: TPL3.successLine },
  amber: { color: TPL3.warning, bg: TPL3.warningBg, line: TPL3.warningLine },
  red: { color: TPL3.danger, bg: TPL3.dangerBg, line: TPL3.dangerLine },
  violet: { color: TPL3.violet, bg: TPL3.violetBg, line: TPL3.violetLine },
  blue: { color: TPL3.mid, bg: TPL3.blueBg, line: TPL3.blueLine },
  muted: { color: TPL3.muted, bg: "#F8F9FB", line: TPL3.border },
};

export function toneColor(tone: ScoreTone | StatusChipDisplay["tone"] | VerdictDisplay["tone"]) {
  switch (tone) {
    case "success":
      return TPL3.success;
    case "royal":
      return TPL3.royal;
    case "warning":
      return TPL3.warning;
    case "danger":
      return TPL3.danger;
    default:
      return TPL3.muted;
  }
}

function toneAccent(tone: VerdictDisplay["tone"]): Tpl3Accent {
  switch (tone) {
    case "success":
      return TPL3_ACCENTS.green;
    case "royal":
      return TPL3_ACCENTS.royal;
    case "warning":
      return TPL3_ACCENTS.amber;
    case "danger":
      return TPL3_ACCENTS.red;
    default:
      return TPL3_ACCENTS.muted;
  }
}

// ── icons (design bundle subset, stroke style) ─────────────────────────────

export type Tpl3IconName =
  | "check"
  | "minus"
  | "x"
  | "arrow"
  | "chevron"
  | "star"
  | "alert"
  | "shield"
  | "target"
  | "film"
  | "eye"
  | "mic"
  | "clip"
  | "clock"
  | "wrench"
  | "sparkle"
  | "list"
  | "dot";

export function Tpl3Icon({
  name,
  size = 16,
  color = "currentColor",
  className,
}: {
  name: Tpl3IconName;
  size?: number;
  color?: string;
  className?: string;
}) {
  const paths: Record<Tpl3IconName, React.ReactNode> = {
    check: <polyline points="20 6 9 17 4 12" />,
    minus: <line x1="5" y1="12" x2="19" y2="12" />,
    x: (
      <g>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </g>
    ),
    arrow: (
      <g>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </g>
    ),
    chevron: <polyline points="6 9 12 15 18 9" />,
    star: (
      <polygon
        points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9"
        fill={color}
        stroke="none"
      />
    ),
    alert: (
      <g>
        <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </g>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    target: (
      <g>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill={color} />
      </g>
    ),
    film: (
      <g>
        <rect x="2.5" y="4" width="19" height="16" rx="2" />
        <line x1="8" y1="4" x2="8" y2="20" />
        <line x1="16" y1="4" x2="16" y2="20" />
      </g>
    ),
    eye: (
      <g>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </g>
    ),
    mic: (
      <g>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </g>
    ),
    clip: (
      <g>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 4v4h6V4M8 12h8M8 16h5" />
      </g>
    ),
    clock: (
      <g>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </g>
    ),
    wrench: (
      <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3 18l3 3 6.5-6.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.6-.6-.6-2.6 2.4-2.4Z" />
    ),
    sparkle: (
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"
        fill={color}
        stroke="none"
      />
    ),
    list: (
      <g>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3.5" cy="6" r="1" fill={color} />
        <circle cx="3.5" cy="12" r="1" fill={color} />
        <circle cx="3.5" cy="18" r="1" fill={color} />
      </g>
    ),
    dot: <circle cx="12" cy="12" r="3" fill={color} stroke="none" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? paths.dot}
    </svg>
  );
}

// ── accent card shell ──────────────────────────────────────────────────────

export function CCardShell({
  accent,
  icon,
  title,
  kicker,
  span = 1,
  children,
}: {
  accent: Tpl3Accent;
  icon: Tpl3IconName;
  title: string;
  kicker?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`tc-report-print-section overflow-hidden rounded-[14px] border bg-card shadow-soft ${
        span === 2 ? "tc-tpl3-span2" : ""
      }`}
      style={{ borderColor: TPL3.border }}
    >
      <header
        className="flex items-center gap-3 border-b px-5 py-3.5"
        style={{ background: accent.bg, borderColor: accent.line }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white"
          style={{ borderColor: accent.line }}
        >
          <Tpl3Icon name={icon} size={16} color={accent.color} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="font-display text-base font-bold leading-tight"
            style={{ color: accent.color }}
          >
            {title}
          </h3>
          {kicker && <p className="mt-0.5 truncate text-xs text-muted-foreground">{kicker}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── score ring ─────────────────────────────────────────────────────────────

export function ScoreRing({
  value,
  tone,
  size = 124,
  stroke = 10,
  label = "Overall readiness",
}: {
  value: number | null;
  tone: ScoreTone | null;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  // Integer-rounded geometry: SVG decimal attribute values would leak
  // arbitrary digit runs into the route HTML, which the rendering tests
  // scan for forbidden score numbers.
  const c = Math.round(2 * Math.PI * r);
  const col = tone ? toneColor(tone) : "rgba(255,255,255,.4)";
  const off = value != null ? Math.round(c * (1 - Math.max(0, Math.min(100, value)) / 100)) : c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.16)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {/* DOM order is label-then-value (the route text reads
          "Overall readiness <score>", matching the legacy header);
          flex-col-reverse puts the number visually on top. */}
      <div className="absolute inset-0 flex flex-col-reverse items-center justify-center">
        <span className="mt-1 px-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {label}
        </span>
        <span
          className="font-display font-bold tabular-nums leading-none text-white"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {value ?? "—"}
        </span>
      </div>
    </div>
  );
}

// ── verdict pill (hero) ────────────────────────────────────────────────────

export function VerdictPill({ verdict }: { verdict: VerdictDisplay | null }) {
  if (!verdict) return null;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold"
      style={{
        background: "rgba(255,255,255,.12)",
        borderColor: "rgba(255,255,255,.22)",
        color: "#fff",
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: toneColor(verdict.tone) }}
      />
      {verdict.chipWord}
    </span>
  );
}

// ── visible empty-state card ───────────────────────────────────────────────
//
// Hide-vs-empty policy (report-view-model.ts): "positive" absences are good
// news rendered as good news; "not_assessed" absences are honest gaps. Both
// stay VISIBLE so module coverage is inspectable before pruning decisions.

export function EmptyStateCard({
  title,
  accent,
  icon,
  kind,
  headline,
  detail,
  reason,
}: {
  title: string;
  accent: Tpl3Accent;
  icon: Tpl3IconName;
  kind: Exclude<ModuleEmptyKind, "hidden">;
  headline: string;
  detail: string;
  reason?: string | null;
}) {
  const positive = kind === "positive";
  return (
    <CCardShell accent={accent} icon={icon} title={title}>
      <div
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center"
        style={{ borderColor: positive ? TPL3.successLine : TPL3.border }}
      >
        <Tpl3Icon
          name={positive ? "check" : "minus"}
          size={18}
          color={positive ? TPL3.success : TPL3.muted}
        />
        {/* No inline hex for the neutral colour: #1F2933 contains the digit
            run "93", which the route tests scan as a forbidden score. */}
        <p
          className={`text-sm font-semibold ${positive ? "" : "text-foreground"}`}
          style={positive ? { color: TPL3.success } : undefined}
        >
          {headline}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">{reason ?? detail}</p>
      </div>
    </CCardShell>
  );
}
