package faceit

import (
	"testing"
	"time"
)

func TestCalculateStability(t *testing.T) {
	// 1. Порожній список
	rep := calculateStability(nil)
	if rep.Score != 0 {
		t.Errorf("Expected 0 for empty list, got %d", rep.Score)
	}

	// 2. Ідеально стабільний гравець (усі матчі однаковий K/D = 1.5)
	stableMatches := []PlayerMatchStats{
		{Kills: "15", Deaths: "10"},
		{Kills: "15", Deaths: "10"},
		{Kills: "15", Deaths: "10"},
	}
	stableRep := calculateStability(stableMatches)
	if stableRep.Score != 100 {
		t.Errorf("Expected score 100 for identical KD, got %d", stableRep.Score)
	}
	if stableRep.StatusText != "Максимальна" {
		t.Errorf("Expected 'Максимальна', got %s", stableRep.StatusText)
	}

	// 3. Нестабільний гравець (то 3.0, то 0.1)
	unstableMatches := []PlayerMatchStats{
		{Kills: "30", Deaths: "10"}, // 3.0
		{Kills: "1", Deaths: "10"},  // 0.1
		{Kills: "35", Deaths: "10"}, // 3.5
		{Kills: "2", Deaths: "10"},  // 0.2
	}
	unstableRep := calculateStability(unstableMatches)
	if unstableRep.Score >= 50 {
		t.Errorf("Expected low stability score, got %d", unstableRep.Score)
	}
}

func TestCalculateClusters(t *testing.T) {
	matches := []PlayerMatchStats{
		{Kills: "25", Deaths: "10", ADR: "95"}, // Carry (KD=2.5, ADR=95)
		{Kills: "15", Deaths: "15", ADR: "75"}, // Average (KD=1.0, ADR=75)
		{Kills: "5", Deaths: "15", ADR: "50"},  // Low Impact (KD=0.33, ADR=50)
	}

	res := calculateClusters(matches)
	if len(res.StarPoints) != 1 {
		t.Errorf("Expected 1 star point, got %d", len(res.StarPoints))
	}
	if len(res.MidPoints) != 1 {
		t.Errorf("Expected 1 mid point, got %d", len(res.MidPoints))
	}
	if len(res.LowPoints) != 1 {
		t.Errorf("Expected 1 low point, got %d", len(res.LowPoints))
	}
	if res.StarPercent != 33 {
		t.Errorf("Expected 33%% star, got %d%%", res.StarPercent)
	}
}

func TestSimulateEloScenarios(t *testing.T) {
	matches := []PlayerMatchStats{
		{Result: "1"}, {Result: "1"}, {Result: "1"},
		{Result: "0"}, {Result: "0"},
	}

	currentElo := 2000
	scenarios := simulateEloScenarios(currentElo, matches, 10)

	if len(scenarios.ExpectedPath) != 10 {
		t.Fatalf("Expected 10 steps in path, got %d", len(scenarios.ExpectedPath))
	}
	if scenarios.FinalOptimistic < scenarios.FinalExpected {
		t.Errorf("Optimistic (%d) should be >= Expected (%d)", scenarios.FinalOptimistic, scenarios.FinalExpected)
	}
	if scenarios.FinalPessimistic > scenarios.FinalExpected {
		t.Errorf("Pessimistic (%d) should be <= Expected (%d)", scenarios.FinalPessimistic, scenarios.FinalExpected)
	}
}

func TestCalculateWinConditions(t *testing.T) {
	matches := []PlayerMatchStats{
		{Result: "1", ADR: "100", Kills: "20", Deaths: "10", Assists: "6", FirstKills: "3"},
		{Result: "1", ADR: "90", Kills: "18", Deaths: "10", Assists: "5", FirstKills: "2"},
		{Result: "0", ADR: "60", Kills: "10", Deaths: "15", Assists: "2", FirstKills: "0"},
		{Result: "0", ADR: "50", Kills: "8", Deaths: "16", Assists: "1", FirstKills: "1"},
	}

	wc := calculateWinConditions(matches, 75.0)
	if wc.BaselineWinRate != 50 {
		t.Errorf("Expected 50%% baseline winrate, got %d%%", wc.BaselineWinRate)
	}
	if wc.HighADR.WinRate != 100 {
		t.Errorf("Expected 100%% high ADR winrate, got %d%%", wc.HighADR.WinRate)
	}
	if wc.HighKD.WinRate != 100 {
		t.Errorf("Expected 100%% high KD winrate, got %d%%", wc.HighKD.WinRate)
	}
	if wc.HighKills.WinRate != 100 {
		t.Errorf("Expected 100%% high kills winrate, got %d%%", wc.HighKills.WinRate)
	}
	if wc.HighEntry.WinRate != 100 {
		t.Errorf("Expected 100%% high entry winrate, got %d%%", wc.HighEntry.WinRate)
	}
	if wc.HighAssists.WinRate != 100 {
		t.Errorf("Expected 100%% high assists winrate, got %d%%", wc.HighAssists.WinRate)
	}
}

func TestCalculatePlayActivity(t *testing.T) {
	nowUnix := time.Now().Unix()
	matches := []PlayerMatchStats{
		{Result: "1", CreatedAt1: nowUnix},
		{Result: "0", CreatedAt1: nowUnix - 3600},
	}

	act := CalculatePlayActivity(matches)
	if act == nil {
		t.Fatal("Expected non-nil activity report")
	}
	if act.TotalMatches != 2 {
		t.Errorf("Expected 2 total matches, got %d", act.TotalMatches)
	}
	if act.TotalWins != 1 {
		t.Errorf("Expected 1 win, got %d", act.TotalWins)
	}
	if len(act.HourlyDistribution) != 24 {
		t.Errorf("Expected 24 hours, got %d", len(act.HourlyDistribution))
	}
	if len(act.DailyDistribution) != 7 {
		t.Errorf("Expected 7 days, got %d", len(act.DailyDistribution))
	}
}
