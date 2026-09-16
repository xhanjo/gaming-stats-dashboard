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
