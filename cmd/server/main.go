package main

import (
	"database/sql"
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
	log.Println("База даних SQLite успішно підключена!")

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

		w.Header().Set("Content-Type", "application/json")

		profile, err := db.GetPlayer(nickname)

		if err == nil {
			log.Printf("INFO: Дані для [%s] взяті з БАЗИ ДАНИХ", nickname)
			json.NewEncoder(w).Encode(profile)
			return
		}

		if err != sql.ErrNoRows {
			log.Printf("ERROR: Помилка читання з БД: %v", err)
		}

		log.Printf("INFO: Гравця [%s] немає в базі (або дані застаріли), запит до Faceit API...", nickname)

		profile, err = faceit.GetPlayerProfile(nickname, apiKey)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Гравця не знайдено або помилка API"}`)
			return
		}

		log.Printf("INFO: Отримуємо розширену статистику для ID: %s", profile.PlayerID)
		stats, err := faceit.GetCS2Stats(profile.PlayerID, apiKey)
		if err == nil {
			profile.Stats = stats
		} else {
			log.Printf("WARN: Не вдалося отримати детальну статистику CS2 для [%s]: %v", nickname, err)
		}

		err = db.SavePlayer(profile)
		if err != nil {
			log.Printf("ERROR: Помилка збереження в БД: %v", err)
		} else {
			log.Printf("INFO: Дані гравця [%s] успішно збережено в БД", nickname)
		}

		json.NewEncoder(w).Encode(profile)
	})

	port := ":8080"
	fmt.Printf("API Сервер запущено! Перевірте: http://localhost%s/api/player?nickname=xhanjo\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Помилка: ", err)
	}
}
