package faceit

import (
	"encoding/json"
	"testing"
)

func TestPlayerMatchStatsParsing(t *testing.T) {
	mockJSON := []byte(`{
		"Match Id": "1_faceit_match_123",
		"Kills": "28",
		"Deaths": "14",
		"Result": "1",
		"created_at": 1712150000
	}`)

	var stats PlayerMatchStats
	err := json.Unmarshal(mockJSON, &stats)

	if err != nil {
		t.Fatalf("Очікувався успішний парсинг JSON, отримана помилка: %v", err)
	}

	if stats.MatchId != "1_faceit_match_123" {
		t.Errorf("Очікувався Match Id '1_faceit_match_123', отримано '%s'", stats.MatchId)
	}

	if stats.Kills != "28" {
		t.Errorf("Очікувалось 28 вбивств, отримано '%s'", stats.Kills)
	}

	if stats.Result != "1" {
		t.Errorf("Очікувався Result '1', отримано '%s'", stats.Result)
	}

	if stats.CreatedAt1 == nil {
		t.Errorf("Поле CreatedAt1 не повинно бути порожнім")
	}
}
