/**
 * Multi-model consensus computation for the CRE workflow.
 *
 * Mirrors the Python consensus engine in backend/services/ai_service.py
 * but runs deterministically inside CRE nodes (no randomness, no non-determinism).
 *
 * Agreement scoring uses the same Jaccard-index approach with smoothing
 * as the Go reference implementation in ../consensus.go.
 */

import type { AIProviderResponse, ConsensusResult } from "./types.js";

/**
 * Calculate pairwise Jaccard agreement across provider responses.
 * Identical algorithm to consensus.go:CalculateAgreementScore and
 * ai_service.py:_calculate_agreement_score.
 */
function calculateAgreementScore(responses: string[]): number {
  if (responses.length < 2) return 1.0;

  const tokenSets: Set<string>[] = [];
  for (const resp of responses) {
    const tokens = new Set<string>();
    for (const raw of resp.toLowerCase().split(/\s+/)) {
      const word = raw.replace(/^[.,:;!?()[\]{}"'`]+|[.,:;!?()[\]{}"'`]+$/g, "");
      if (word.length > 3) tokens.add(word);
    }
    if (tokens.size > 0) tokenSets.push(tokens);
  }

  if (tokenSets.length < 2) return 0.5;

  let totalOverlap = 0;
  let comparisons = 0;

  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      let intersection = 0;
      const unionSet = new Set(tokenSets[i]);
      for (const token of tokenSets[j]) {
        unionSet.add(token);
        if (tokenSets[i].has(token)) intersection++;
      }
      if (unionSet.size > 0) {
        totalOverlap += intersection / unionSet.size;
        comparisons++;
      }
    }
  }

  if (comparisons === 0) return 0.5;

  const avg = totalOverlap / comparisons;
  // Smoothing consistent with Go and Python implementations
  return Math.max(0.0, Math.min(1.0, 0.1 + 0.8 * avg));
}

/**
 * Safely parse a JSON analysis string from a provider.
 * Returns null if the provider returned empty or unparseable output.
 */
function parseAnalysis(
  raw: string
): { score: number; narrative: string; pillars: string[]; summary: string } | null {
  if (!raw) return null;

  // Try to find JSON in the response (may be wrapped in markdown fences)
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const candidate = fenced ? fenced[1] : raw.includes("{") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) : null;

  if (!candidate) return null;

  try {
    const parsed = JSON.parse(candidate);
    return {
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50,
      narrative: String(parsed.narrative ?? parsed.top_narrative ?? ""),
      pillars: Array.isArray(parsed.pillars) ? parsed.pillars.map(String) : [],
      summary: String(parsed.summary ?? parsed.consensus_report ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * Compute consensus across multiple AI provider responses.
 *
 * This is the CRE-native equivalent of the Python ConsensusEngine:
 * 1. Parse each provider's structured analysis
 * 2. Calculate lexical agreement (Jaccard index)
 * 3. Average the individual scores weighted by agreement
 * 4. Merge pillars and select the dominant narrative
 */
export function computeConsensus(
  responses: AIProviderResponse[]
): ConsensusResult {
  const successful = responses.filter((r) => r.statusCode >= 200 && r.statusCode < 300 && r.analysis);

  if (successful.length === 0) {
    return {
      score: 50,
      summary: "No AI providers returned valid responses. Defaulting to neutral.",
      agreementScore: 0,
      providerCount: 0,
      pillars: [],
      topNarrative: "Insufficient data for consensus.",
    };
  }

  // Parse structured outputs
  const parsed = successful
    .map((r) => ({ provider: r.provider, result: parseAnalysis(r.analysis), raw: r.analysis }))
    .filter((p) => p.result !== null) as Array<{
    provider: string;
    result: NonNullable<ReturnType<typeof parseAnalysis>>;
    raw: string;
  }>;

  // Lexical agreement across raw texts
  const agreementScore = calculateAgreementScore(successful.map((r) => r.analysis));

  if (parsed.length === 0) {
    // Providers responded but output wasn't parseable — use agreement as signal
    const fallbackScore = Math.round(agreementScore * 100);
    return {
      score: fallbackScore,
      summary: successful.map((r) => r.analysis).join(" | ").slice(0, 500),
      agreementScore,
      providerCount: successful.length,
      pillars: [],
      topNarrative: "Providers returned unstructured output. Score derived from lexical agreement.",
    };
  }

  // Average score across parsed providers
  const avgScore = Math.round(
    parsed.reduce((sum, p) => sum + p.result.score, 0) / parsed.length
  );

  // Merge pillars (deduplicated)
  const pillarSet = new Set<string>();
  for (const p of parsed) {
    for (const pillar of p.result.pillars) pillarSet.add(pillar);
  }

  // Select the longest narrative as the top narrative
  const topNarrative = parsed.reduce(
    (best, p) => (p.result.narrative.length > best.length ? p.result.narrative : best),
    ""
  );

  // Select the longest summary
  const summary = parsed.reduce(
    (best, p) => (p.result.summary.length > best.length ? p.result.summary : best),
    ""
  );

  return {
    score: avgScore,
    summary: summary || topNarrative || "Consensus reached.",
    agreementScore,
    providerCount: successful.length,
    pillars: Array.from(pillarSet),
    topNarrative,
  };
}
