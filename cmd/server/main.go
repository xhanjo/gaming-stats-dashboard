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
		log.Println("WARN: файл .env не знайдено.")
	}

	db, err := storage.New("stats.db")
	if err != nil {
		log.Fatal("Критична помилка: Не вдалося підключитися до БД:", err)
	}

	if err := db.InitTable(); err != nil {
		log.Fatal("Критична помилка: Не вдалося ініціалізувати таблиці:", err)
	}
	log.Println("INFO: База даних SQLite успішно підключена!")

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
		w.Header().Set("Access-Control-Allow-Origin", "*")

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

		log.Printf("INFO: Отримуємо загальну статистику для ID: %s", profile.PlayerID)
		stats, err := faceit.GetCS2Stats(profile.PlayerID, apiKey)
		if err == nil {
			profile.Stats = stats
		} else {
			log.Printf("WARN: Не вдалося отримати загальну статистику для [%s]: %v", nickname, err)
		}

		log.Printf("INFO: Розраховуємо форму гравця [%s] за останні 20 матчів.", nickname)
		recentForm, err := faceit.CalculateRecentForm(profile.PlayerID, apiKey, 20)
		if err == nil {
			profile.Recent = recentForm
			log.Printf("INFO: Успішно проаналізовано %d матчів", recentForm.MatchesAnalyzed)
		} else {
			log.Printf("WARN: Не вдалося розрахувати форму для [%s]: %v", nickname, err)
		}

		err = db.SavePlayer(profile)
		if err != nil {
			log.Printf("ERROR: Помилка збереження в БД: %v", err)
		} else {
			log.Printf("INFO: Усі дані гравця [%s] успішно збережено в БД", nickname)
		}

		json.NewEncoder(w).Encode(profile)
	})

	port := ":8080"
	fmt.Printf("API Сервер запущено! Перевірте: http://localhost%s/api/player?nickname=xhanjo\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Критична помилка: ", err)
	}
}
