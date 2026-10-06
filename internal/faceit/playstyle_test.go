package faceit

import (
	"testing"
)

func TestDeterminePlaystyle_TableDriven(t *testing.T) {
	tests := []struct {
		name         string
		avgKills     float64
		avgSniper    float64
		avgEntry     float64
		avgAssists   float64
		avgADR       float64
		avgHS        float64
		avgMulti     float64
		expectedRole string
	}{
		{
			name:         "Снайпер (Main AWPer): m0NESY стиль, багато AWP кілів і висока частка",
			avgKills:     22.0,
			avgSniper:    11.0,
			avgEntry:     2.0,
			avgAssists:   3.0,
			avgADR:       88.0,
			avgHS:        32.0,
			avgMulti:     1.0,
			expectedRole: "Main AWPer",
		},
		{
			name:         "Опенер (Entry Fragger): apeX стиль, високий First Kills навіть при помірному ADR",
			avgKills:     17.0,
			avgSniper:    0.5,
			avgEntry:     3.2,
			avgAssists:   3.0,
			avgADR:       78.0,
			avgHS:        48.0,
			avgMulti:     0.5,
			expectedRole: "Entry Fragger",
		},
		{
			name:         "Зірковий рифлер (Star Rifler): NiKo стиль, 95+ ADR, високі хедшоти і мультикіли",
			avgKills:     22.0,
			avgSniper:    0.8,
			avgEntry:     2.0,
			avgAssists:   3.5,
			avgADR:       98.0,
			avgHS:        65.0,
			avgMulti:     1.2,
			expectedRole: "Star Rifler",
		},
		{
			name:         "Саппорт (Support): висока кількість асистів розкидками та розмінами",
			avgKills:     12.0,
			avgSniper:    0.0,
			avgEntry:     1.0,
			avgAssists:   5.2,
			avgADR:       67.0,
			avgHS:        45.0,
			avgMulti:     0.3,
			expectedRole: "Support",
		},
		{
			name:         "Опорник (Anchor): мультикіли при прийомі пленту і низький First Kills",
			avgKills:     16.0,
			avgSniper:    0.3,
			avgEntry:     1.1,
			avgAssists:   2.5,
			avgADR:       79.0,
			avgHS:        46.0,
			avgMulti:     1.1,
			expectedRole: "Anchor",
		},
		{
			name:         "Універсал (Flex): середня статистика без вираженої спеціалізації",
			avgKills:     14.0,
			avgSniper:    1.0,
			avgEntry:     1.3,
			avgAssists:   2.8,
			avgADR:       66.0,
			avgHS:        40.0,
			avgMulti:     0.3,
			expectedRole: "Flex",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actualRole := DeterminePlaystyle(tt.avgKills, tt.avgSniper, tt.avgEntry, tt.avgAssists, tt.avgADR, tt.avgHS, tt.avgMulti)
			if actualRole != tt.expectedRole {
				t.Errorf("Очікувалась роль %q, але отримано %q", tt.expectedRole, actualRole)
			}
		})
	}
}
