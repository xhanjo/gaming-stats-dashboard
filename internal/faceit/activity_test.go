package faceit

import (
	"database/sql"
	"encoding/json"
	"os"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestCalculatePlayActivity_Synthetic(t *testing.T) {
	fixedTime := time.Date(2026, time.September, 15, 16, 0, 0, 0, time.UTC)
	refUnix := fixedTime.Unix()

	matches := []PlayerMatchStats{
		{Result: "1", CreatedAt1: refUnix},             // 2026-09-15 16:00
		{Result: "0", CreatedAt1: refUnix - 86400},     // 2026-09-14 16:00
		{Result: "1", CreatedAt1: refUnix - 7*86400},   // 2026-09-08 16:00
	}

	act := CalculatePlayActivityAt(matches, fixedTime)
	if act == nil {
		t.Fatal("Expected non-nil activity report")
	}

	if act.TotalMatches != 3 {
		t.Errorf("Expected 3 total matches, got %d", act.TotalMatches)
	}
	if act.TotalWins != 2 {
		t.Errorf("Expected 2 wins, got %d", act.TotalWins)
	}
	if act.UniqueDaysCount != 3 {
		t.Errorf("Expected 3 unique days, got %d", act.UniqueDaysCount)
	}
	if act.AvgDailyMatches != 1 {
		t.Errorf("Expected avg daily 1, got %f", act.AvgDailyMatches)
	}
	if act.MostActiveMonthName != "вересень" {
		t.Errorf("Expected most active month 'вересень', got '%s'", act.MostActiveMonthName)
	}
}

func TestFormatHourDisplay(t *testing.T) {
	cases := []struct {
		hour     int
		expected string
	}{
		{0, "12дп"},
		{4, "4дп"},
		{11, "11дп"},
		{12, "12пп"},
		{13, "1пп"},
		{16, "4пп"},
		{20, "8пп"},
		{23, "11пп"},
	}

	for _, c := range cases {
		got := formatHourDisplay(c.hour)
		if got != c.expected {
			t.Errorf("formatHourDisplay(%d) = %q, expected %q", c.hour, got, c.expected)
		}
	}
}

func TestCalculatePlayActivity_RealDataMatch(t *testing.T) {
	if _, err := os.Stat("../../stats.db"); os.IsNotExist(err) {
		t.Skip("stats.db does not exist")
	}

	db, err := sql.Open("sqlite", "../../stats.db")
	if err != nil {
		t.Fatalf("Failed to open stats.db: %v", err)
	}
	defer db.Close()

	var historyJSON string
	err = db.QueryRow("SELECT recent_history FROM players WHERE nickname = 'xhanjo' COLLATE NOCASE").Scan(&historyJSON)
	if err != nil {
		t.Fatalf("Failed to get player history: %v", err)
	}

	var matches []PlayerMatchStats
	if err := json.Unmarshal([]byte(historyJSON), &matches); err != nil {
		t.Fatalf("Failed to unmarshal history: %v", err)
	}

	act := CalculatePlayActivity(matches)
	if act == nil {
		t.Fatal("Expected non-nil report")
	}

	// Перевірка інваріантів розрахунку (не зламається при додаванні нових матчів)
	if act.TotalMatches < 100 {
		t.Errorf("Expected at least 100 matches, got %d", act.TotalMatches)
	}
	if act.UniqueDaysCount < 30 {
		t.Errorf("Expected at least 30 unique days, got %d", act.UniqueDaysCount)
	}
	if act.AvgDailyMatches <= 0 {
		t.Errorf("Expected positive avg daily matches, got %f", act.AvgDailyMatches)
	}
	if act.AvgWeeklyMatches <= 0 {
		t.Errorf("Expected positive avg weekly matches, got %f", act.AvgWeeklyMatches)
	}
	if act.MostActiveMonthName == "" {
		t.Errorf("Expected non-empty most active month")
	}
	if act.MostActiveHourDisplay == "" {
		t.Errorf("Expected non-empty most active hour display")
	}
	if act.MostActiveHourWinrate < 0 || act.MostActiveHourWinrate > 100 {
		t.Errorf("Expected winrate between 0 and 100, got %f", act.MostActiveHourWinrate)
	}
}
