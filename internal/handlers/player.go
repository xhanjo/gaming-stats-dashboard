package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

type Database interface {
	GetPlayer(nickname string) (*faceit.PlayerProfile, error)
	SavePlayer(profile *faceit.PlayerProfile) error
}

func GetPlayerStats(db Database, apiKey string) http.HandlerFunc {
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

		limitStr := r.URL.Query().Get("limit")
		limit := 30
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}

		profile, err := db.GetPlayer(nickname)

		if err == nil && limit <= 30 && profile.Recent != nil && len(profile.Recent.MatchHistory) > 0 {
			log.Printf("INFO: Дані для [%s] взяті з БАЗИ ДАНИХ", nickname)
			json.NewEncoder(w).Encode(profile)
			return
		}

		if err != sql.ErrNoRows && limit <= 30 {
			log.Printf("ERROR: Помилка читання з БД (або кеш порожній/зламаний): %v", err)
		}

		if limit > 30 {
			log.Printf("INFO: Запущено ГЛИБОКИЙ АНАЛІЗ для [%s] (limit=%d)", nickname, limit)
		} else {
			log.Printf("INFO: Кеш порожній або застарів. Запит до Faceit API для [%s] (limit=%d)...", nickname, limit)
		}

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

		recentForm, err := faceit.CalculateRecentForm(ctx, profile.PlayerID, apiKey, limit)
		if err == nil {
			profile.Recent = recentForm
			log.Printf("INFO: Успішно проаналізовано %d матчів", recentForm.MatchesAnalyzed)
		} else {
			log.Printf("WARN: Не вдалося розрахувати форму: %v", err)
		}

		if profile.Recent != nil && len(profile.Recent.MatchHistory) > 0 {
			err = db.SavePlayer(profile)
			if err != nil {
				log.Printf("ERROR: Помилка збереження в БД: %v", err)
			} else {
				log.Printf("INFO: Дані гравця [%s] успішно збережено в БД", nickname)
			}
		} else {
			log.Printf("WARN: Дані не збережено в БД, оскільки історія матчів порожня")
		}

		json.NewEncoder(w).Encode(profile)
	}
}
