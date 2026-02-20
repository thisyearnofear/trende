export interface RuntimeEstimateInput {
  platforms: string[];
  models?: string[];
  relevanceThreshold?: number;
}

export interface RuntimeEstimate {
  totalSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

/**
 * Single source of truth for runtime estimation used in planning + processing UI.
 */
export function estimateMissionRuntime(input: RuntimeEstimateInput): RuntimeEstimate {
  const platforms = input.platforms?.length || 0;
  const models = input.models?.length || 0;
  const threshold = input.relevanceThreshold ?? 0.6;
  const weighted = 24 + platforms * 18 + models * 24 + (threshold > 0.75 ? 25 : 0);
  const totalSeconds = Math.max(45, Math.round(weighted * 1.6));
  const minSeconds = Math.max(30, Math.round(totalSeconds * 0.75));
  const maxSeconds = Math.round(totalSeconds * 1.35);
  return { totalSeconds, minSeconds, maxSeconds };
}
