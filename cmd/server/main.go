package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
	"github.com/xhanjo/gaming-stats-dashboard/internal/storage"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Попередження: файл .env не знайдено...")
	}

	db, err := storage.New("stats.db")
	if err != nil {
		log.Fatal("Не вдалося підключитися до бази даних:", err)
	}

	if err := db.InitTable(); err != nil {
		log.Fatal("Не вдалося ініціалізувати таблиці:", err)
	}
	log.Println("База даних SQLite успішно підключена та ініціалізована!")

	apiKey := os.Getenv("FACEIT_API_KEY")
	if apiKey == "" {
		log.Fatal("Критична помилка: FACEIT_API_KEY не знайдено!")
	}

	http.HandleFunc("/api/player", func(w http.ResponseWriter, r *http.Request) {

		nickname := r.URL.Query().Get("nickname")

		if nickname == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, `{"error": "Будь ласка, вкажіть параметр nickname"}`)
			return
		}

		profile, err := faceit.GetPlayerProfile(nickname, apiKey)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Гравця не знайдено або помилка API"}`)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(profile); err != nil {
			log.Println("Помилка конвертації в JSON:", err)
		}
	})

	port := ":8080"
	fmt.Printf("API Сервер запущено! Перевірте: http://localhost%s/api/player?nickname=xhanjo\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Помилка: ", err)
	}
}
