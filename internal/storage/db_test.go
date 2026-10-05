package storage

import (
	"context"
	"testing"

	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

func TestNewStorage(t *testing.T) {
	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Expected successful DB connection, got error: %v", err)
	}
	defer store.Close()

	if err := store.InitTable(context.Background()); err != nil {
		t.Fatalf("InitTable error: %v", err)
	}

	query := "SELECT name FROM sqlite_master WHERE type='table' AND name='players'"
	rows, err := store.db.Query(query)
	if err != nil {
		t.Fatalf("Query error: %v", err)
	}
	defer rows.Close()

	if !rows.Next() {
		t.Errorf("Table 'players' not found after InitTable")
	}
}

func TestSaveAndGetPlayer(t *testing.T) {
	ctx := context.Background()

	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Connection error: %v", err)
	}
	defer store.Close()

	if err := store.InitTable(ctx); err != nil {
		t.Fatalf("InitTable failed: %v", err)
	}

	mockProfile := &faceit.PlayerProfile{
		PlayerID: "test_id_123",
		Nickname: "xhanjo_test",
		Country:  "ua",
		Games: map[string]faceit.GameInfo{
			"cs2": {SkillLevel: 10, FaceitElo: 2500},
		},
	}

	err = store.SavePlayer(ctx, mockProfile)
	if err != nil {
		t.Fatalf("SavePlayer error: %v", err)
	}

	retrieved, err := store.GetPlayer(ctx, "xhanjo_test")
	if err != nil {
		t.Fatalf("GetPlayer error: %v", err)
	}

	if retrieved.Nickname != "xhanjo_test" {
		t.Errorf("Expected nickname 'xhanjo_test', got '%s'", retrieved.Nickname)
	}

	if retrieved.Games["cs2"].FaceitElo != 2500 {
		t.Errorf("Expected 2500 Elo, got '%d'", retrieved.Games["cs2"].FaceitElo)
	}
}

func TestSavePlayer_HistoryMergeAndRetention(t *testing.T) {
	ctx := context.Background()

	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Connection error: %v", err)
	}
	defer store.Close()

	if err := store.InitTable(ctx); err != nil {
		t.Fatalf("InitTable failed: %v", err)
	}

	initialMatches := []faceit.PlayerMatchStats{
		{MatchId: "m1", Kills: "20", Deaths: "10", ADR: "80", HeadshotsPc: "50", KRRatio: "1.0"},
		{MatchId: "m2", Kills: "25", Deaths: "15", ADR: "90", HeadshotsPc: "40", KRRatio: "1.1"},
		{MatchId: "m3", Kills: "15", Deaths: "12", ADR: "70", HeadshotsPc: "30", KRRatio: "0.8"},
	}

	profile := &faceit.PlayerProfile{
		PlayerID: "player_merge_1",
		Nickname: "merge_user",
		Games:    map[string]faceit.GameInfo{"cs2": {SkillLevel: 8, FaceitElo: 1800}},
		Recent: &faceit.RecentForm{
			MatchesAnalyzed: len(initialMatches),
			MatchHistory:    initialMatches,
		},
	}

	if err := store.SavePlayer(ctx, profile); err != nil {
		t.Fatalf("SavePlayer initial error: %v", err)
	}

	// Тепер додаємо новий матч (m4) та 1 існуючий (m1 - дублікат)
	newBatch := []faceit.PlayerMatchStats{
		{MatchId: "m4", Kills: "30", Deaths: "10", ADR: "100", HeadshotsPc: "60", KRRatio: "1.3"},
		{MatchId: "m1", Kills: "20", Deaths: "10", ADR: "80", HeadshotsPc: "50", KRRatio: "1.0"}, // duplicate
	}

	updateProfile := &faceit.PlayerProfile{
		PlayerID: "player_merge_1",
		Nickname: "merge_user",
		Games:    map[string]faceit.GameInfo{"cs2": {SkillLevel: 8, FaceitElo: 1825}},
		Recent: &faceit.RecentForm{
			MatchesAnalyzed: len(newBatch),
			MatchHistory:    newBatch,
		},
	}

	if err := store.SavePlayer(ctx, updateProfile); err != nil {
		t.Fatalf("SavePlayer update error: %v", err)
	}

	// Перевіряємо що в пам'яті RecentForm оновлено до 4 матчів (m4, m1, m2, m3)
	if updateProfile.Recent.MatchesAnalyzed != 4 {
		t.Errorf("Expected MatchesAnalyzed to be 4, got %d", updateProfile.Recent.MatchesAnalyzed)
	}

	// Перевіряємо збереження в базі даних
	retrieved, err := store.GetPlayer(ctx, "merge_user")
	if err != nil {
		t.Fatalf("GetPlayer error: %v", err)
	}

	if retrieved.Recent == nil || len(retrieved.Recent.MatchHistory) != 4 {
		t.Fatalf("Expected 4 matches in DB history, got %v", retrieved.Recent)
	}

	if retrieved.Recent.MatchesAnalyzed != 4 {
		t.Errorf("Expected retrieved MatchesAnalyzed = 4, got %d", retrieved.Recent.MatchesAnalyzed)
	}
}

func TestGetPlayer_OlderThanOneHour(t *testing.T) {
	ctx := context.Background()

	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Connection error: %v", err)
	}
	defer store.Close()

	if err := store.InitTable(ctx); err != nil {
		t.Fatalf("InitTable failed: %v", err)
	}

	profile := &faceit.PlayerProfile{
		PlayerID: "player_old_1",
		Nickname: "old_cache_user",
		Games:    map[string]faceit.GameInfo{"cs2": {SkillLevel: 10, FaceitElo: 2300}},
		Recent: &faceit.RecentForm{
			MatchesAnalyzed: 1,
			MatchHistory: []faceit.PlayerMatchStats{
				{MatchId: "m1", Kills: "18", Deaths: "12"},
			},
		},
	}

	if err := store.SavePlayer(ctx, profile); err != nil {
		t.Fatalf("SavePlayer error: %v", err)
	}

	// Симулюємо що запис старіший за 2 години
	_, err = store.db.Exec("UPDATE players SET last_updated = datetime('now', '-2 hours') WHERE nickname = 'old_cache_user'")
	if err != nil {
		t.Fatalf("Update last_updated error: %v", err)
	}

	// GetPlayer повинен успішно повернути гравця і не відхиляти його через 1 годину
	retrieved, err := store.GetPlayer(ctx, "old_cache_user")
	if err != nil {
		t.Fatalf("GetPlayer failed for player older than 1 hour: %v", err)
	}

	if retrieved == nil || retrieved.Nickname != "old_cache_user" {
		t.Errorf("Expected player 'old_cache_user', got %v", retrieved)
	}

	if retrieved.LastUpdated.IsZero() {
		t.Errorf("Expected LastUpdated to be populated")
	}
}
