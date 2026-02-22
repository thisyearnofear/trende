package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// TrendeReport represents the structured output of the consensus engine.
type TrendeReport struct {
	Topic           string   `json:"topic"`
	ConsensusScore  float64  `json:"consensus_score"`
	ProviderCount   int      `json:"provider_count"`
	TopNarrative    string   `json:"top_narrative"`
	Pillars         []string `json:"pillars"`
	Timestamp       string   `json:"timestamp"`
}

// CalculateAgreementScore estimates consensus based on lexical overlap (Jaccard Index).
func CalculateAgreementScore(responses []string) float64 {
	if len(responses) < 2 {
		return 1.0
	}

	tokenSets := make([]map[string]bool, 0)
	for _, resp := range responses {
		tokens := make(map[string]bool)
		words := strings.Fields(strings.ToLower(resp))
		for _, word := range words {
			cleanWord := strings.Trim(word, ".,:;!?()[]{}\"'`")
			if len(cleanWord) > 3 {
				tokens[cleanWord] = true
			}
		}
		if len(tokens) > 0 {
			tokenSets = append(tokenSets, tokens)
		}
	}

	if len(tokenSets) < 2 {
		return 0.5
	}

	var totalOverlap float64
	var comparisons int

	for i := 0; i < len(tokenSets); i++ {
		for j := i + 1; j < len(tokenSets); j++ {
			intersection := 0
			unionMap := make(map[string]bool)
			
			for token := range tokenSets[i] {
				unionMap[token] = true
				if tokenSets[j][token] {
					intersection++
				}
			}
			for token := range tokenSets[j] {
				unionMap[token] = true
			}

			union := len(unionMap)
			if union > 0 {
				totalOverlap += float64(intersection) / float64(union)
				comparisons++
			}
		}
	}

	if comparisons == 0 {
		return 0.5
	}

	avgScore := totalOverlap / float64(comparisons)
	// Apply smoothing consistent with Python implementation
	smoothed := 0.1 + (0.8 * avgScore)
	if smoothed > 1.0 {
		return 1.0
	}
	if smoothed < 0.0 {
		return 0.0
	}
	return smoothed
}

// GenerateConsensus coordinates the multi-model AI consensus within the CRE.
func GenerateConsensus(inputs []string) (TrendeReport, error) {
	if len(inputs) == 0 {
		return TrendeReport{}, fmt.Errorf("no inputs provided for consensus")
	}

	// Calculate agreement score across all inputs
	agreement := CalculateAgreementScore(inputs)

	// In a real CRE/OCR3 implementation, we would extract dominant narratives
	// and pillars using more sophisticated logic or a verified synthesis model.
	// For now, we take the consensus score and indicate the source count.
	
	pillars := []string{"Market sentiment", "Social volume"} // Placeholder
	
	return TrendeReport{
		Topic:          "Decentralized Trend Consensus",
		ConsensusScore: agreement,
		ProviderCount:  len(inputs),
		TopNarrative:   "Aggregated signal from decentralized AI oracle nodes.",
		Pillars:        pillars,
		Timestamp:      time.Now().Format(time.RFC3339),
	}, nil
}

func main() {
	fmt.Println("Trende CRE Consensus Module Initialized")
	// In a production CRE, this would register with the Chainlink Node software.
}
