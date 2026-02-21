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
  const weighted = 70 + platforms * 30 + models * 34 + (threshold > 0.75 ? 40 : 0);
  const totalSeconds = Math.max(120, Math.round(weighted));
  const minSeconds = Math.max(90, Math.round(totalSeconds * 0.85));
  const maxSeconds = Math.round(totalSeconds * 1.9);
  return { totalSeconds, minSeconds, maxSeconds };
}
