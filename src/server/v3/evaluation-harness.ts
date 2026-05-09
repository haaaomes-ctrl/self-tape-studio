import type { QAValidationResult } from './types';
import { GOLDEN_FIXTURES, RED_TEAM_FIXTURES } from './fixtures';
export const S1_METRICS = [
  'input record exists','performer level selected','brief mode separated from audition context','audition context separated from brief mode','comparison intent separated from brief mode','expected components separated from brief mode','no-brief unknowns remain unknown','TruthStateMap created','ResolverResult created','EvidenceAnchor schema available','PublicClaimTrace schema available','QAValidationResult created','ModelRunTrace created','UK English gate can run','GF-01 registered as P0 comparison failure fixture',
] as const;
export const S2_METRICS = [
  'EvidenceAnchor object created','EvidenceAnchor validates','timestamp within tape duration','time range valid','EvidenceAnchor private by default','evidence sufficiency recorded','assessability status recorded','Component object created','component type valid','component source valid','component confidence recorded','ComponentCriticality recorded','component criticality source recorded','PublicClaimTrace object created','PublicClaimTrace links to EvidenceAnchor where required','claim truth state recorded','missing anchor detected','no-brief invented claim suppressed or warned','GF-01 component stability tracked','GF-01 / RT-15 remains P0',
] as const;
export interface HarnessResult { id:string; passed:boolean; checks:Array<{metric:string;passed:boolean}>; validations:QAValidationResult[]; }
export function runS1Harness(id:string, checks:Partial<Record<(typeof S1_METRICS)[number], boolean>>={}, validations:QAValidationResult[]=[]): HarnessResult { const rows=S1_METRICS.map((m)=>({metric:m,passed:checks[m] ?? true})); return { id, passed: rows.every((r)=>r.passed), checks:rows, validations }; }
export function runS2Harness(id:string, checks:Partial<Record<(typeof S2_METRICS)[number], boolean>>={}, validations:QAValidationResult[]=[]): HarnessResult { const rows=S2_METRICS.map((m)=>({metric:m,passed:checks[m] ?? true})); return { id, passed: rows.every((r)=>r.passed), checks:rows, validations }; }
export function getMetricRegistry(){ return [...S1_METRICS, ...S2_METRICS, ...S3_METRICS, ...S4_METRICS]; }
export function getS2MetricRegistry(){ return S2_METRICS; }
export function getFixtureRegistry(){ return GOLDEN_FIXTURES; }
export function getRedTeamRegistry(){ return RED_TEAM_FIXTURES; }

export const S3_METRICS = [
'OntologyItem object created','OntologyItem validates','OntologyVersion created','SourceProvenance recorded','SafePublicLanguageMap entry exists','TechniqueObservation object created','TechniqueObservation links EvidenceAnchor','TechniqueObservation links OntologyItem','observation status present','confidence present','evidence sufficiency present','assessability present','false-positive checks present','public_display_eligibility blocked in S3','ontology maturity misuse detected','missing provenance detected','unsafe wording detected','public technique display attempt blocked','technique-as-score attempt blocked','GF-01 / RT-15 remains P0 and no recommendation',
] as const;
export function runS3Harness(id:string, checks:Partial<Record<(typeof S3_METRICS)[number], boolean>>={}, validations:QAValidationResult[]=[]): HarnessResult { const rows=S3_METRICS.map((m)=>({metric:m,passed:checks[m] ?? true})); return { id, passed: rows.every((r)=>r.passed), checks:rows, validations }; }
export function getS3MetricRegistry(){ return S3_METRICS; }


export const S4_METRICS = [
'ComponentScore created','CriticalComponentGate created','active gate caps shadow readiness','SubmissionCohesion created','OverallReadiness shadow trace created','ProfessionalScoreBand resolved','honest scoring validator triggered','essential-component cap validator triggered','same-video variance tracked','GF-01 / RT-15 remains P0 and no recommendation',
] as const;
export function runS4Harness(id:string, checks:Partial<Record<(typeof S4_METRICS)[number], boolean>>={}, validations:QAValidationResult[]=[]): HarnessResult { const rows=S4_METRICS.map((m)=>({metric:m,passed:checks[m] ?? true})); return { id, passed: rows.every((r)=>r.passed), checks:rows, validations }; }
export function getS4MetricRegistry(){ return S4_METRICS; }
