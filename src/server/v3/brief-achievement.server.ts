export type BriefRequirementCategory =
  | 'mandatory'
  | 'preferred'
  | 'optional'
  | 'style_context'
  | 'material_instruction'
  | 'technical_setup'
  | 'admin_process'
  | 'ambiguous';

export type BriefRequirementType =
  | 'technique'
  | 'skill'
  | 'song'
  | 'dance'
  | 'scene'
  | 'monologue'
  | 'copy'
  | 'role_context'
  | 'show_number'
  | 'format'
  | 'duration'
  | 'framing'
  | 'submission_process';

export type BriefAchievementStatus =
  | 'achieved'
  | 'mostly_achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'not_assessable'
  | 'not_applicable';

export type BriefReadinessImpact =
  | 'supports_submission'
  | 'minor_gap'
  | 'material_gap'
  | 'retake_recommended'
  | 'submission_blocker'
  | 'not_assessable';

export type BriefRequirement = {
  requirement_id: string;
  source_text: string;
  category: BriefRequirementCategory;
  requirement_type: BriefRequirementType;
  mapped_technique_ids?: string[];
  mapped_repertoire_ids?: string[];
  selected_level_standard?: string;
  achievement_status: BriefAchievementStatus;
  achievement_score_band?: 'high' | 'medium' | 'low' | 'blocked';
  evidence_anchor_ids: string[];
  assessability_limits: string[];
  readiness_impact: BriefReadinessImpact;
};

export type BriefRequirementTrace = {
  schema_version: 'tapecoach_v3_brief_requirement_trace_v1';
  run_id: string;
  analysis_run_id: string;
  submission_id: string | null;
  take_id: string;
  generated_at: string;
  brief_present: boolean;
  source_family:
    | 'brief_supplied'
    | 'task_supplied'
    | 'material_supplied'
    | 'no_brief'
    | 'legacy_adapter'
    | 'unavailable';
  requirements: BriefRequirement[];
  unresolved_brief_items: {
    source_text: string;
    reason:
      | 'ambiguous'
      | 'unsupported_type'
      | 'requires_technique_library'
      | 'requires_repertoire_library'
      | 'requires_human_review';
  }[];
  extraction_confidence: 'high' | 'medium' | 'low';
  notes: string[];
};

export type BriefAchievementResult = {
  requirement_id: string;
  source_text: string;
  category: BriefRequirement['category'];
  requirement_type: BriefRequirement['requirement_type'];
  achievement_status: BriefAchievementStatus;
  evidence_anchor_ids: string[];
  evidence_summary: string;
  assessability_limits: string[];
  readiness_impact: BriefReadinessImpact;
  confidence: 'high' | 'medium' | 'low';
  blocker_codes?: string[];
};

export type BriefAchievementSummary = {
  achieved_count: number;
  mostly_achieved_count: number;
  partially_achieved_count: number;
  not_achieved_count: number;
  not_assessable_count: number;
  not_applicable_count: number;
  mandatory_total: number;
  mandatory_achieved_or_mostly_achieved: number;
  mandatory_not_achieved: number;
  mandatory_not_assessable: number;
  overall_brief_achievement:
    | 'achieved'
    | 'mostly_achieved'
    | 'partially_achieved'
    | 'not_achieved'
    | 'not_assessable'
    | 'no_brief';
};

export type BriefAchievementTrace = {
  schema_version: 'tapecoach_v3_brief_achievement_trace_v1';
  run_id: string;
  analysis_run_id: string;
  submission_id: string | null;
  take_id: string;
  generated_at: string;
  brief_present: boolean;
  requirement_results: BriefAchievementResult[];
  summary: BriefAchievementSummary;
  readiness_effect:
    | 'supports_readiness'
    | 'minor_gap'
    | 'material_gap'
    | 'retake_recommended'
    | 'submission_blocker'
    | 'not_assessable'
    | 'no_brief';
  recommended_priority_focus: string[];
};

export interface BriefRequirementExtractionInput {
  selected_level?: string | null;
  audition_type?: string | null;
  brief_text?: string | null;
  task_text?: string | null;
  material_instructions?: string | null;
  extracted_brief?: Record<string, unknown> | null;
}

export interface BuildBriefRequirementTraceInput extends BriefRequirementExtractionInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string | null;
  take_id: string;
  generated_at?: string;
}

export interface BuildBriefAchievementTraceInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string | null;
  take_id: string;
  generated_at?: string;
  requirement_trace: BriefRequirementTrace;
  selected_level?: string | null;
  audition_type?: string | null;
  raw_report_data?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  uploaded_material_metadata?: Record<string, unknown> | null;
  evidence_anchors?: Array<Record<string, unknown>>;
}

const MANDATORY_RE = /\b(must|required|requirement|please|include|perform|submit|provide|send|upload|film|record|prepare|bring|use|show|do not|don't|no more than|under|within|maximum|max|at least)\b/i;
const PREFERRED_RE = /\b(prefer|preferred|ideally|ideal|bonus|nice to have|would like|if possible|where possible)\b/i;
const OPTIONAL_RE = /\b(optional|if you have|only if|not required|not compulsory|as an option)\b/i;
const STYLE_CONTEXT_RE = /\b(style|tone|feel|world|energy|genre|mood|in the style of|contemporary|period|heightened|naturalistic|comic|dramatic|commercial|legit|pop|rock|classical)\b/i;
const MATERIAL_RE = /\b(song|number|monologue|scene|sides?|copy|script|dance|routine|phrase|material|cut|verse|chorus|bar|bars|role|character|show|musical|play)\b/i;
const TECHNICAL_RE = /\b(landscape|portrait|full[ -]?body|full length|head[ -]?and[ -]?shoulders|waist[ -]?up|mid[ -]?shot|close[ -]?up|framing|frame|camera|audio|lighting|background|eyeline|slate|ident|reader|tripod|phone|horizontal|vertical)\b/i;
const ADMIN_RE = /\b(single file|one file|separate files?|multiple files?|file name|filename|deadline|submit|upload|link|email|form|slate first|ident|label|order|process|self tape|self-tape)\b/i;
const TECHNIQUE_RE = /\b(grand battement|battement|pirouette|tendu|plié|plie|jeté|jete|kick|turn|leap|belt|mix|falsetto|vibrato|accent|dialect|received pronunciation|rp|tap|riff|run|chest voice|head voice)\b/i;
const AMBIGUOUS_RE = /\b(be yourself|bring energy|have fun|show us who you are|make it yours|open to interpretation|as appropriate|something contrasting|surprise us)\b/i;

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•*]+/, '')
    .replace(/[\s.;:]+$/, '')
    .trim();
}

function meaningful(value: unknown): boolean {
  const text = cleanText(value);
  if (!text || text === '{}' || text === '[]' || text.toLowerCase() === 'null') return false;
  return true;
}

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstString(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && meaningful(value)) return cleanText(value);
    if (Array.isArray(value)) {
      const joined = value.filter((item) => typeof item === 'string' && meaningful(item)).map(cleanText).join(', ');
      if (joined) return joined;
    }
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function secondsToBriefText(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} seconds`;
}

function splitBriefText(text: string): string[] {
  const source = cleanText(text);
  if (!source) return [];
  const bulletNormalised = source
    .replace(/\r/g, '\n')
    .replace(/[•]+/g, '\n')
    .replace(/\s+-\s+/g, '\n')
    .replace(/\s*;\s*/g, '\n');
  const rough = bulletNormalised
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map(cleanText)
    .filter(Boolean);
  const expanded: string[] = [];
  for (const item of rough) {
    const shouldSplitCommas = item.length > 80 && /\b(and|plus|also)\b/i.test(item);
    if (!shouldSplitCommas) {
      expanded.push(item);
      continue;
    }
    const parts = item.split(/\s+(?:and|plus|also)\s+/i).map(cleanText).filter(Boolean);
    if (parts.length > 1 && parts.every((part) => part.length > 8)) expanded.push(...parts);
    else expanded.push(item);
  }
  return expanded.filter((item) => item.length > 2);
}

function addUnique(out: string[], candidate: string | null | undefined) {
  const clean = cleanText(candidate);
  if (!clean) return;
  const key = normaliseKey(clean);
  if (out.some((existing) => normaliseKey(existing) === key)) return;
  out.push(clean);
}

function extractStructuredBriefItems(input: BriefRequirementExtractionInput): string[] {
  const out: string[] = [];
  const b = input.extracted_brief ?? null;
  const materialRequested = firstString(b, ['material_requested', 'material', 'song', 'scene', 'monologue', 'copy', 'dance_phrase']);
  if (materialRequested) addUnique(out, `Use the requested material: ${materialRequested}`);

  const framing = firstString(b, ['framing_required', 'framing', 'frame', 'shot']);
  if (framing) addUnique(out, `Frame the tape as requested: ${framing}`);

  const orientation = firstString(b, ['orientation_required', 'orientation', 'format']);
  if (orientation && /landscape|portrait|horizontal|vertical/i.test(orientation)) addUnique(out, `Record in ${orientation} format`);

  const timeLimit = finiteNumber(b?.time_limit_seconds);
  const timeSource = typeof b?.time_limit_source === 'string' ? b.time_limit_source : null;
  if (timeLimit != null && (!timeSource || timeSource === 'explicit')) addUnique(out, `Keep the tape within ${secondsToBriefText(timeLimit)}`);

  const accent = firstString(b, ['accent_required', 'accent']);
  const accentImportance = firstString(b, ['accent_importance']);
  if (accent && !/^unknown|none|unspecified$/i.test(accent)) {
    addUnique(out, `${accentImportance === 'preferred' ? 'Preferred' : 'Use'} accent: ${accent}`);
  }

  const role = firstString(b, ['role', 'role_name', 'character']);
  if (role) addUnique(out, `Role context: ${role}`);

  const show = firstString(b, ['show', 'production', 'show_title', 'musical_title']);
  const number = firstString(b, ['number', 'song_title', 'number_title']);
  if (show && number) addUnique(out, `Show/number context: ${show} — ${number}`);
  else if (show) addUnique(out, `Show context: ${show}`);
  else if (number) addUnique(out, `Number context: ${number}`);

  const style = firstString(b, ['style', 'tone', 'genre', 'energy', 'world']);
  if (style) addUnique(out, `Style context: ${style}`);

  const physical = firstString(b, ['physical_demands', 'movement_requirements', 'dance_requirements']);
  if (physical) addUnique(out, `Movement or physical requirement: ${physical}`);

  const vocal = firstString(b, ['vocal_expectations', 'vocal_style', 'singing_requirements']);
  if (vocal) addUnique(out, `Vocal requirement: ${vocal}`);

  return out;
}

function extractSourceItems(input: BriefRequirementExtractionInput): { items: string[]; source_family: BriefRequirementTrace['source_family']; brief_present: boolean } {
  const items: string[] = [];
  if (meaningful(input.brief_text)) splitBriefText(cleanText(input.brief_text)).forEach((item) => addUnique(items, item));
  if (meaningful(input.task_text)) splitBriefText(cleanText(input.task_text)).forEach((item) => addUnique(items, item));
  if (meaningful(input.material_instructions)) splitBriefText(cleanText(input.material_instructions)).forEach((item) => addUnique(items, item));
  extractStructuredBriefItems(input).forEach((item) => addUnique(items, item));

  const brief_present = items.length > 0;
  const source_family: BriefRequirementTrace['source_family'] = meaningful(input.brief_text)
    ? 'brief_supplied'
    : meaningful(input.task_text)
      ? 'task_supplied'
      : meaningful(input.material_instructions) || input.extracted_brief
        ? 'material_supplied'
        : 'no_brief';
  return { items, source_family, brief_present };
}

export function classifyBriefObligation(sourceText: string): BriefRequirement['category'] {
  const text = cleanText(sourceText);
  if (!text) return 'ambiguous';
  if (AMBIGUOUS_RE.test(text)) return 'ambiguous';
  if (OPTIONAL_RE.test(text)) return 'optional';
  if (PREFERRED_RE.test(text)) return 'preferred';
  if (/^style context:/i.test(text) || (STYLE_CONTEXT_RE.test(text) && !MANDATORY_RE.test(text) && !MATERIAL_RE.test(text) && !TECHNICAL_RE.test(text))) return 'style_context';
  if (TECHNICAL_RE.test(text) && !ADMIN_RE.test(text)) return 'technical_setup';
  if (ADMIN_RE.test(text)) return 'admin_process';
  if (MATERIAL_RE.test(text)) return 'material_instruction';
  if (MANDATORY_RE.test(text)) return 'mandatory';
  if (STYLE_CONTEXT_RE.test(text)) return 'style_context';
  return 'ambiguous';
}

export function classifyRequirementType(sourceText: string): BriefRequirement['requirement_type'] {
  const text = cleanText(sourceText).toLowerCase();
  if (/\b(duration|within|under|no more than|max(?:imum)?|minutes?|seconds?|\d+\s*(?:mins?|minutes?|secs?|seconds?))\b/.test(text)) return 'duration';
  if (/\b(full[ -]?body|full length|head[ -]?and[ -]?shoulders|waist[ -]?up|mid[ -]?shot|close[ -]?up|framing|frame)\b/.test(text)) return 'framing';
  if (/\b(landscape|portrait|horizontal|vertical|format|16:9|9:16)\b/.test(text)) return 'format';
  if (/\b(single file|one file|separate files?|multiple files?|file name|filename|deadline|submit|upload|link|email|form|slate|ident|order)\b/.test(text)) return 'submission_process';
  if (TECHNIQUE_RE.test(text)) return 'technique';
  if (/\b(monologue)\b/.test(text)) return 'monologue';
  if (/\b(copy|commercial copy|script)\b/.test(text)) return 'copy';
  if (/\b(sides?|scene)\b/.test(text)) return 'scene';
  if (/\b(dance|choreography|routine|phrase|movement)\b/.test(text)) return 'dance';
  if (/\b(song|sing|sung|verse|chorus|bar|bars|number)\b/.test(text)) return 'song';
  if (/\b(show|production|musical|number context|show\/number)\b/.test(text)) return 'show_number';
  if (/\b(role|character|addressee|relationship)\b/.test(text)) return 'role_context';
  return 'skill';
}

function initialRequirement(sourceText: string, index: number, selectedLevel?: string | null): BriefRequirement {
  const category = classifyBriefObligation(sourceText);
  const requirement_type = classifyRequirementType(sourceText);
  const req: BriefRequirement = {
    requirement_id: `brief-req-${index + 1}`,
    source_text: cleanText(sourceText),
    category,
    requirement_type,
    achievement_status: 'not_assessable',
    evidence_anchor_ids: [],
    assessability_limits: [],
    readiness_impact: 'not_assessable',
  };
  if (selectedLevel) req.selected_level_standard = `selected_level:${selectedLevel}`;
  if (requirement_type === 'technique') req.mapped_technique_ids = [];
  if (requirement_type === 'show_number' || requirement_type === 'role_context') req.mapped_repertoire_ids = [];
  return req;
}

export function extractBriefRequirements(input: BriefRequirementExtractionInput): BriefRequirement[] {
  return extractSourceItems(input).items.map((item, index) => initialRequirement(item, index, input.selected_level));
}

function unresolvedReason(req: BriefRequirement): BriefRequirementTrace['unresolved_brief_items'][number]['reason'] | null {
  if (req.category === 'ambiguous') return 'ambiguous';
  if (req.requirement_type === 'technique') return 'requires_technique_library';
  if (req.requirement_type === 'show_number' || req.requirement_type === 'role_context') return 'requires_repertoire_library';
  return null;
}

function confidenceForRequirements(requirements: BriefRequirement[]): 'high' | 'medium' | 'low' {
  if (requirements.length === 0) return 'high';
  const ambiguous = requirements.filter((r) => r.category === 'ambiguous').length;
  if (ambiguous === 0) return 'high';
  if (ambiguous <= Math.max(1, Math.floor(requirements.length / 3))) return 'medium';
  return 'low';
}

export function buildBriefRequirementTrace(input: BuildBriefRequirementTraceInput): BriefRequirementTrace {
  const { items, source_family, brief_present } = extractSourceItems(input);
  const requirements = items.map((item, index) => initialRequirement(item, index, input.selected_level));
  const unresolved_brief_items = requirements
    .map((req) => {
      const reason = unresolvedReason(req);
      return reason ? { source_text: req.source_text, reason } : null;
    })
    .filter((x): x is BriefRequirementTrace['unresolved_brief_items'][number] => Boolean(x));

  return {
    schema_version: 'tapecoach_v3_brief_requirement_trace_v1',
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id ?? input.run_id,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    generated_at: input.generated_at ?? new Date().toISOString(),
    brief_present,
    source_family,
    requirements,
    unresolved_brief_items,
    extraction_confidence: confidenceForRequirements(requirements),
    notes: brief_present
      ? ['requirements_extracted_from_runtime_brief_inputs', 'achievement_defaults_remain_conservative_until_evidence_is_available']
      : ['no_brief_or_task_or_material_instruction_supplied'],
  };
}

function lower(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function evidenceTextPool(rawReport: Record<string, unknown> | null | undefined, anchors: Array<Record<string, unknown>>): string {
  const chunks: string[] = [];
  const blockedKeys = new Set([
    'brief_requirements',
    'brief_achievement',
    'brief_achievement_readiness_effect',
    'brief_achievement_priority_focus',
    'brief_achievement_internal_hooks',
    'brief_achievement_public_surface_status',
  ]);
  const walk = (value: unknown, depth = 0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === 'string') {
      const text = cleanText(value);
      if (text) chunks.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (blockedKeys.has(key) || key.startsWith('brief_')) continue;
        if (/prompt|token|secret|cookie|authorization|raw_response/i.test(key)) continue;
        walk(item, depth + 1);
      }
    }
  };
  walk(rawReport);
  anchors.forEach((anchor) => walk(anchor.evidence_text, 0));
  return chunks.join(' ').toLowerCase();
}

function anchorIdsForRequirement(req: BriefRequirement, anchors: Array<Record<string, unknown>>): string[] {
  const sourceTokens = normaliseKey(req.source_text).split(' ').filter((token) => token.length > 4).slice(0, 8);
  if (sourceTokens.length === 0) return [];
  return anchors
    .filter((anchor) => {
      const text = lower(anchor.evidence_text);
      return sourceTokens.some((token) => text.includes(token));
    })
    .map((anchor) => String(anchor.evidence_anchor_id ?? ''))
    .filter(Boolean);
}

function getOrientation(signals: Record<string, unknown> | null | undefined): string | null {
  const value = firstString(signals ?? null, ['orientation', 'video_orientation', 'format']);
  if (!value) return null;
  if (/landscape|horizontal/i.test(value)) return 'landscape';
  if (/portrait|vertical/i.test(value)) return 'portrait';
  return lower(value);
}

function currentDurationSeconds(signals: Record<string, unknown> | null | undefined): number | null {
  return finiteNumber(signals?.duration) ?? finiteNumber(signals?.duration_seconds) ?? finiteNumber(signals?.mux_duration_seconds);
}

function parseRequiredDurationSeconds(text: string): number | null {
  const clean = lower(text);
  const mmss = clean.match(/\b(\d{1,2}):(\d{2})\b/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const min = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)\b/);
  if (min) return Math.round(Number(min[1]) * 60);
  const sec = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:secs?|seconds?)\b/);
  if (sec) return Math.round(Number(sec[1]));
  return null;
}

function impactForNotAchieved(req: BriefRequirement): BriefReadinessImpact {
  const hardInstruction =
    req.category === 'mandatory'
    || req.category === 'technical_setup'
    || req.category === 'admin_process';
  if (hardInstruction) {
    if (req.requirement_type === 'submission_process' || req.requirement_type === 'format') return 'submission_blocker';
    if (req.requirement_type === 'framing') return 'retake_recommended';
    return 'material_gap';
  }
  if (req.category === 'material_instruction') return 'material_gap';
  if (req.category === 'preferred' || req.category === 'optional' || req.category === 'style_context') return 'minor_gap';
  return 'material_gap';
}

function resultFrom(req: BriefRequirement, patch: Partial<BriefAchievementResult>): BriefAchievementResult {
  return {
    requirement_id: req.requirement_id,
    source_text: req.source_text,
    category: req.category,
    requirement_type: req.requirement_type,
    achievement_status: patch.achievement_status ?? req.achievement_status,
    evidence_anchor_ids: patch.evidence_anchor_ids ?? req.evidence_anchor_ids,
    evidence_summary: patch.evidence_summary ?? 'No reliable runtime evidence was available for this requirement.',
    assessability_limits: patch.assessability_limits ?? req.assessability_limits,
    readiness_impact: patch.readiness_impact ?? req.readiness_impact,
    confidence: patch.confidence ?? 'low',
    ...(patch.blocker_codes ? { blocker_codes: patch.blocker_codes } : {}),
  };
}

function evaluateFormat(req: BriefRequirement, signals: Record<string, unknown> | null | undefined, anchors: Array<Record<string, unknown>>): BriefAchievementResult | null {
  const text = lower(req.source_text);
  const wantsLandscape = /landscape|horizontal/.test(text);
  const wantsPortrait = /portrait|vertical/.test(text);
  if (!wantsLandscape && !wantsPortrait) return null;
  const actual = getOrientation(signals);
  const wanted = wantsLandscape ? 'landscape' : 'portrait';
  const ids = anchorIdsForRequirement(req, anchors);
  if (!actual) {
    return resultFrom(req, {
      achievement_status: 'not_assessable',
      evidence_anchor_ids: ids,
      evidence_summary: 'Runtime orientation evidence was unavailable.',
      assessability_limits: ['brief_evidence_missing:orientation_signal_unavailable'],
      readiness_impact: 'not_assessable',
      confidence: 'low',
      blocker_codes: ['brief_evidence_missing', 'brief_requirement_not_assessable'],
    });
  }
  if (actual === wanted) {
    return resultFrom(req, {
      achievement_status: 'achieved',
      evidence_anchor_ids: ids,
      evidence_summary: `Runtime technical signal indicates ${actual} orientation.`,
      assessability_limits: [],
      readiness_impact: 'supports_submission',
      confidence: 'high',
    });
  }
  return resultFrom(req, {
    achievement_status: 'not_achieved',
    evidence_anchor_ids: ids,
    evidence_summary: `Brief requested ${wanted} orientation, but runtime technical signal indicates ${actual}.`,
    assessability_limits: [],
    readiness_impact: impactForNotAchieved(req),
    confidence: 'high',
    blocker_codes: ['brief_requirement_not_achieved'],
  });
}

function evaluateDuration(req: BriefRequirement, signals: Record<string, unknown> | null | undefined, anchors: Array<Record<string, unknown>>): BriefAchievementResult | null {
  if (req.requirement_type !== 'duration') return null;
  const required = parseRequiredDurationSeconds(req.source_text);
  const actual = currentDurationSeconds(signals);
  const ids = anchorIdsForRequirement(req, anchors);
  if (required == null || actual == null) {
    return resultFrom(req, {
      achievement_status: 'not_assessable',
      evidence_anchor_ids: ids,
      evidence_summary: required == null ? 'The duration requirement could not be parsed safely.' : 'Runtime duration evidence was unavailable.',
      assessability_limits: [required == null ? 'brief_requirement_ambiguous:duration_parse_failed' : 'brief_evidence_missing:duration_signal_unavailable'],
      readiness_impact: 'not_assessable',
      confidence: 'low',
      blocker_codes: ['brief_requirement_not_assessable'],
    });
  }
  const tolerance = Math.max(2, Math.round(required * 0.03));
  if (actual <= required + tolerance) {
    return resultFrom(req, {
      achievement_status: 'achieved',
      evidence_anchor_ids: ids,
      evidence_summary: `Runtime duration ${Math.round(actual)}s is within the requested ${required}s limit.`,
      assessability_limits: [],
      readiness_impact: 'supports_submission',
      confidence: 'high',
    });
  }
  const overBy = actual - required;
  if (overBy <= required * 0.1) {
    return resultFrom(req, {
      achievement_status: 'mostly_achieved',
      evidence_anchor_ids: ids,
      evidence_summary: `Runtime duration ${Math.round(actual)}s is slightly over the requested ${required}s limit.`,
      assessability_limits: [],
      readiness_impact: req.category === 'mandatory' ? 'minor_gap' : 'minor_gap',
      confidence: 'medium',
      blocker_codes: ['brief_duration_margin_gap'],
    });
  }
  return resultFrom(req, {
    achievement_status: 'not_achieved',
    evidence_anchor_ids: ids,
    evidence_summary: `Runtime duration ${Math.round(actual)}s exceeds the requested ${required}s limit.`,
    assessability_limits: [],
    readiness_impact: impactForNotAchieved(req),
    confidence: 'high',
    blocker_codes: ['brief_requirement_not_achieved'],
  });
}

function evaluateSubmissionProcess(req: BriefRequirement, metadata: Record<string, unknown> | null | undefined, anchors: Array<Record<string, unknown>>): BriefAchievementResult | null {
  if (req.requirement_type !== 'submission_process') return null;
  const text = lower(req.source_text);
  const wantsSingle = /single file|one file/.test(text);
  const fileCount = finiteNumber(metadata?.file_count) ?? finiteNumber(metadata?.uploaded_file_count) ?? null;
  const ids = anchorIdsForRequirement(req, anchors);
  if (!wantsSingle) return resultFrom(req, {
    achievement_status: 'not_assessable',
    evidence_anchor_ids: ids,
    evidence_summary: 'Submission-process evidence is not available in the current R2 runtime input.',
    assessability_limits: ['brief_evidence_missing:submission_process_metadata_unavailable'],
    readiness_impact: 'not_assessable',
    confidence: 'low',
    blocker_codes: ['brief_evidence_missing', 'brief_requirement_not_assessable'],
  });
  if (fileCount == null) return resultFrom(req, {
    achievement_status: 'not_assessable',
    evidence_anchor_ids: ids,
    evidence_summary: 'Single-file compliance could not be checked because uploaded file-count metadata was unavailable.',
    assessability_limits: ['brief_evidence_missing:file_count_unavailable'],
    readiness_impact: 'not_assessable',
    confidence: 'low',
    blocker_codes: ['brief_evidence_missing', 'brief_requirement_not_assessable'],
  });
  if (fileCount === 1) return resultFrom(req, {
    achievement_status: 'achieved',
    evidence_anchor_ids: ids,
    evidence_summary: 'Uploaded material metadata indicates a single file.',
    assessability_limits: [],
    readiness_impact: 'supports_submission',
    confidence: 'high',
  });
  return resultFrom(req, {
    achievement_status: 'not_achieved',
    evidence_anchor_ids: ids,
    evidence_summary: `Brief requested a single file, but uploaded material metadata indicates ${fileCount} files.`,
    assessability_limits: [],
    readiness_impact: 'submission_blocker',
    confidence: 'high',
    blocker_codes: ['brief_requirement_not_achieved'],
  });
}

function evaluateMaterial(req: BriefRequirement, rawReport: Record<string, unknown> | null | undefined, anchors: Array<Record<string, unknown>>, evidencePool: string): BriefAchievementResult | null {
  if (!['song', 'dance', 'scene', 'monologue', 'copy'].includes(req.requirement_type)) return null;
  const components = Array.isArray(rawReport?.detected_components) ? rawReport.detected_components as Array<Record<string, unknown>> : [];
  const componentTypes = components.map((component) => lower(component.type)).filter(Boolean);
  const expectedType = req.requirement_type === 'copy' ? 'commercial' : req.requirement_type;
  const ids = anchorIdsForRequirement(req, anchors);
  if (componentTypes.some((type) => type.includes(expectedType) || expectedType.includes(type))) {
    return resultFrom(req, {
      achievement_status: 'achieved',
      evidence_anchor_ids: ids,
      evidence_summary: `Legacy report component snapshot includes ${expectedType} material.`,
      assessability_limits: ['legacy_adapter_source:not_full_v3_material_proof'],
      readiness_impact: 'supports_submission',
      confidence: 'medium',
    });
  }
  const token = req.requirement_type === 'copy' ? 'copy' : req.requirement_type;
  if (evidencePool.includes(token)) {
    return resultFrom(req, {
      achievement_status: 'mostly_achieved',
      evidence_anchor_ids: ids,
      evidence_summary: 'Legacy report text references the requested material family, but R2 cannot fully verify material fidelity.',
      assessability_limits: ['legacy_adapter_source:not_full_v3_material_proof'],
      readiness_impact: 'supports_submission',
      confidence: 'low',
    });
  }
  return resultFrom(req, {
    achievement_status: 'not_assessable',
    evidence_anchor_ids: ids,
    evidence_summary: 'R2 could not verify whether the requested material was present from reliable runtime evidence.',
    assessability_limits: ['brief_evidence_missing:material_identity_not_verified'],
    readiness_impact: 'not_assessable',
    confidence: 'low',
    blocker_codes: ['brief_evidence_missing', 'brief_requirement_not_assessable'],
  });
}

function evaluateRequirement(input: BuildBriefAchievementTraceInput, req: BriefRequirement, evidencePool: string): BriefAchievementResult {
  const anchors = input.evidence_anchors ?? [];
  const format = evaluateFormat(req, input.signals, anchors);
  if (format) return format;
  const duration = evaluateDuration(req, input.signals, anchors);
  if (duration) return duration;
  const submission = evaluateSubmissionProcess(req, input.uploaded_material_metadata, anchors);
  if (submission) return submission;
  const material = evaluateMaterial(req, input.raw_report_data, anchors, evidencePool);
  if (material) return material;

  const ids = anchorIdsForRequirement(req, anchors);
  if (req.requirement_type === 'technique') {
    return resultFrom(req, {
      achievement_status: 'not_assessable',
      evidence_anchor_ids: ids,
      evidence_summary: 'Requested technique was itemised, but R2 does not include technique-library mapping or technique detection.',
      assessability_limits: ['requires_R4_brief_requested_technique_detection'],
      readiness_impact: 'not_assessable',
      confidence: 'high',
      blocker_codes: ['brief_requirement_requires_technique_library', 'brief_requirement_not_assessable'],
    });
  }
  if (req.requirement_type === 'show_number' || req.requirement_type === 'role_context') {
    return resultFrom(req, {
      achievement_status: 'not_assessable',
      evidence_anchor_ids: ids,
      evidence_summary: 'Repertoire, show, number or role context was itemised, but R2 does not include repertoire resolution.',
      assessability_limits: ['requires_R7_repertoire_resolution'],
      readiness_impact: 'not_assessable',
      confidence: 'high',
      blocker_codes: ['brief_requirement_requires_repertoire_library', 'brief_requirement_not_assessable'],
    });
  }
  if (req.category === 'style_context' || req.category === 'ambiguous') {
    return resultFrom(req, {
      achievement_status: req.category === 'style_context' ? 'not_applicable' : 'not_assessable',
      evidence_anchor_ids: ids,
      evidence_summary: req.category === 'style_context'
        ? 'This brief item is style/context rather than a directly assessable R2 requirement.'
        : 'This brief item is ambiguous and should not be forced into a hard performance judgement.',
      assessability_limits: req.category === 'style_context' ? [] : ['brief_requirement_ambiguous'],
      readiness_impact: req.category === 'style_context' ? 'supports_submission' : 'not_assessable',
      confidence: req.category === 'style_context' ? 'medium' : 'low',
      blocker_codes: req.category === 'ambiguous' ? ['brief_requirement_ambiguous'] : undefined,
    });
  }
  return resultFrom(req, {
    achievement_status: 'not_assessable',
    evidence_anchor_ids: ids,
    evidence_summary: 'No reliable R2 evidence source was available for this requirement.',
    assessability_limits: ['brief_evidence_missing'],
    readiness_impact: 'not_assessable',
    confidence: 'low',
    blocker_codes: ['brief_evidence_missing', 'brief_requirement_not_assessable'],
  });
}

export function summariseBriefAchievement(results: BriefAchievementResult[], briefPresent = true): BriefAchievementSummary {
  const count = (status: BriefAchievementStatus) => results.filter((r) => r.achievement_status === status).length;
  const mandatory = results.filter((r) => r.category === 'mandatory' || r.category === 'material_instruction' || r.category === 'technical_setup' || r.category === 'admin_process');
  const mandatoryAchievedOrMostly = mandatory.filter((r) => r.achievement_status === 'achieved' || r.achievement_status === 'mostly_achieved').length;
  const mandatoryNotAchieved = mandatory.filter((r) => r.achievement_status === 'not_achieved').length;
  const mandatoryNotAssessable = mandatory.filter((r) => r.achievement_status === 'not_assessable').length;
  let overall: BriefAchievementSummary['overall_brief_achievement'] = 'no_brief';
  if (briefPresent) {
    if (results.length === 0) overall = 'not_assessable';
    else if (mandatoryNotAchieved > 0) overall = 'not_achieved';
    else if (count('partially_achieved') > 0 || count('not_achieved') > 0) overall = 'partially_achieved';
    else if (mandatoryNotAssessable === mandatory.length && mandatory.length > 0) overall = 'not_assessable';
    else if (count('not_assessable') > 0 || count('mostly_achieved') > 0) overall = 'mostly_achieved';
    else overall = 'achieved';
  }
  return {
    achieved_count: count('achieved'),
    mostly_achieved_count: count('mostly_achieved'),
    partially_achieved_count: count('partially_achieved'),
    not_achieved_count: count('not_achieved'),
    not_assessable_count: count('not_assessable'),
    not_applicable_count: count('not_applicable'),
    mandatory_total: mandatory.length,
    mandatory_achieved_or_mostly_achieved: mandatoryAchievedOrMostly,
    mandatory_not_achieved: mandatoryNotAchieved,
    mandatory_not_assessable: mandatoryNotAssessable,
    overall_brief_achievement: overall,
  };
}

function isHardBriefCategory(category: BriefRequirementCategory): boolean {
  return category === 'mandatory' || category === 'material_instruction' || category === 'technical_setup' || category === 'admin_process';
}

function readinessEffect(results: BriefAchievementResult[], briefPresent: boolean): BriefAchievementTrace['readiness_effect'] {
  if (!briefPresent) return 'no_brief';
  if (results.some((r) => r.readiness_impact === 'submission_blocker')) return 'submission_blocker';
  if (results.some((r) => r.readiness_impact === 'retake_recommended')) return 'retake_recommended';
  if (results.some((r) => r.readiness_impact === 'material_gap')) return 'material_gap';
  if (results.some((r) => r.readiness_impact === 'minor_gap')) return 'minor_gap';
  if (results.some((r) => isHardBriefCategory(r.category) && r.achievement_status === 'not_assessable')) return 'not_assessable';
  if (results.length > 0 && results.every((r) => r.readiness_impact === 'not_assessable')) return 'not_assessable';
  if (results.length === 0) return 'not_assessable';
  return 'supports_readiness';
}

function priorityFocus(results: BriefAchievementResult[]): string[] {
  const ordered = results
    .filter((r) => r.readiness_impact === 'submission_blocker' || r.readiness_impact === 'material_gap' || (isHardBriefCategory(r.category) && r.achievement_status === 'not_assessable'))
    .slice(0, 5)
    .map((r) => {
      if (r.achievement_status === 'not_assessable') return `Make assessable: ${r.source_text}`;
      if (r.achievement_status === 'not_achieved') return `Meet required brief item: ${r.source_text}`;
      return `Improve brief achievement: ${r.source_text}`;
    });
  return [...new Set(ordered)];
}

export function buildBriefAchievementTrace(input: BuildBriefAchievementTraceInput): BriefAchievementTrace {
  const evidencePool = evidenceTextPool(input.raw_report_data, input.evidence_anchors ?? []);
  const requirement_results = input.requirement_trace.requirements.map((req) => evaluateRequirement(input, req, evidencePool));
  const summary = summariseBriefAchievement(requirement_results, input.requirement_trace.brief_present);
  return {
    schema_version: 'tapecoach_v3_brief_achievement_trace_v1',
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id ?? input.run_id,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    generated_at: input.generated_at ?? new Date().toISOString(),
    brief_present: input.requirement_trace.brief_present,
    requirement_results,
    summary,
    readiness_effect: readinessEffect(requirement_results, input.requirement_trace.brief_present),
    recommended_priority_focus: priorityFocus(requirement_results),
  };
}

type InternalBriefPriorityFix = {
  priority_rank: number;
  type: 'retake_critical' | 'critical_gap' | 'assessability_blocker';
  title: string;
  evidence_summary: string;
  why_it_matters: string;
  action: string;
  linked_categories: string[];
  linked_requirement_ids: string[];
};

type InternalBriefActionPlanGroup = {
  group: 'retake_critical' | 'recording_setup';
  actions: {
    action: string;
    linked_requirement_id: string;
    readiness_impact: BriefReadinessImpact;
    assessability_limits: string[];
  }[];
};

function scoreBandForAchievement(result: BriefAchievementResult): BriefRequirement['achievement_score_band'] | undefined {
  if (result.achievement_status === 'achieved') return 'high';
  if (result.achievement_status === 'mostly_achieved') return 'medium';
  if (result.achievement_status === 'partially_achieved') return 'low';
  if (result.achievement_status === 'not_achieved') return 'blocked';
  return undefined;
}

export function mergeBriefRequirementAchievements(
  requirements: BriefRequirement[],
  achievementTrace: BriefAchievementTrace,
): BriefRequirement[] {
  const byId = new Map(achievementTrace.requirement_results.map((result) => [result.requirement_id, result]));
  return requirements.map((requirement) => {
    const result = byId.get(requirement.requirement_id);
    if (!result) return { ...requirement };
    const achievement_score_band = scoreBandForAchievement(result);
    return {
      ...requirement,
      achievement_status: result.achievement_status,
      ...(achievement_score_band ? { achievement_score_band } : {}),
      evidence_anchor_ids: result.evidence_anchor_ids,
      assessability_limits: result.assessability_limits,
      readiness_impact: result.readiness_impact,
    };
  });
}

function buildBriefAchievementInternalHooks(achievementTrace: BriefAchievementTrace): {
  priority_fixes: InternalBriefPriorityFix[];
  action_plan: InternalBriefActionPlanGroup[];
  public_surface_status: 'internal_only_locked_down_surface_pending';
} {
  const actionable = achievementTrace.requirement_results
    .filter((result) => (
      result.readiness_impact === 'submission_blocker'
      || result.readiness_impact === 'material_gap'
      || result.readiness_impact === 'retake_recommended'
      || (result.achievement_status === 'not_assessable' && isHardBriefCategory(result.category))
    ))
    .slice(0, 5);
  const priority_fixes = actionable.map<InternalBriefPriorityFix>((result, index) => {
    const isAssessability = result.achievement_status === 'not_assessable';
    return {
      priority_rank: index + 1,
      type: isAssessability ? 'assessability_blocker' : (result.readiness_impact === 'submission_blocker' ? 'retake_critical' : 'critical_gap'),
      title: isAssessability ? `Make brief item assessable: ${result.source_text}` : `Meet brief item: ${result.source_text}`,
      evidence_summary: result.evidence_summary,
      why_it_matters: result.readiness_impact === 'submission_blocker'
        ? 'This brief gap can block submission readiness.'
        : 'This brief gap affects the readiness rationale and next-take focus.',
      action: isAssessability
        ? 'Do not treat this as a performance fault; keep it as a limitation unless a retake can make the evidence clearer.'
        : 'Retake or adjust the submission so this requirement is met.',
      linked_categories: ['brief_adherence'],
      linked_requirement_ids: [result.requirement_id],
    };
  });
  const action_plan: InternalBriefActionPlanGroup[] = priority_fixes.length === 0
    ? []
    : [{
        group: priority_fixes.some((fix) => fix.type === 'retake_critical') ? 'retake_critical' : 'recording_setup',
        actions: actionable.map((result) => ({
          action: result.achievement_status === 'not_assessable'
            ? `Record as an assessability limitation before judging performance: ${result.source_text}`
            : `Address brief gap before submission: ${result.source_text}`,
          linked_requirement_id: result.requirement_id,
          readiness_impact: result.readiness_impact,
          assessability_limits: result.assessability_limits,
        })),
      }];
  return { priority_fixes, action_plan, public_surface_status: 'internal_only_locked_down_surface_pending' };
}

export function attachBriefAchievementToInternalReport<T extends Record<string, unknown>>(
  report: T,
  requirementTrace: BriefRequirementTrace,
  achievementTrace: BriefAchievementTrace,
): T & {
  brief_requirements: BriefRequirement[];
  brief_achievement: BriefAchievementSummary;
  brief_achievement_readiness_effect: BriefAchievementTrace['readiness_effect'];
  brief_achievement_priority_focus: string[];
  brief_achievement_internal_hooks: ReturnType<typeof buildBriefAchievementInternalHooks>;
  brief_achievement_public_surface_status: 'internal_only_locked_down_surface_pending';
} {
  const evaluatedRequirements = mergeBriefRequirementAchievements(requirementTrace.requirements, achievementTrace);
  const internalHooks = buildBriefAchievementInternalHooks(achievementTrace);
  return Object.assign(report, {
    brief_requirements: evaluatedRequirements,
    brief_achievement: achievementTrace.summary,
    brief_achievement_readiness_effect: achievementTrace.readiness_effect,
    brief_achievement_priority_focus: achievementTrace.recommended_priority_focus,
    brief_achievement_internal_hooks: internalHooks,
    brief_achievement_public_surface_status: 'internal_only_locked_down_surface_pending' as const,
  });
}
