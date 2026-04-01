package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"github.com/xhanjo/gaming-stats-dashboard/internal/handlers"
	"github.com/xhanjo/gaming-stats-dashboard/internal/storage"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("WARN: файл .env не знайдено, використовуються системні змінні...")
	}

	apiKey := os.Getenv("FACEIT_API_KEY")
	if apiKey == "" {
		log.Fatal("Критична помилка: FACEIT_API_KEY не знайдено!")
	}

	db, err := storage.New("stats.db")
	if err != nil {
		log.Fatal("Критична помилка: Не вдалося підключитися до БД:", err)
	}

	if err := db.InitTable(); err != nil {
		log.Fatal("Критична помилка: Не вдалося ініціалізувати таблиці:", err)
	}
	log.Println("INFO: База даних SQLite успішно підключена!")

	http.HandleFunc("/api/player", handlers.GetPlayerStats(db, apiKey))

	port := ":8080"
	fmt.Printf("API Сервер успішно запущено! Порт %s\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Критична помилка сервера: ", err)
	}
}
