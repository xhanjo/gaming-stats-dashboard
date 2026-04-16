package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
	"github.com/xhanjo/gaming-stats-dashboard/internal/storage"
)

func GetPlayerStats(db *storage.Storage, apiKey string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		ctx := r.Context()

		nickname := chi.URLParam(r, "nickname")
		if nickname == "" {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, `{"error": "Будь ласка, вкажіть параметр nickname"}`)
			return
		}

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

		profile, err = faceit.GetPlayerProfile(ctx, nickname, apiKey)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Гравця не знайдено або помилка API"}`)
			return
		}

		stats, err := faceit.GetCS2Stats(ctx, profile.PlayerID, apiKey)
		if err == nil {
			profile.Stats = stats
		} else {
			log.Printf("WARN: Не вдалося отримати загальну статистику: %v", err)
		}

		recentForm, err := faceit.CalculateRecentForm(ctx, profile.PlayerID, apiKey, 20)
		if err == nil {
			profile.Recent = recentForm
			log.Printf("INFO: Успішно проаналізовано %d матчів", recentForm.MatchesAnalyzed)
		} else {
			log.Printf("WARN: Не вдалося розрахувати форму: %v", err)
		}

		err = db.SavePlayer(profile)
		if err != nil {
			log.Printf("ERROR: Помилка збереження в БД: %v", err)
		} else {
			log.Printf("INFO: Дані гравця [%s] збережено в БД", nickname)
		}

		json.NewEncoder(w).Encode(profile)
	}
}
