export type TechniqueStandard = { technique_id: string; label: string; descriptor_safe: boolean };
export type TechniqueLevelStandard = { technique_id: string; level: 'foundational' | 'intermediate' | 'advanced' };
export type TechniqueObservationTrace = { technique_id: string; observed: boolean; trace_id: string };
