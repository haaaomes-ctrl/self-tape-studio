export type BriefRequirement = { id: string; requirement: string; status: 'required' | 'optional' };
export type BriefAchievement = { requirement_id: string; achieved: boolean; evidence?: string };
