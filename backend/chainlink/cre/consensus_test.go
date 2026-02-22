package main

import (
	"fmt"
	"testing"
)

func TestCalculateAgreementScore(t *testing.T) {
	resp1 := "The market is bullish on Monad due to its parallel execution."
	resp2 := "Monad represents a bullish trend with its new parallel execution engine."
	resp3 := "I am seeing high interest in Monad parallel-execution capabilities."

	score := CalculateAgreementScore([]string{resp1, resp2, resp3})
	fmt.Printf("Agreement Score: %f\n", score)

	if score < 0.3 || score > 1.0 {
		t.Errorf("Expected score between 0.3 and 1.0, got %f", score)
	}
}

func TestGenerateConsensus(t *testing.T) {
	inputs := []string{
		"Narrative A: Monad is fast.",
		"Narrative B: Monad uses parallel execution.",
	}

	report, err := GenerateConsensus(inputs)
	if err != nil {
		t.Fatalf("GenerateConsensus failed: %v", err)
	}

	if report.ProviderCount != 2 {
		t.Errorf("Expected 2 providers, got %d", report.ProviderCount)
	}

	if report.ConsensusScore <= 0 {
		t.Errorf("Expected positive consensus score, got %f", report.ConsensusScore)
	}
}
