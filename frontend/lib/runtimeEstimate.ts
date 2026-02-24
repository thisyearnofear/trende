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
  const selected = new Set(input.platforms || []);
  let weighted = 180 + platforms * 45 + models * 38 + (threshold > 0.75 ? 60 : 0);

  // Long-form routes need larger budgets and should not be framed as "quick".
  if (selected.has('web')) weighted += 140;
  if (selected.has('tinyfish')) weighted += 220;
  if (selected.has('web') && selected.has('tinyfish')) weighted += 80;

  const totalSeconds = Math.max(240, Math.round(weighted));
  const minSeconds = Math.max(180, Math.round(totalSeconds * 0.8));
  const maxSeconds = Math.round(totalSeconds * 2.2);
  return { totalSeconds, minSeconds, maxSeconds };
}
