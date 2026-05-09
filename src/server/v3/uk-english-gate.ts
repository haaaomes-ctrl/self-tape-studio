export type UKEnglishContext = 'normal_public_copy'|'quoted_or_supplied_material'|'blocked_wording_list'|'red_team_case'|'internal_trace';
export interface UKEnglishGateResult { passed:boolean; flags:string[]; recognised_terms:string[]; }
const usTerms = ['callback','analyze','analyzer','behavior','program','artifact','modeling','labeled','fulfill','prioritize','organize','judgment'];
const ukTerms = ['self-tape','recall','casting director','agent','brief','sides','reader','ident/slate','performer','drama school','conservatoire','analyse','behaviour','programme','artefact','modelling','labelled','fulfil','prioritise','organise','judgement'];
export function runUKEnglishGate(text:string, opts?:{context?:UKEnglishContext; blockedWording?:string[]}): UKEnglishGateResult {
  const context = opts?.context ?? 'normal_public_copy';
  if (context==='quoted_or_supplied_material' || context==='blocked_wording_list' || context==='red_team_case' || context==='internal_trace') return { passed:true, flags:[], recognised_terms:[] };
  const lower = text.toLowerCase(); const flags:string[]=[];
  const escape=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const hasTerm=(term:string)=>new RegExp(`(^|[^a-z])${escape(term)}([^a-z]|$)`, 'i').test(lower);
  for (const t of usTerms) if (hasTerm(t) && !opts?.blockedWording?.includes(t)) flags.push(t);
  return { passed: flags.length===0, flags, recognised_terms: ukTerms.filter((t)=>hasTerm(t)) };
}
