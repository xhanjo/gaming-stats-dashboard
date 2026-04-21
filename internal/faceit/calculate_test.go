package faceit

import (
	"testing"
)

func TestCalculateRecentForm_TableDriven(t *testing.T) {
	tests := []struct {
		name             string
		inputHistory     []PlayerMatchStats
		expectedMatches  int
		expectedAvgKills float64
		expectedAvgADR   float64
		expectNil        bool
	}{
		{
			name: "Ідеальний сценарій (2 матчі)",
			inputHistory: []PlayerMatchStats{
				{Kills: "20", Deaths: "10", ADR: "100", KRRatio: "1.0", HeadshotsPc: "50"},
				{Kills: "10", Deaths: "10", ADR: "80", KRRatio: "0.5", HeadshotsPc: "30"},
			},
			expectedMatches:  2,
			expectedAvgKills: 15.0,
			expectedAvgADR:   90.0,
			expectNil:        false,
		},
		{
			name: "Один матч (захист від ділення)",
			inputHistory: []PlayerMatchStats{
				{Kills: "10", Deaths: "0", ADR: "100", KRRatio: "1.0", HeadshotsPc: "50"},
			},
			expectedMatches:  1,
			expectedAvgKills: 10.0,
			expectedAvgADR:   100.0,
			expectNil:        false,
		},
		{
			name:            "Порожня історія (помилка)",
			inputHistory:    []PlayerMatchStats{},
			expectedMatches: 0,
			expectNil:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			// 🔥 ВИПРАВЛЕННЯ: Передаємо 2000 як фейкове поточне Elo для проходження тесту
			result := CalculateStatsFromHistory(tt.inputHistory, 2000)

			if tt.expectNil {
				if result != nil {
					t.Errorf("Очікувався nil (порожній масив), але функція щось порахувала")
				}
				return
			}

			if result == nil {
				t.Fatalf("Функція повернула nil, хоча очікувалися розраховані дані")
			}

			if result.MatchesAnalyzed != tt.expectedMatches {
				t.Errorf("Матчі: очікувалось %d, отримано %d", tt.expectedMatches, result.MatchesAnalyzed)
			}

			if result.AvgKills != tt.expectedAvgKills {
				t.Errorf("AvgKills: очікувалось %.2f, отримано %.2f", tt.expectedAvgKills, result.AvgKills)
			}

			if result.AvgADR != tt.expectedAvgADR {
				t.Errorf("AvgADR: очікувалось %.2f, отримано %.2f", tt.expectedAvgADR, result.AvgADR)
			}
		})
	}
}
