export * from './release-state';
export * from './types';
export * from './validation';
export * from './privacy-boundary';
export * from './uk-english-gate';
export * from './fixtures';
export * from './evaluation-harness';
export * from './flags';

export {
  V3_FLAG_DEFAULTS,
  type Assessability,
  type ComponentScore,
  type DimensionScore,
  type ScoreTrace,
  type LevelStandard,
  applyCriticalGateCapShadow,
  applyOverallGateCapsShadow,
  canComponentScoreOverrideEssentialGate,
  createDimensionScore,
  createScoreTrace,
  evaluateSameVideoScoreVarianceShadow,
  findWeakestCriticalComponent,
  getAllLevelStandards,
  getLevelAdjustedReadiness,
  getLevelBandForScore,
  getProfessionalScoreBand,
  getScoringSentinelRegistry,
  requiresExceptionalEvidence,
  requiresProfessionalStandoutEvidence,
  validateCleanCaptureInflation,
  validateComponentScore,
  validateCriticalComponentGate,
  validateOldSixFieldLeakage,
  validateProfessionalHighScoreEvidence,
  validatePublicScoreExposure,
  validateRoleFitWording,
  validateScoringSentinelRegistry,
  validateSubmissionCohesion,
} from './s4-shadow-scoring';

// s5-public-report re-declares a handful of symbols that also live in
// release-state.ts and s5-internal-renderer.ts. Re-export everything except
// the colliding members; consumers can import those from their original
// modules.
export {
  type PublicReportV3,
  validateReportHasClaimTraces,
  validateReportHasEvidenceForMajorClaims,
  validateReportNoPrivateTraceLeakage,
  validateReportNoHiddenReasoning,
  runS5ReportValidators,
} from './s5-public-report';
export * from './s5-internal-renderer';

// s6-variance-comparison re-declares the S6 release-state helpers (they
// already live in release-state.ts). Re-export everything except those.
export {
  type ComparisonResult,
  type ComparisonConfidenceTrace,
  type EvidenceDeltaSummary,
  isComparisonState,
  validateComparisonState,
  evaluateDuplicateDetectionShadow,
  evaluateEvidenceDeltaDecisiveness,
  evaluateRecommendationSuppressionShadow,
  evaluateTieSuppressionShadow,
  validateDuplicateRecommendationSuppression,
  validateNearTieSuppression,
  validateSameBandSuppression,
  validateEvidenceDeltaRequirement,
  validateAnalysisVarianceWarning,
  validateSameVideoScoreVarianceComparison,
  validateComponentSplitInstability,
  validatePublicRecommendationExposure,
  validateComparisonPrivateTraceLeakage,
  validateComparisonHiddenReasoningLeakage,
  validateNoBriefComparisonOverclaim,
  validateComparisonUKEnglish,
  validateGF01FalseWinnerBlock,
} from './s6-variance-comparison';
export * from './s6-internal-comparison-renderer';

export * from './qa-artifacts.server';
export * from './qa-artifacts-wiring.server';
