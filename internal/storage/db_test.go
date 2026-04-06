package storage

import (
	"testing"
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
