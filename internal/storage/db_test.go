package storage

import (
	"testing"

	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

func TestNewStorage(t *testing.T) {
	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Очікувалось успішне підключення до БД, отримано помилку: %v", err)
	}
	defer store.Close()

	if err := store.InitTable(); err != nil {
		t.Fatalf("Помилка під час ініціалізації таблиць (InitTable): %v", err)
	}

	query := "SELECT name FROM sqlite_master WHERE type='table' AND name='players'"
	rows, err := store.db.Query(query)
	if err != nil {
		t.Fatalf("Помилка при виконанні запиту до системної таблиці: %v", err)
	}
	defer rows.Close()

	if !rows.Next() {
		t.Errorf("Тест провалено: таблиця 'players' не була знайдена в БД після InitTable")
	}
}

func TestSaveAndGetPlayer(t *testing.T) {
	store, err := New(":memory:")
	if err != nil {
		t.Fatalf("Помилка підключення: %v", err)
	}
	defer store.Close()
	_ = store.InitTable()

	mockProfile := &faceit.PlayerProfile{
		PlayerID: "test_id_123",
		Nickname: "xhanjo_test",
		Country:  "ua",
		Games: map[string]faceit.GameInfo{
			"cs2": {SkillLevel: 10, FaceitElo: 2500},
		},
	}

	err = store.SavePlayer(mockProfile)
	if err != nil {
		t.Fatalf("Помилка при збереженні гравця: %v", err)
	}

	retrieved, err := store.GetPlayer("xhanjo_test")
	if err != nil {
		t.Fatalf("Помилка при отриманні гравця: %v", err)
	}

	if retrieved.Nickname != "xhanjo_test" {
		t.Errorf("Очікувався нікнейм 'xhanjo_test', отримано '%s'", retrieved.Nickname)
	}

	if retrieved.Games["cs2"].FaceitElo != 2500 {
		t.Errorf("Очікувалось 2500 Elo, отримано '%d'", retrieved.Games["cs2"].FaceitElo)
	}
}
